import pytest
from src.app.utils.file_utils import is_allowed_file
from src.app import config

@pytest.fixture
def mock_config(monkeypatch):
    """
    Crée un "mock" de la configuration pour isoler les tests.
    Cela garantit que les tests ne dépendent pas du contenu de config.yaml.
    """
    monkeypatch.setattr(config, "ALLOWED_PDF_EXTENSIONS", {".pdf"})
    monkeypatch.setattr(config, "ALLOWED_IMAGE_EXTENSIONS", {".png", ".jpg", ".jpeg"})

def test_is_allowed_file_pdf_success(mock_config):
    """Teste qu'un fichier PDF valide est bien autorisé."""
    assert is_allowed_file("document.pdf", "pdf") is True
    assert is_allowed_file("DOCUMENT.PDF", "pdf") is True

def test_is_allowed_file_pdf_failure(mock_config):
    """Teste qu'un fichier non-PDF est bien rejeté pour le type 'pdf'."""
    assert is_allowed_file("photo.jpg", "pdf") is False
    assert is_allowed_file("document.txt", "pdf") is False

def test_is_allowed_file_image_success(mock_config):
    """Teste que les fichiers image valides sont bien autorisés."""
    assert is_allowed_file("screenshot.png", "image") is True
    assert is_allowed_file("photo.jpg", "image") is True
    assert is_allowed_file("IMAGE.JPEG", "image") is True

def test_is_allowed_file_image_failure(mock_config):
    """Teste que les fichiers non-image sont bien rejetés pour le type 'image'."""
    assert is_allowed_file("document.pdf", "image") is False
    assert is_allowed_file("archive.zip", "image") is False

def test_is_allowed_file_invalid_type(mock_config):
    """Teste qu'un type de fichier inconnu ('video') retourne toujours False."""
    assert is_allowed_file("document.pdf", "video") is False

def test_is_allowed_file_no_extension(mock_config):
    """Teste qu'un nom de fichier sans extension est bien rejeté."""
    assert is_allowed_file("monfichier", "pdf") is False
    assert is_allowed_file("monfichier", "image") is False

def test_is_allowed_file_empty_filename(mock_config):
    """Teste qu'un nom de fichier vide ou nul est bien rejeté."""
    assert is_allowed_file("", "pdf") is False
    assert is_allowed_file(None, "image") is False