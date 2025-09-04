# src/app/service/qcm_analysis_service.py

import time
from typing import List, Dict

from langchain_google_genai import GoogleGenerativeAIEmbeddings

from src.app import config
from src.app.logger.logger_configuration import logger
from src.app.service.llm_service import AnswerQCMService
from src.app.service.qcm_interface import IVisionComputingService
from src.app.service.vector_store_service import vector_store_service


class QCMAnalysisService:
    def __init__(
            self,
            vision_service: IVisionComputingService,
            answer_service: AnswerQCMService,
    ):
        self.vision_service = vision_service
        self.answer_service = answer_service
        self.embeddings_model = GoogleGenerativeAIEmbeddings(
            model=config.LLM_EMBEDDING_MODEL,
            google_api_key=config.GEMINI_API_KEY
        )

    def analyze_qcm_complete(self, image_path: str, context_doc_ids: List[str]) -> Dict:
        total_start = time.time()
        logger.info("[QCM-ANALYSIS] === STARTING COMPLETE ANALYSIS ===")

        # --- 1. Extraction Visuelle ---
        vision_start = time.time()
        qcm_data = self.vision_service.extract_qcm_from_image(image_path)
        vision_time = time.time() - vision_start

        if not qcm_data:
            raise ValueError("Failed to extract QCM data from the image")

        question, options = qcm_data.question, qcm_data.options
        logger.info(f"[VISION] Finished in {vision_time:.2f}s. Question: {question[:100]}...")

        # --- 2. Récupération de Contexte (RAG) ---
        rag_start = time.time()
        context_text = self._retrieve_context(question, context_doc_ids)
        rag_time = time.time() - rag_start
        logger.info(f"[RAG] Finished in {rag_time:.2f}s. Retrieved {len(context_text)} chars.")

        # --- 3. Génération de la réponse ---
        answer_start = time.time()
        answer = self.answer_service.generate_answer(question, options, context_text)
        answer_time = time.time() - answer_start
        logger.info(f"[ANSWER] Finished in {answer_time:.2f}s. Answer: {answer}")

        total_time = time.time() - total_start
        logger.info(f"[QCM-ANALYSIS] === ANALYSIS FINISHED in {total_time:.2f}s ===")

        return {
            "extracted_question": question,
            "options": options,
            "answer": answer,
            "retrieved_context": context_text,
            "timings": {
                "vision_time": round(vision_time, 2),
                "rag_time": round(rag_time, 2),
                "answer_time": round(answer_time, 2),
                "total_time": round(total_time, 2)
            }
        }

    def _retrieve_context(self, question: str, context_doc_ids: List[str]) -> str:
        # Cette méthode est identique à votre code original
        try:
            logger.info(f"[RAG] Generating embedding for: {question[:100]}...")
            query_embedding = self.embeddings_model.embed_query(question)

            context_chunks = vector_store_service.query(
                query_embedding,
                n_results=config.RAG_CHUNKS_COUNT,
                context_doc_ids=context_doc_ids
            )

            if not context_chunks:
                return "No relevant context found."

            return "\n\n---\n\n".join(context_chunks)
        except Exception as e:
            logger.error(f"Error retrieving context: {e}")
            return "Error while retrieving context."