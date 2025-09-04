# src/app/service/vision_services.py

import base64
import json
import re
from io import BytesIO
from typing import Optional, Dict

import easyocr
from PIL import Image
from langchain_core.messages import HumanMessage
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import PromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI

from src.app import config
from src.app.logger.logger_configuration import logger
from src.app.service.qcm_interface import IVisionComputingService, QCMData



class GeminiVisionService(IVisionComputingService):
    def __init__(self):
        if not config.GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY is missing")

        self.vision_llm = ChatGoogleGenerativeAI(
            model=config.VISION_MODEL,
            google_api_key=config.GEMINI_API_KEY,
        )
        self.vision_extraction_prompt = self._load_prompt(config.VISION_PROMPT_FILE)

    def _load_prompt(self, filename: str) -> str:
        try:
            return (config.PROMPT_DIR / filename).read_text(encoding="utf-8")
        except Exception as e:
            raise IOError(f"Error loading prompt file '{filename}': {e}")

    def extract_qcm_from_image(self, image_path: str) -> Optional[QCMData]:
        try:
            image = Image.open(image_path)
            buffer = BytesIO()
            image.save(buffer, format="PNG")
            image_b64 = base64.b64encode(buffer.getvalue()).decode()
            logger.info(f"[VISION-GEMINI] Image loaded: {image.size} pixels")

            message = HumanMessage(
                content=[
                    {"type": "text", "text": self.vision_extraction_prompt},
                    {"type": "image_url", "image_url": f"data:image/png;base64,{image_b64}"},
                ]
            )

            logger.info("[VISION-GEMINI] Calling Gemini Vision API...")
            response = self.vision_llm.invoke([message])
            cleaned_response = self._clean_json_response(response.content)
            qcm_dict = json.loads(cleaned_response)

            if self._validate_qcm_data(qcm_dict):
                return QCMData(question=qcm_dict['question'], options=qcm_dict['options'])

            return None

        except Exception as e:
            logger.error(f"[VISION-GEMINI] Extraction error: {e}")
            return None

    def _clean_json_response(self, response: str) -> str:
        # Votre code de nettoyage de JSON reste ici
        match = re.search(r'\{.*\}', response, re.DOTALL)
        if match:
            return match.group(0)
        return ""

    def _validate_qcm_data(self, qcm_data: Dict) -> bool:
        # Votre code de validation reste ici
        if 'question' not in qcm_data or 'options' not in qcm_data:
            return False
        if not isinstance(qcm_data['options'], list) or len(qcm_data['options']) < 2:
            return False
        return True


class EasyOCRVisionService(IVisionComputingService):
    def __init__(self):
        # 1. Initialisation d'EasyOCR pour l'extraction de texte
        logger.info("[VISION-HYBRID] Initializing EasyOCR Reader...")
        self.reader = easyocr.Reader(['fr', 'en'], gpu=False)

        self.llm = ChatGoogleGenerativeAI(
            model=config.LLM_CHAT_MODEL,  # On utilise un modèle de chat standard
            google_api_key=config.GEMINI_API_KEY,
            temperature=0.1  # Basse température pour une sortie structurée et prévisible
        )

        # 3. Définition du prompt pour la structuration
        self.structuring_prompt_template = """
        Analyze the following text extracted from a QCM and extract ONLY:
        1. The complete main question
        2. All the answer options provided

        STRICT RULES:
        - Completely ignore any text that looks like: headers, footers, page numbers, logos, or general instructions.
        - The question must be complete and understandable.
        - Extract all available options.

        OUTPUT FORMAT - Strictly adhere to this JSON format:
        {{
          "question": "The full text of the question",
          "options": ["Full option A", "Full option B", "Full option C", "Full option D"]
        }}

        Here is the raw text extracted via OCR:
        ---
        {ocr_text}
        ---
        """

        # 4. Création de la chaîne LangChain
        self.structuring_chain = (
                PromptTemplate.from_template(self.structuring_prompt_template)
                | self.llm
                | StrOutputParser()
        )

    def extract_qcm_from_image(self, image_path: str) -> Optional[QCMData]:
        # --- Étape 1: Extraction du texte brut avec EasyOCR ---
        logger.info(f"[VISION-HYBRID] Reading text from image with EasyOCR: {image_path}")
        try:
            results = self.reader.readtext(image_path,
                                           paragraph=False)  # False est souvent mieux pour garder les sauts de ligne
            if not results:
                logger.warning("[VISION-HYBRID] No text found in the image by EasyOCR.")
                return None

            # Concaténer tous les blocs de texte reconnus
            full_text = [" \n".join(result[1]) for result in results] #todo: to improve
        except Exception as e:
            logger.error(f"[VISION-HYBRID] EasyOCR failed: {e}")
            return None

        # --- Étape 2: Structuration du texte avec Gemini LLM ---
        logger.info("[VISION-HYBRID] Structuring extracted text with Gemini...")
        try:
            response_text = self.structuring_chain.invoke({"ocr_text": full_text})

            cleaned_response = self._clean_json_response(response_text)
            if not cleaned_response:
                logger.error("[VISION-HYBRID] LLM response was empty after cleaning.")
                return None

            qcm_dict = json.loads(cleaned_response)

            if self._validate_qcm_data(qcm_dict):
                logger.info("[VISION-HYBRID] Successfully structured QCM data.")
                return QCMData(question=qcm_dict['question'], options=qcm_dict['options'])
            else:
                logger.warning("[VISION-HYBRID] Structured data validation failed.")
                return None

        except Exception as e:
            logger.error(f"[VISION-HYBRID] LLM structuring failed: {e}")
            return None


    def _clean_json_response(self, response: str) -> str:
        """Nettoie la sortie du LLM pour n'extraire que le JSON valide."""
        # Trouve le JSON contenu dans les blocs de code markdown ```json ... ```
        match = re.search(r'```json\s*(\{.*?\})\s*```', response, re.DOTALL)
        if match:
            return match.group(1)

        match = re.search(r'\{.*\}', response, re.DOTALL)
        if match:
            return match.group(0)

        return ""

    def _validate_qcm_data(self, qcm_data: Dict) -> bool:
        """Valide la structure du dictionnaire QCM."""
        if 'question' not in qcm_data or 'options' not in qcm_data:
            logger.warning("[VALIDATION] Missing 'question' or 'options' key.")
            return False
        if not isinstance(qcm_data['options'], list) or len(qcm_data['options']) < 2:
            logger.warning(f"[VALIDATION] 'options' is not a list or has less than 2 items: {qcm_data['options']}")
            return False
        return True