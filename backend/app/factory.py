from fastapi import APIRouter, FastAPI
from starlette.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import lifespan
from app.errors import install_error_handlers


def create_app(router: APIRouter) -> FastAPI:
    application = FastAPI(title=settings.app_name, lifespan=lifespan)
    application.include_router(router, prefix="/api/v1")
    application.include_router(router, prefix="/api", include_in_schema=False)
    application.add_middleware(
        CORSMiddleware,
        allow_credentials=True,
        allow_origins=list(settings.cors_origins),
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
    )
    install_error_handlers(application)
    return application
