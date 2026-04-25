from fastapi import APIRouter, Cookie, HTTPException, Response
from pydantic import BaseModel
from research_and_analyst.database.db_config import SessionLocal, User, hash_password, verify_password
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
def generate_report(body: ReportRequest, session_id: str | None = Cookie(default=None)):
    _current_user(session_id)
    service = ReportService()
    result = service.start_report_generation(body.topic, max_analysts=3)
    return {"thread_id": result["thread_id"]}


@router.post("/submit_feedback")
def submit_feedback(body: FeedbackRequest, session_id: str | None = Cookie(default=None)):
    _current_user(session_id)
    service = ReportService()
    service.submit_feedback(body.thread_id, body.feedback)
    status = service.get_report_status(body.thread_id)
    return status


@router.get("/report_status/{thread_id}")
def report_status(thread_id: str, session_id: str | None = Cookie(default=None)):
    _current_user(session_id)
    service = ReportService()
    return service.get_report_status(thread_id)
