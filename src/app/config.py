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

# --- Application paths ---
BASE_DIR = Path(__file__).resolve().parent
DB_DIR = BASE_DIR / "db"
CHROMA_DB_PATH = DB_DIR / "chroma"

# Ensure required directories exist
DB_DIR.mkdir(exist_ok=True)
CHROMA_DB_PATH.mkdir(exist_ok=True)

# --- QCM Vision and RAG configuration ---
QCM_CONFIG = _config.get("qcm_analysis", {})

# Vision extraction
VISION_MODEL = QCM_CONFIG.get("vision_model", "gemini-1.5-flash")
MIN_QUESTION_LENGTH = QCM_CONFIG.get("min_question_length", 10)
MAX_OPTIONS_TO_EXTRACT = QCM_CONFIG.get("max_options_to_extract", 4)

# RAG settings
RAG_CHUNKS_COUNT = QCM_CONFIG.get("rag_chunks_count", 5)
RAG_SIMILARITY_THRESHOLD = QCM_CONFIG.get("rag_similarity_threshold", 0.0)

# Answer generation
ANSWER_TEMPERATURE = QCM_CONFIG.get("answer_temperature", 0.0)
MAX_CONTEXT_CHARS = QCM_CONFIG.get("max_context_chars", 3000)

# Logging
LOGGING_CONFIG = _config.get("logging", {})
LOG_GEMINI_RESPONSES = LOGGING_CONFIG.get("log_gemini_responses", True)
LOG_RAG_CHUNKS = LOGGING_CONFIG.get("log_rag_chunks", True)
LOG_TIMINGS = LOGGING_CONFIG.get("log_timings", True)

# Prompts
PROMPTS_CONFIG = _config.get("prompts", {})
PROMPT_DIR = BASE_DIR / PROMPTS_CONFIG.get("directory", "prompts")
VISION_PROMPT_FILE = PROMPTS_CONFIG.get("vision_extraction_file", "vision_extraction_prompt.txt")
ANSWER_PROMPT_FILE = PROMPTS_CONFIG.get("answer_generation_file", "answer_generation_prompt.txt")