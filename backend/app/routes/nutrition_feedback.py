from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query

from app.database import db
from app.dependencies import current_user
from app.models.feedback import NutritionFeedbackIn, SupplementFeedbackIn
from app.utils.time import now_utc

router = APIRouter(prefix="/nutrition-feedback", tags=["nutrition-feedback"])


@router.post("/supplement")
async def log_supplement_feedback(
    data: SupplementFeedbackIn,
    user: dict = Depends(current_user),
):
    user_id = str(user["_id"])
    feedback = {
        "user_id": user_id,
        **data.model_dump(),
        "action": None,
        "action_accepted": None,
        "created_at": now_utc(),
    }
    result = await db.nutrition_feedback.insert_one(feedback)
    feedback.pop("_id", None)
    feedback["id"] = str(result.inserted_id)
    return feedback


@router.post("/meal-plan")
async def log_meal_plan_feedback(
    data: NutritionFeedbackIn,
    user: dict = Depends(current_user),
):
    user_id = str(user["_id"])
    feedback = {
        "user_id": user_id,
        "type": "meal_plan",
        **data.model_dump(),
        "action": None,
        "action_accepted": None,
        "created_at": now_utc(),
    }
    result = await db.nutrition_feedback.insert_one(feedback)
    feedback.pop("_id", None)
    feedback["id"] = str(result.inserted_id)
    return feedback


@router.get("")
async def list_feedback(
    limit: int = Query(default=20, ge=1, le=100),
    user: dict = Depends(current_user),
):
    feedbacks = await db.nutrition_feedback.find(
        {"user_id": str(user["_id"])}
    ).sort("created_at", -1).to_list(limit)
    for f in feedbacks:
        f["id"] = str(f.pop("_id"))
    return {"feedbacks": feedbacks}


@router.post("/{feedback_id}/accept")
async def accept_action(
    feedback_id: str,
    user: dict = Depends(current_user),
):
    if not ObjectId.is_valid(feedback_id):
        raise HTTPException(404, "Feedback nao encontrado")
    result = await db.nutrition_feedback.update_one(
        {"_id": ObjectId(feedback_id), "user_id": str(user["_id"])},
        {"$set": {"action_accepted": True, "accepted_at": now_utc()}},
    )
    if result.modified_count == 0:
        raise HTTPException(404, "Feedback nao encontrado")
    return {"ok": True}


@router.post("/{feedback_id}/reject")
async def reject_action(
    feedback_id: str,
    user: dict = Depends(current_user),
):
    if not ObjectId.is_valid(feedback_id):
        raise HTTPException(404, "Feedback nao encontrado")
    result = await db.nutrition_feedback.update_one(
        {"_id": ObjectId(feedback_id), "user_id": str(user["_id"])},
        {"$set": {"action_accepted": False, "rejected_at": now_utc()}},
    )
    if result.modified_count == 0:
        raise HTTPException(404, "Feedback nao encontrado")
    return {"ok": True}
