# src/app/app.py
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path

from src.app.api.routes import api_router
from src.app.service.vector_store_service import vector_store_service

BASE_DIR = Path(__file__).resolve().parent

app = FastAPI(
    title="QCM Resolver",
    description="Une application pour répondre aux QCM à partir de documents."
)

# Monter le dossier 'static'
static_dir = BASE_DIR / "static"
app.mount("/static", StaticFiles(directory=static_dir), name="static")

# Inclure les routes de l'API
app.include_router(api_router, prefix="/api")

@app.on_event("startup")
def on_startup():
    # Initialise le client ChromaDB au démarrage
    vector_store_service.initialize()

@app.get("/", response_class=FileResponse)
async def read_root():
    """Sert la page d'accueil de l'application."""
    return FileResponse(static_dir / "index.html")