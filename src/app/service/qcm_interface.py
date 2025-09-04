# src/app/service/qcm_interfaces.py

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import List, Optional

@dataclass
class QCMData:
    """Structure de données pour un QCM extrait."""
    question: str
    options: List[str]

class IVisionComputingService(ABC):
    """
    Interface pour les services qui extraient le contenu structuré (QCM) d'une image.
    """

    @abstractmethod
    def extract_qcm_from_image(self, image_path: str) -> Optional[QCMData]:
        """
        Analyse une image et en extrait la question et les options d'un QCM.

        Args:
            image_path: Le chemin vers le fichier image.

        Returns:
            Un objet QCMData si l'extraction réussit, sinon None.
        """
        pass