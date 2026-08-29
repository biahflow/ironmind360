"""Compatibility import for older worker commands."""

from app.workers.celery import celery_app

__all__ = ["celery_app"]
