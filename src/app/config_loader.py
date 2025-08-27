# src/app/config_loader.py
import yaml
from pathlib import Path

def load_config(config_path: str = None) -> dict:
    """Charge la configuration depuis un fichier YAML."""
    if config_path is None:
        # Chemin vers config.yaml dans le même dossier que ce script (src/app)
        config_path = Path(__file__).parent / "config.yaml"
    else:
        config_path = Path(config_path)

    if not config_path.is_file():
        raise FileNotFoundError(f"Fichier de configuration non trouvé : {config_path}")

    with open(config_path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)