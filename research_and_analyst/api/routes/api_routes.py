import uuid
from fastapi import APIRouter, Cookie, HTTPException, Request, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from research_and_analyst.database.db_config import SessionLocal, User, Report, hash_password, verify_password
from research_and_analyst.api.services.report_service import ReportService

router = APIRouter(prefix="/api")

SESSIONS: dict[str, str] = {}


class AuthRequest(BaseModel):
    username: str
    password: str


class ReportRequest(BaseModel):
    topic: str


class FeedbackRequest(BaseModel):
    thread_id: str
    feedback: str


def _current_user(session_id: str | None) -> str:
    if not session_id or session_id not in SESSIONS:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return SESSIONS[session_id]


@router.get("/me")
def me(session_id: str | None = Cookie(default=None)):
    username = _current_user(session_id)
    return {"username": username}


@router.post("/login")
def login(body: AuthRequest, response: Response):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == body.username).first()
    finally:
        db.close()

    if not user or not verify_password(body.password, user.password):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    session_id = f"{body.username}_session"
    SESSIONS[session_id] = body.username
    response.set_cookie(key="session_id", value=session_id, httponly=True, samesite="lax")
    return {"username": body.username}


@router.post("/signup")
def signup(body: AuthRequest):
    if len(body.password) > 72:
        raise HTTPException(status_code=422, detail="Password cannot exceed 72 characters")

    db = SessionLocal()
    try:
        if db.query(User).filter(User.username == body.username).first():
            raise HTTPException(status_code=409, detail="Username already exists")
        db.add(User(username=body.username, password=hash_password(body.password)))
        db.commit()
    finally:
        db.close()

    return {"message": "Account created"}


@router.post("/logout")
def logout(response: Response, session_id: str | None = Cookie(default=None)):
    if session_id:
        SESSIONS.pop(session_id, None)
    response.delete_cookie("session_id")
    return {"message": "Logged out"}


@router.post("/generate_report")
async def generate_report(request: Request, body: ReportRequest, session_id: str | None = Cookie(default=None)):
    username = _current_user(session_id)
    thread_id = str(uuid.uuid4())
    db = SessionLocal()
    try:
        db.add(Report(username=username, thread_id=thread_id, topic=body.topic))
        db.commit()
    finally:
        db.close()
    service = ReportService(checkpointer=request.app.state.checkpointer)
    return StreamingResponse(
        service.astream_report_generation(body.topic, max_analysts=3, thread_id=thread_id),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/submit_feedback")
async def submit_feedback(request: Request, body: FeedbackRequest, session_id: str | None = Cookie(default=None)):
    _current_user(session_id)
    service = ReportService(checkpointer=request.app.state.checkpointer)
    return StreamingResponse(
        service.astream_feedback(body.thread_id, body.feedback),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/report_status/{thread_id}")
async def report_status(request: Request, thread_id: str, session_id: str | None = Cookie(default=None)):
    _current_user(session_id)
    service = ReportService(checkpointer=request.app.state.checkpointer)
    result = await service.get_report_status(thread_id)
    if result.get("status") == "completed":
        db = SessionLocal()
        try:
            report = db.query(Report).filter(Report.thread_id == thread_id).first()
            if report:
                report.status    = "completed"
                report.content   = result.get("content", "")
                report.docx_path = result["docx_path"]
                report.pdf_path  = result["pdf_path"]
                db.commit()
        finally:
            db.close()
    return result


@router.get("/reports")
def list_reports(session_id: str | None = Cookie(default=None)):
    username = _current_user(session_id)
    db = SessionLocal()
    try:
        rows = (
            db.query(Report)
            .filter(Report.username == username)
            .order_by(Report.created_at.desc())
            .all()
        )
        return [
            {
                "thread_id":  r.thread_id,
                "topic":      r.topic,
                "status":     r.status,
                "created_at": r.created_at.isoformat(),
                "docx_path":  r.docx_path,
                "pdf_path":   r.pdf_path,
            }
            for r in rows
        ]
    finally:
        db.close()


@router.get("/report_content/{thread_id}")
def report_content(thread_id: str, session_id: str | None = Cookie(default=None)):
    _current_user(session_id)
    db = SessionLocal()
    try:
        report = db.query(Report).filter(Report.thread_id == thread_id).first()
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")
        return {"content": report.content or "", "topic": report.topic}
    finally:
        db.close()
