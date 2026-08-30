from io import BytesIO

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse

from app.dependencies import current_user
from app.routes.analytics import (
    consistency,
    nutrition_trends,
    personal_records,
    race_history,
    strength_progress,
    training_load,
    wellness_trends,
)
from app.services.pdf_report import generate_report_pdf

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/pdf")
async def export_pdf(
    days: int = Query(28, ge=7, le=365),
    scope: list[str] = Query(
        default=["load", "consistency", "wellness", "nutrition", "records"],
    ),
    user: dict = Depends(current_user),
):
    data: dict = {"scope": scope}
    if "load" in scope:
        data["load"] = (await training_load(days=days, user=user))["data"]
    if "consistency" in scope:
        data["consistency"] = await consistency(days=days, user=user)
    if "wellness" in scope:
        data["wellness"] = (await wellness_trends(days=days, user=user))["data"]
    if "nutrition" in scope:
        data["nutrition"] = (await nutrition_trends(days=days, user=user))["data"]
    if "records" in scope:
        data["records"] = (await personal_records(user=user))["records"]
    if "races" in scope:
        data["races"] = (await race_history(user=user))["races"]
    if "strength" in scope:
        data["strength"] = (await strength_progress(days=days, user=user))["data"]

    pdf_bytes = generate_report_pdf(data, user.get("name", "Atleta"), days=days)
    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=ironmind360_relatorio_{days}d.pdf",
        },
    )
