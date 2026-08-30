import asyncio

from app.workers.celery import celery_app


@celery_app.task(name="ironmind.process_health_document", bind=True, max_retries=2)
def process_health_document(self, doc_id: str, user_id: str) -> dict:
    try:
        from app.services.health import process_document_extraction
        asyncio.run(process_document_extraction(doc_id, user_id))
        return {"status": "ok", "doc_id": doc_id}
    except Exception as exc:
        raise self.retry(exc=exc, countdown=30)
