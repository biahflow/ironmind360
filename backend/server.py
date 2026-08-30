"""ASGI entrypoint. Domain behavior lives under the app package."""

from fastapi import APIRouter

from app.factory import create_app
from app.routes.account import router as account_router
from app.routes.auth import router as auth_router
from app.routes.coach import router as coach_router
from app.routes.files import router as files_router
from app.routes.nutrition import router as nutrition_router
from app.routes.privacy import router as privacy_router
from app.routes.profile import router as profile_router
from app.routes.races import router as races_router
from app.routes.settings import router as settings_router
from app.routes.system import router as system_router
from app.routes.wellness import router as wellness_router
from app.routes.exercises import router as exercises_router
from app.routes.workouts import router as workouts_router
from app.routes.health import router as health_router
from app.routes.fueling import router as fueling_router
from app.routes.meal_plans import router as meal_plans_router
from app.routes.nutrition_feedback import router as nutrition_feedback_router
from app.routes.ml import router as ml_router
from app.routes.equipment import router as equipment_router
from app.routes.analytics import router as analytics_router


api = APIRouter()
for router in (
    system_router,
    auth_router,
    account_router,
    files_router,
    privacy_router,
    profile_router,
    races_router,
    settings_router,
    exercises_router,
    workouts_router,
    nutrition_router,
    wellness_router,
    coach_router,
    health_router,
    meal_plans_router,
    fueling_router,
    nutrition_feedback_router,
    ml_router,
    equipment_router,
    analytics_router,
):
    api.include_router(router)

app = create_app(api)
