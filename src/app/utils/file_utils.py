# src/app/utils/file_utils.py
import tempfile
from pathlib import Path
from fastapi import UploadFile
from src.app import config


def is_allowed_file(filename: str, file_type: str) -> bool:
    """
    Checks if the file extension is allowed for a given type.
    file_type can be 'pdf' or 'image'.
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
    Saves an UploadFile to a temporary folder and returns its path.
    """
    try:
        # Create a temporary file while keeping the extension
        suffix = Path(file.filename).suffix
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            temp_file.write(file.file.read())
            return temp_file.name
    except Exception as e:
        raise IOError(f"Unable to save temporary file: {e}")
