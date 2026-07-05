"""Context retrieval endpoint."""
from fastapi import APIRouter

from context_engine.context_builder import build_context

router = APIRouter()


@router.get("/context/current")
async def get_current_context():
    """Return the current desktop context with graceful Windows fallbacks."""
    return build_context()
