import base64
import json
import time
from io import BytesIO
from typing import Dict, List, Optional

from PIL import Image
from langchain.prompts import PromptTemplate
from langchain_core.messages import HumanMessage
from langchain_google_genai import GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI

from src.app import config
from src.app.logger.logger_configuration import logger
from src.app.service.vector_store_service import vector_store_service


class QCMVisionAnalysisService:
    def __init__(self):
        if not config.GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY is missing")

        rag_prompt_text = self._load_prompt(
            config.RAG_PROMPT_FILE)
        no_rag_prompt_text = self._load_prompt(
            config.DEFAULT_PROMPT_FILE)

        self.vision_extraction_prompt = self._load_prompt(config.VISION_PROMPT_FILE)

        self.vision_llm = ChatGoogleGenerativeAI(
            model=config.VISION_MODEL,
            google_api_key=config.GEMINI_API_KEY,
        )

        self.llm = ChatGoogleGenerativeAI(
            model=config.LLM_CHAT_MODEL,
            google_api_key=config.GEMINI_API_KEY,
            temperature=config.ANSWER_TEMPERATURE
        )

        self.embeddings_model = GoogleGenerativeAIEmbeddings(
            model=config.LLM_EMBEDDING_MODEL,
            google_api_key=config.GEMINI_API_KEY
        )

        self.rag_prompt = PromptTemplate.from_template(rag_prompt_text)
        self.no_rag_prompt = PromptTemplate.from_template(no_rag_prompt_text)

    def _load_prompt(self, filename: str) -> str:
        try:
            file_path = config.PROMPT_DIR / filename
            return file_path.read_text(encoding="utf-8")
        except FileNotFoundError:
            raise FileNotFoundError(f"Prompt file not found: {filename}")
        except Exception as e:
            raise IOError(f"Error loading prompt file '{filename}': {e}")

    def analyze_qcm_complete(self, image_path: str, context_doc_ids: List[str]) -> Dict:
        total_start = time.time()

        if config.LOG_TIMINGS:
            logger.info("[qcm-ANALYSIS] === STARTING COMPLETE ANALYSIS ===")
            logger.info(f"[qcm-ANALYSIS] Image: {image_path}")
            logger.info(f"[qcm-ANALYSIS] Selected context: {context_doc_ids}")

        is_rag_active = bool(context_doc_ids)
        logger.info(f"[qcm-ANALYSIS] RAG mode is {'ACTIVE' if is_rag_active else 'INACTIVE'}")

        if config.LOG_TIMINGS:
            logger.info("[VISION] === STEP 1: VISION EXTRACTION ===")

        vision_start = time.time()
        qcm_data = self._extract_qcm_from_image(image_path)
        vision_time = time.time() - vision_start

        if not qcm_data:
            raise ValueError("Failed to extract qcm from the image")

        question = qcm_data['question']
        options = qcm_data['options']

        if config.LOG_TIMINGS:
            logger.info(f"[VISION] Finished in {vision_time:.2f}s")
            logger.info(f"[VISION] Extracted question: {question[:100]}...")
            logger.info(f"[VISION] Options: {[opt[:50] + '...' if len(opt) > 50 else opt for opt in options]}")

        context_text = ""
        rag_time = 0
        if is_rag_active:
            if config.LOG_TIMINGS:
                logger.info("[RAG] === STEP 2: CONTEXT RETRIEVAL ===")
            rag_start = time.time()
            context_text = self._retrieve_context(question, context_doc_ids)
            rag_time = time.time() - rag_start
            if config.LOG_TIMINGS:
                logger.info(f"[RAG] Finished in {rag_time:.2f}s")
                logger.info(f"[RAG] Retrieved context: {len(context_text)} characters")
        else:
            if config.LOG_TIMINGS:
                logger.info("[RAG] === STEP 2: SKIPPED (no context doc IDs) ===")

        if config.LOG_TIMINGS:
            logger.info("[ANSWER] === STEP 3: ANSWER GENERATION ===")

        answer_start = time.time()
        answer = self._generate_answer(question, options, context_text, is_rag_active)
        answer_time = time.time() - answer_start

        if config.LOG_TIMINGS:
            logger.info(f"[ANSWER] Finished in {answer_time:.2f}s")
            logger.info(f"[ANSWER] Generated answer: {answer}")

        total_time = time.time() - total_start

        result = {
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

        if config.LOG_TIMINGS:
            logger.info("[qcm-ANALYSIS] === ANALYSIS FINISHED ===")
            logger.info(f"[qcm-ANALYSIS] Total time: {total_time:.2f}s")
            logger.info(
                f"[qcm-ANALYSIS] Breakdown: Vision({vision_time:.1f}s) + RAG({rag_time:.1f}s) + Answer({answer_time:.1f}s)")

        return result

    def _extract_qcm_from_image(self, image_path: str) -> Optional[Dict]:
        try:
            image = Image.open(image_path)
            buffer = BytesIO()
            image.save(buffer, format="PNG")
            image_b64 = base64.b64encode(buffer.getvalue()).decode()
            if config.LOG_TIMINGS:
                logger.info(f"[VISION] Image loaded: {image.size} pixels")

            message = HumanMessage(
                content=[
                    {
                        "type": "text",
                        "text": self.vision_extraction_prompt,
                    },
                    {
                        "type": "image_url",
                        "image_url": f"data:image/png;base64,{image_b64}"
                    },
                ]
            )

            logger.info("[VISION] Calling Gemini Vision via LangChain...")
            response = self.vision_llm.invoke([message])
            response_text = response.content.strip()

            if config.LOG_GEMINI_RESPONSES:
                logger.info(f"[VISION] Raw Gemini response ({len(response_text)} chars):")
                logger.info(f"[VISION] {response_text}")

            cleaned_response = self._clean_json_response(response_text)
            qcm_data = json.loads(cleaned_response)

            if not self._validate_qcm_data(qcm_data):
                return None

            return qcm_data

        except Exception as e:
            logger.error(f"Vision extraction error: {e}")
            return None

    def _retrieve_context(self, question: str, context_doc_ids: List[str]) -> str:
        try:
            logger.info(f"[RAG] Generating embedding for: {question[:100]}...")

            query_embedding = self.embeddings_model.embed_query(question)

            logger.info(f"[RAG] Searching in documents: {context_doc_ids}")
            context_chunks = vector_store_service.query(
                query_embedding,
                n_results=config.RAG_CHUNKS_COUNT,
                context_doc_ids=context_doc_ids
            )

            logger.info(f"[RAG] {len(context_chunks)} chunks retrieved")

            if config.LOG_RAG_CHUNKS and context_chunks:
                for i, chunk in enumerate(context_chunks, 1):
                    logger.info(f"[RAG] Chunk {i}: {chunk[:200]}...")

            if not context_chunks:
                return "No relevant context found in the selected documents."

            context = "\n\n---\n\n".join(context_chunks)

            if len(context) > config.MAX_CONTEXT_CHARS:
                context = context[:config.MAX_CONTEXT_CHARS] + "\n\n[... context truncated ...]"
                logger.info(f"[RAG] Context truncated to {config.MAX_CONTEXT_CHARS} chars")

            return context

        except Exception as e:
            logger.error(f"Error retrieving context: {e}")
            return "Error while retrieving context."

    def _generate_answer(self, question: str, options: List[str], context: str, is_rag_active: bool) -> str:
        try:
            options_text = "\n".join([f"{i + 1}. {opt}" for i, opt in enumerate(options)])

            if is_rag_active:
                prompt_template = self.rag_prompt
                prompt_input = {
                    "question": question,
                    "options": options_text,
                    "context": context
                }
                logger.info("[ANSWER] Generating grounded answer using RAG...")
            else:
                prompt_template = self.no_rag_prompt
                prompt_input = {
                    "question": question,
                    "options": options_text
                }
                logger.info("[ANSWER] Generating estimated answer using LLM knowledge...")

            chain = prompt_template | self.llm
            response = chain.invoke(prompt_input)

            answer = response.content.strip()

            if not is_rag_active:
                answer += " (reponse generated without context)"

            if config.LOG_GEMINI_RESPONSES:
                logger.info(f"[ANSWER] Prompt sent: {question}")
                logger.info(f"[ANSWER] LLM Answer: {answer}")

            return answer

        except Exception as e:
            logger.error(f"Error generating answer: {e}")
            return "Error during answer generation."

    def _clean_json_response(self, response: str) -> str:
        response = response.strip()
        if "```json" in response:
            start = response.find("```json") + 7
            end = response.find("```", start)
            if end != -1:
                response = response[start:end].strip()
        elif "```" in response:
            start = response.find("```") + 3
            end = response.find("```", start)
            if end != -1:
                response = response[start:end].strip()

        start_idx = response.find('{')
        end_idx = response.rfind('}')

        if start_idx != -1 and end_idx != -1:
            response = response[start_idx:end_idx + 1]

        return response

    def _validate_qcm_data(self, qcm_data: Dict) -> bool:
        try:
            if 'question' not in qcm_data or 'options' not in qcm_data:
                logger.info("[VALIDATION] Error: missing keys")
                return False

            question = qcm_data['question'].strip()
            if len(question) < config.MIN_QUESTION_LENGTH:
                logger.info(f"[VALIDATION] Question too short: {len(question)} chars")
                return False

            options = qcm_data['options']
            if not isinstance(options, list) or len(options) < 2:
                logger.info(
                    f"[VALIDATION] Invalid options: {len(options) if isinstance(options, list) else 'not a list'}")
                return False

            clean_options = [opt.strip() for opt in options if opt.strip()]
            qcm_data['options'] = clean_options[:config.MAX_OPTIONS_TO_EXTRACT]

            return True

        except Exception as e:
            logger.error(f"[VALIDATION] Error: {e}")
            return False


qcm_vision_analysis_service = QCMVisionAnalysisService()