# src/app/config_loader.py
import yaml
from pathlib import Path

def load_config(config_path: str = None) -> dict:
    """Load configuration from a YAML file."""
    if config_path is None:
        # Path to config.yaml in the same folder as this script (src/app)
        config_path = Path(__file__).parent / "config.yaml"
    else:
        config_path = Path(config_path)

    if not config_path.is_file():
        raise FileNotFoundError(f"Configuration file not found: {config_path}")

    with open(config_path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)