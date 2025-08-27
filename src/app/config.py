# src/app/config.py
import os
from pathlib import Path
from dotenv import load_dotenv
from src.app.config_loader import load_config

# Load environment variables from .env file
load_dotenv()

# Load configuration from config.yaml
_config = load_config()

# --- Application configuration ---
APP_CONFIG = _config.get("app", {})
APP_NAME = APP_CONFIG.get("name", "QCM Resolver")
APP_VERSION = APP_CONFIG.get("version", "1.0.0")

# --- Upload configuration ---
UPLOAD_CONFIG = _config.get("upload", {})
ALLOWED_PDF_EXTENSIONS = set(UPLOAD_CONFIG.get("allowed_pdf_extensions", []))
ALLOWED_IMAGE_EXTENSIONS = set(UPLOAD_CONFIG.get("allowed_image_extensions", []))

# --- LLM configuration ---
LLM_CONFIG = _config.get("llm", {})
LLM_EMBEDDING_MODEL = LLM_CONFIG.get("embedding_model", "models/embedding-001")
LLM_CHAT_MODEL = LLM_CONFIG.get("chat_model", "gemini-1.5-flash")

# --- Vector database configuration ---
VECTOR_STORE_CONFIG = _config.get("vector_store", {})
VECTOR_STORE_COLLECTION = VECTOR_STORE_CONFIG.get("collection_name", "qcm_documents")

# --- API keys (from .env file) ---
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    print("WARNING: The environment variable GEMINI_API_KEY is not set.")

# --- Application paths ---
BASE_DIR = Path(__file__).resolve().parent
DB_DIR = BASE_DIR / "db"
CHROMA_DB_PATH = DB_DIR / "chroma"

# Ensure required directories exist
DB_DIR.mkdir(exist_ok=True)
CHROMA_DB_PATH.mkdir(exist_ok=True)