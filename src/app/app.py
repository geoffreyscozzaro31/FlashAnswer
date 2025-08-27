# src/app/app.py
import uvicorn
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path
from contextlib import asynccontextmanager

from src.app.api.routes import api_router
from src.app.service.vector_store_service import vector_store_service

BASE_DIR = Path(__file__).resolve().parent
static_dir = BASE_DIR / "static"

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialisation au démarrage
    vector_store_service.initialize()
    yield
    # Code de nettoyage si nécessaire

app = FastAPI(
    title="QCM Resolver",
    description="An application to answer QCMs from documents.",
    lifespan=lifespan
)

# Mount the 'static' folder
app.mount("/static", StaticFiles(directory=static_dir), name="static")

# Include API routes
app.include_router(api_router, prefix="/api")

@app.get("/", response_class=FileResponse, summary="Serves the main page")
async def read_root():
    """Serves the application's home page."""
    return FileResponse(static_dir / "index.html")


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
