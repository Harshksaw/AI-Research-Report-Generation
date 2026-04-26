import uuid
from typing import Optional
from fastapi import APIRouter, Header, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from research_and_analyst.database.db_config import SessionLocal, Report, DeviceVisit
from research_and_analyst.api.services.report_service import ReportService

router = APIRouter(prefix="/api")


class VisitPayload(BaseModel):
    device_id:         str
    user_agent:        Optional[str]   = None
    platform:          Optional[str]   = None
    languages:         Optional[str]   = None
    timezone:          Optional[str]   = None
    timezone_offset:   Optional[int]   = None
    screen_width:      Optional[int]   = None
    screen_height:     Optional[int]   = None
    avail_width:       Optional[int]   = None
    avail_height:      Optional[int]   = None
    color_depth:       Optional[int]   = None
    pixel_ratio:       Optional[float] = None
    touch_points:      Optional[int]   = None
    hardware_cores:    Optional[int]   = None
    device_memory_gb:  Optional[float] = None
    connection_type:   Optional[str]   = None
    effective_type:    Optional[str]   = None
    downlink_mbps:     Optional[float] = None
    rtt_ms:            Optional[float] = None
    save_data:         Optional[bool]  = None
    webgl_vendor:      Optional[str]   = None
    webgl_renderer:    Optional[str]   = None
    canvas_fp:         Optional[str]   = None
    ua_brands:         Optional[str]   = None
    ua_mobile:         Optional[bool]  = None
    ua_platform:       Optional[str]   = None
    latitude:          Optional[float] = None
    longitude:         Optional[float] = None
    location_accuracy: Optional[float] = None


class ReportRequest(BaseModel):
    topic: str


class FeedbackRequest(BaseModel):
    thread_id: str
    feedback: str


def _device_id(x_device_id: str | None) -> str:
    if not x_device_id or not x_device_id.startswith('fp_'):
        raise HTTPException(status_code=400, detail="Missing device fingerprint")
    return x_device_id


def _get_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else ""


@router.post("/visit")
def record_visit(request: Request, body: VisitPayload):
    db = SessionLocal()
    try:
        db.add(DeviceVisit(
            device_id        = body.device_id,
            ip_address       = _get_ip(request),
            user_agent       = body.user_agent,
            platform         = body.platform,
            languages        = body.languages,
            timezone         = body.timezone,
            timezone_offset  = body.timezone_offset,
            screen_width     = body.screen_width,
            screen_height    = body.screen_height,
            avail_width      = body.avail_width,
            avail_height     = body.avail_height,
            color_depth      = body.color_depth,
            pixel_ratio      = body.pixel_ratio,
            touch_points     = body.touch_points,
            hardware_cores   = body.hardware_cores,
            device_memory_gb = body.device_memory_gb,
            connection_type  = body.connection_type,
            effective_type   = body.effective_type,
            downlink_mbps    = body.downlink_mbps,
            rtt_ms           = body.rtt_ms,
            save_data        = body.save_data,
            webgl_vendor     = body.webgl_vendor,
            webgl_renderer   = body.webgl_renderer,
            canvas_fp        = body.canvas_fp,
            ua_brands        = body.ua_brands,
            ua_mobile        = body.ua_mobile,
            ua_platform      = body.ua_platform,
            latitude         = body.latitude,
            longitude        = body.longitude,
            location_accuracy = body.location_accuracy,
        ))
        db.commit()
    finally:
        db.close()
    return {"ok": True}


@router.post("/generate_report")
async def generate_report(
    request: Request,
    body: ReportRequest,
    x_device_id: str | None = Header(default=None),
):
    device_id = _device_id(x_device_id)
    thread_id = str(uuid.uuid4())
    db = SessionLocal()
    try:
        db.add(Report(username=device_id, thread_id=thread_id, topic=body.topic))
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
async def submit_feedback(
    request: Request,
    body: FeedbackRequest,
    x_device_id: str | None = Header(default=None),
):
    _device_id(x_device_id)
    service = ReportService(checkpointer=request.app.state.checkpointer)
    return StreamingResponse(
        service.astream_feedback(body.thread_id, body.feedback),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/report_status/{thread_id}")
async def report_status(
    request: Request,
    thread_id: str,
    x_device_id: str | None = Header(default=None),
):
    _device_id(x_device_id)
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
def list_reports(x_device_id: str | None = Header(default=None)):
    device_id = _device_id(x_device_id)
    db = SessionLocal()
    try:
        rows = (
            db.query(Report)
            .filter(Report.username == device_id)
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
def report_content(
    thread_id: str,
    x_device_id: str | None = Header(default=None),
):
    _device_id(x_device_id)
    db = SessionLocal()
    try:
        report = db.query(Report).filter(Report.thread_id == thread_id).first()
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")
        return {"content": report.content or "", "topic": report.topic}
    finally:
        db.close()
