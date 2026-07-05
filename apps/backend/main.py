"""OmniAgent Backend - Phase 0 FastAPI Application."""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from storage.db import init_db
from api.health import router as health_router
from api.context import router as context_router
from api.agent import router as agent_router
from api.models import router as models_router
from api.actions import router as actions_router
from api.logs import router as logs_router
from api.workspace import router as workspace_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize resources on startup, clean up on shutdown."""
    await init_db()
    yield


app = FastAPI(
    title="OmniAgent Backend",
    version=settings.VERSION,
    lifespan=lifespan,
)

# CORS middleware - allow all origins (dev only)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include all routers
app.include_router(health_router)
app.include_router(context_router)
app.include_router(agent_router)
app.include_router(models_router)
app.include_router(actions_router)
app.include_router(logs_router)
app.include_router(workspace_router)
