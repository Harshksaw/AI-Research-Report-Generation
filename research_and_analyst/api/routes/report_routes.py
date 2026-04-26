import os
from fastapi import APIRouter
from fastapi.responses import FileResponse

router = APIRouter()


@router.get("/download/{file_name}")
def download_report(file_name: str):
    report_dir = os.path.join(os.getcwd(), "generated_report")
    for root, _, files in os.walk(report_dir):
        if file_name in files:
            return FileResponse(
                path=os.path.join(root, file_name),
                filename=file_name,
                media_type="application/octet-stream",
            )
    return {"error": f"File {file_name} not found"}
