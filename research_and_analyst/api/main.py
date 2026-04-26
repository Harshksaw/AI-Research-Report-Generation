import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

from research_and_analyst.api.routes import report_routes, api_routes


@asynccontextmanager
async def lifespan(app: FastAPI):
    database_url = os.environ["DATABASE_URL"]
    async with AsyncPostgresSaver.from_conn_string(database_url) as checkpointer:
        await checkpointer.setup()
        app.state.checkpointer = checkpointer
        yield


app = FastAPI(title="AI Research Report Generator", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# JSON API routes
app.include_router(api_routes.router)

# File download route
app.include_router(report_routes.router)


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "research-report-generation",
        "timestamp": datetime.now().isoformat(),
    }


# Serve the React SPA (production build)
REACT_BUILD = os.path.join(os.getcwd(), "static", "react")

if os.path.isdir(REACT_BUILD):
    app.mount("/assets", StaticFiles(directory=os.path.join(REACT_BUILD, "assets")), name="react-assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_react(_full_path: str):
        return FileResponse(os.path.join(REACT_BUILD, "index.html"))
