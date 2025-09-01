import base64
import json
import time
import logging
from io import BytesIO
from typing import Dict, List, Optional

# import google.generativeai as genai  <-- REMOVED
from PIL import Image
from langchain_google_genai import GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI
from langchain.prompts import PromptTemplate
from langchain_core.messages import HumanMessage  # <-- ADDED

from src.app import config
from src.app.service.vector_store_service import vector_store_service

logger = logging.getLogger(__name__)

# =============================================================================
# CONFIGURATION CONSTANTS - To be moved to config.py after validation
# =============================================================================

# Vision extraction
VISION_MODEL = "gemini-1.5-flash"
MIN_QUESTION_LENGTH = 10
MAX_OPTIONS_TO_EXTRACT = 4

# RAG settings
RAG_CHUNKS_COUNT = 5
RAG_SIMILARITY_THRESHOLD = 0.0  # Minimum similarity score (0.0 = accept all)

# Answer generation
ANSWER_TEMPERATURE = 0.0
MAX_CONTEXT_CHARS = 3000  # Limit to prevent token overflow

# Logging levels
LOG_GEMINI_RESPONSES = True
LOG_RAG_CHUNKS = True
LOG_TIMINGS = True

# Prompts
VISION_EXTRACTION_PROMPT = """
Analyze this QCM image and extract ONLY:
1. The complete main question
2. The 4 answer options (A, B, C, D or 1, 2, 3, 4)

STRICT RULES:
- Completely ignore: headers, footers, page numbers, logos, watermarks, general instructions
- Ignore introductory/context text before the question if it is not the question itself
- The question must be complete and understandable
- Extract exactly 4 options, no more, no less
- If fewer than 4 options are visible, mark the missing ones as "Missing Option"

OUTPUT FORMAT - Strictly adhere to this JSON:
{
  "question": "full text of the question",
  "options": ["full option A", "full option B", "full option C", "full option D"]
}
"""

ANSWER_GENERATION_PROMPT = """
You are an expert assistant who analyzes multiple-choice questions based on a documentary context.

PROVIDED CONTEXT:
{context}

QUESTION:
{question}

AVAILABLE OPTIONS:
{options}

INSTRUCTIONS:
1. Analyze the CONTEXT to find the relevant information
2. Determine which option best matches the information in the context
3. Respond ONLY with the exact text of the correct option
4. If no option can be justified by the context, respond "Insufficient information in the context"

ANSWER:"""


class QCMVisionAnalysisService:
    """Complete qcm analysis service: Vision + RAG + Answer Generation."""

    def __init__(self):
        if not config.GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY is missing")

        self.vision_llm = ChatGoogleGenerativeAI(
            model=VISION_MODEL,
            google_api_key=config.GEMINI_API_KEY,
        )

        self.llm = ChatGoogleGenerativeAI(
            model=config.LLM_CHAT_MODEL,
            google_api_key=config.GEMINI_API_KEY,
            temperature=ANSWER_TEMPERATURE
        )

        self.embeddings_model = GoogleGenerativeAIEmbeddings(
            model=config.LLM_EMBEDDING_MODEL,
            google_api_key=config.GEMINI_API_KEY
        )

        self.answer_prompt = PromptTemplate.from_template(ANSWER_GENERATION_PROMPT)

    def analyze_qcm_complete(self, image_path: str, context_doc_ids: List[str]) -> Dict:
        """
        Complete analysis of an qcm: vision extraction + RAG + answer generation.

        Args:
            image_path: Path to the qcm image
            context_doc_ids: List of document IDs to use as context

        Returns:
            Dict with question, options, answer, and metadata
        """
        total_start = time.time()

        if LOG_TIMINGS:
            print(f"[qcm-ANALYSIS] === STARTING COMPLETE ANALYSIS ===")
            print(f"[qcm-ANALYSIS] Image: {image_path}")
            print(f"[qcm-ANALYSIS] Selected context: {context_doc_ids}")

        # 1. VISION EXTRACTION
        if LOG_TIMINGS:
            print(f"[VISION] === STEP 1: VISION EXTRACTION ===")

        vision_start = time.time()
        qcm_data = self._extract_qcm_from_image(image_path)
        vision_time = time.time() - vision_start

        if not qcm_data:
            raise ValueError("Failed to extract qcm from the image")

        question = qcm_data['question']
        options = qcm_data['options']

        if LOG_TIMINGS:
            print(f"[VISION] Finished in {vision_time:.2f}s")
            print(f"[VISION] Extracted question: {question[:100]}...")
            print(f"[VISION] Options: {[opt[:50] + '...' if len(opt) > 50 else opt for opt in options]}")

        # 2. RAG - CONTEXT RETRIEVAL
        if LOG_TIMINGS:
            print(f"[RAG] === STEP 2: CONTEXT RETRIEVAL ===")

        rag_start = time.time()
        context_text = self._retrieve_context(question, context_doc_ids)
        rag_time = time.time() - rag_start

        if LOG_TIMINGS:
            print(f"[RAG] Finished in {rag_time:.2f}s")
            print(f"[RAG] Retrieved context: {len(context_text)} characters")

        # 3. ANSWER GENERATION
        if LOG_TIMINGS:
            print(f"[ANSWER] === STEP 3: ANSWER GENERATION ===")

        answer_start = time.time()
        answer = self._generate_answer(question, options, context_text)
        answer_time = time.time() - answer_start

        if LOG_TIMINGS:
            print(f"[ANSWER] Finished in {answer_time:.2f}s")
            print(f"[ANSWER] Generated answer: {answer}")

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

        if LOG_TIMINGS:
            print(f"[qcm-ANALYSIS] === ANALYSIS FINISHED ===")
            print(f"[qcm-ANALYSIS] Total time: {total_time:.2f}s")
            print(
                f"[qcm-ANALYSIS] Breakdown: Vision({vision_time:.1f}s) + RAG({rag_time:.1f}s) + Answer({answer_time:.1f}s)")

        return result

    def _extract_qcm_from_image(self, image_path: str) -> Optional[Dict]:
        """Extracts question and options from the image via the LangChain wrapper."""
        try:
            # Load image
            image = Image.open(image_path)
            buffer = BytesIO()
            image.save(buffer, format="PNG")
            image_b64 = base64.b64encode(buffer.getvalue()).decode()
            if LOG_TIMINGS:
                print(f"[VISION] Image loaded: {image.size} pixels")

            message = HumanMessage(
                content=[
                    {
                        "type": "text",
                        "text": VISION_EXTRACTION_PROMPT,
                    },
                    {
                        "type": "image_url",
                        "image_url": f"data:image/png;base64,{image_b64}"
                    },
                ]
            )

            print(f"[VISION] Calling Gemini Vision via LangChain...")
            response = self.vision_llm.invoke([message])

            response_text = response.content.strip()

            if LOG_GEMINI_RESPONSES:
                print(f"[VISION] Raw Gemini response ({len(response_text)} chars):")
                print(f"[VISION] {response_text}")
                print(f"[VISION] === END GEMINI RESPONSE ===")

            cleaned_response = self._clean_json_response(response_text)
            qcm_data = json.loads(cleaned_response)

            if not self._validate_qcm_data(qcm_data):
                return None

            return qcm_data

        except Exception as e:
            print(f"[VISION] ERROR: {e}")
            logger.error(f"Vision extraction error: {e}")
            return None

    def _retrieve_context(self, question: str, context_doc_ids: List[str]) -> str:
        """Retrieves relevant context via RAG."""
        try:
            print(f"[RAG] Generating embedding for: {question[:100]}...")

            # Generate question embedding
            query_embedding = self.embeddings_model.embed_query(question)

            # Search in vector store
            print(f"[RAG] Searching in documents: {context_doc_ids}")
            context_chunks = vector_store_service.query(
                query_embedding,
                n_results=RAG_CHUNKS_COUNT,
                context_doc_ids=context_doc_ids
            )

            print(f"[RAG] {len(context_chunks)} chunks retrieved")

            if LOG_RAG_CHUNKS and context_chunks:
                print(f"[RAG] === RETRIEVED CHUNKS ===")
                for i, chunk in enumerate(context_chunks, 1):
                    print(f"[RAG] Chunk {i}: {chunk[:200]}...")
                print(f"[RAG] === END CHUNKS ===")

            if not context_chunks:
                return "No relevant context found in the selected documents."

            # Assemble the context
            context = "\n\n---\n\n".join(context_chunks)

            # Limit the size if necessary
            if len(context) > MAX_CONTEXT_CHARS:
                context = context[:MAX_CONTEXT_CHARS] + "\n\n[... context truncated ...]"
                print(f"[RAG] Context truncated to {MAX_CONTEXT_CHARS} chars")

            return context

        except Exception as e:
            print(f"[RAG] ERROR: {e}")
            logger.error(f"Error retrieving context: {e}")
            return "Error while retrieving context."

    def _generate_answer(self, question: str, options: List[str], context: str) -> str:
        """Generates the answer based on the context."""
        try:
            # Format the options
            options_text = "\n".join([f"{i + 1}. {opt}" for i, opt in enumerate(options)])

            # Create the prompt
            prompt_input = {
                "question": question,
                "options": options_text,
                "context": context
            }

            print(f"[ANSWER] Generating answer via LLM...")

            # Call LLM
            chain = self.answer_prompt | self.llm
            response = chain.invoke(prompt_input)

            answer = response.content.strip()

            if LOG_GEMINI_RESPONSES:
                print(f"[ANSWER] Prompt sent:")
                print(f"[ANSWER] Question: {question}")
                print(f"[ANSWER] Options: {options_text}")
                print(f"[ANSWER] Context: {context[:300]}...")
                print(f"[ANSWER] LLM Answer: {answer}")
                print(f"[ANSWER] === END LLM RESPONSE ===")

            return answer

        except Exception as e:
            print(f"[ANSWER] ERROR: {e}")
            logger.error(f"Error generating answer: {e}")
            return "Error during answer generation."

    def _clean_json_response(self, response: str) -> str:
        """Cleans the response to extract the JSON."""
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

        # Extract JSON object
        start_idx = response.find('{')
        end_idx = response.rfind('}')

        if start_idx != -1 and end_idx != -1:
            response = response[start_idx:end_idx + 1]

        return response

    def _validate_qcm_data(self, qcm_data: Dict) -> bool:
        """Validates the data extracted from the qcm."""
        try:
            if not isinstance(qcm_data, dict):
                print("[VALIDATION] Error: not a dictionary")
                return False

            if 'question' not in qcm_data or 'options' not in qcm_data:
                print("[VALIDATION] Error: missing keys")
                return False

            question = qcm_data['question'].strip()
            if len(question) < MIN_QUESTION_LENGTH:
                print(f"[VALIDATION] Question too short: {len(question)} chars")
                return False

            options = qcm_data['options']
            if not isinstance(options, list) or len(options) < 2:
                print(
                    f"[VALIDATION] Invalid options: {len(options) if isinstance(options, list) else 'not a list'}")
                return False

            clean_options = [opt.strip() for opt in options if opt.strip()]
            qcm_data['options'] = clean_options[:MAX_OPTIONS_TO_EXTRACT]

            return True

        except Exception as e:
            print(f"[VALIDATION] Error: {e}")
            return False


qcm_vision_analysis_service = QCMVisionAnalysisService()