from fastapi import APIRouter


router = APIRouter(tags=["system"])


@router.get("/")
async def root():
    return {"message": "IronMind 360 API", "status": "operational"}
