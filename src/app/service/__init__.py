# src/app/service/__init__.py

from src.app.service.llm_service import AnswerQCMService
from src.app.service.qcm_analysis_service import QCMAnalysisService
from src.app.service.vision_services import GeminiVisionService, EasyOCRVisionService
from src.app import config

answer_service = AnswerQCMService()


if config.VISION_SERVICE == "gemini":
    vision_service_to_use = GeminiVisionService()
else:
    vision_service_to_use = GeminiVisionService()
# vision_service_to_use = EasyOCRVisionService()


qcm_analysis_service = QCMAnalysisService(
    vision_service=vision_service_to_use,
    answer_service=answer_service
)