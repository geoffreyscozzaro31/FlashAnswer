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
    description="An application to answer QCMs from documents."
)

# Mount the 'static' folder
static_dir = BASE_DIR / "static"
app.mount("/static", StaticFiles(directory=static_dir), name="static")

# Include API routes
app.include_router(api_router, prefix="/api")

@app.on_event("startup")
def on_startup():
    # Initialize ChromaDB client at startup
    vector_store_service.initialize()

@app.get("/", response_class=FileResponse)
async def read_root():
    """Serves the application's home page."""
    return FileResponse(static_dir / "index.html")