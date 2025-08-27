# src/app/utils/file_utils.py
import tempfile
from pathlib import Path
from fastapi import UploadFile
from src.app import config


def is_allowed_file(filename: str, file_type: str) -> bool:
    """
    Vérifie si l'extension du fichier est autorisée pour un type donné.
    file_type peut être 'pdf' ou 'image'.
    """
    if not filename or "." not in filename:
        return False

    extension = Path(filename).suffix.lower()

    if file_type == "pdf":
        return extension in config.ALLOWED_PDF_EXTENSIONS
    elif file_type == "image":
        return extension in config.ALLOWED_IMAGE_EXTENSIONS

    return False


def save_temp_file(file: UploadFile) -> str:
    """
    Sauvegarde un fichier UploadFile dans un dossier temporaire
    et retourne son chemin d'accès.
    """
    try:
        # Crée un fichier temporaire en conservant l'extension
        suffix = Path(file.filename).suffix
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            temp_file.write(file.file.read())
            return temp_file.name
    except Exception as e:
        raise IOError(f"Impossible de sauvegarder le fichier temporaire : {e}")