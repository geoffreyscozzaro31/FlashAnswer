# src/app/config.py
import os
from pathlib import Path
from dotenv import load_dotenv
from src.app.config_loader import load_config

# Charger les variables d'environnement du fichier .env
load_dotenv()

# Charger la configuration depuis config.yaml
_config = load_config()

# --- Configuration de l'application ---
APP_CONFIG = _config.get("app", {})
APP_NAME = APP_CONFIG.get("name", "QCM Resolver")
APP_VERSION = APP_CONFIG.get("version", "1.0.0")

# --- Configuration des uploads ---
UPLOAD_CONFIG = _config.get("upload", {})
ALLOWED_PDF_EXTENSIONS = set(UPLOAD_CONFIG.get("allowed_pdf_extensions", []))
ALLOWED_IMAGE_EXTENSIONS = set(UPLOAD_CONFIG.get("allowed_image_extensions", []))

# --- Configuration du LLM ---
LLM_CONFIG = _config.get("llm", {})
LLM_EMBEDDING_MODEL = LLM_CONFIG.get("embedding_model", "models/embedding-001")
LLM_CHAT_MODEL = LLM_CONFIG.get("chat_model", "gemini-1.5-flash")

# --- Configuration de la base de données vectorielle ---
VECTOR_STORE_CONFIG = _config.get("vector_store", {})
VECTOR_STORE_COLLECTION = VECTOR_STORE_CONFIG.get("collection_name", "qcm_documents")

# --- Clés API (depuis le fichier .env) ---
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    print("AVERTISSEMENT : La variable d'environnement GEMINI_API_KEY n'est pas définie.")

# --- Chemins de l'application ---
BASE_DIR = Path(__file__).resolve().parent
DB_DIR = BASE_DIR / "db"
CHROMA_DB_PATH = DB_DIR / "chroma"

# S'assurer que les dossiers nécessaires existent
DB_DIR.mkdir(exist_ok=True)
CHROMA_DB_PATH.mkdir(exist_ok=True)