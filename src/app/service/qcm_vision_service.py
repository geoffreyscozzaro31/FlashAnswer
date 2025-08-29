# service/qcm_vision_analysis_service.py
import base64
import json
import time
import logging
from io import BytesIO
from typing import Dict, List, Optional

# import google.generativeai as genai  <-- SUPPRIMÉ
from PIL import Image
from langchain_google_genai import GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI
from langchain.prompts import PromptTemplate
from langchain_core.messages import HumanMessage  # <-- AJOUTÉ

from src.app import config
from src.app.service.vector_store_service import vector_store_service

logger = logging.getLogger(__name__)

# =============================================================================
# CONFIGURATION CONSTANTS - À déplacer dans config.py après validation
# =============================================================================

# Vision extraction
VISION_MODEL = "gemini-2.5-flash"
MIN_QUESTION_LENGTH = 10
MAX_OPTIONS_TO_EXTRACT = 4

# RAG settings
RAG_CHUNKS_COUNT = 5
RAG_SIMILARITY_THRESHOLD = 0.0  # Minimum similarity score (0.0 = accept all)

# Answer generation
ANSWER_TEMPERATURE = 0.0
MAX_CONTEXT_CHARS = 3000  # Limite pour éviter tokens overflow

# Logging levels
LOG_GEMINI_RESPONSES = True
LOG_RAG_CHUNKS = True
LOG_TIMINGS = True

# Prompts
VISION_EXTRACTION_PROMPT = """
Analyse cette image de QCM et extrait UNIQUEMENT :
1. La question principale complète
2. Les 4 options de réponse (A, B, C, D ou 1, 2, 3, 4)

RÈGLES STRICTES :
- Ignore complètement : headers, footers, numéros de page, logos, watermarks, instructions générales
- Ignore le texte d'introduction/contexte avant la question si ce n'est pas la question elle-même
- La question doit être complète et compréhensible
- Extrait exactement 4 options, pas plus, pas moins
- Si moins de 4 options visibles, marque les manquantes comme "Option manquante"

FORMAT DE SORTIE - Respecte exactement ce JSON :
{
  "question": "texte complet de la question",
  "options": ["option A complète", "option B complète", "option C complète", "option D complète"]
}
"""

ANSWER_GENERATION_PROMPT = """
Tu es un assistant expert qui analyse des QCM basés sur un contexte documentaire.

CONTEXTE FOURNI :
{context}

QUESTION :
{question}

OPTIONS DISPONIBLES :
{options}

INSTRUCTIONS :
1. Analyse le CONTEXTE pour trouver les informations pertinentes
2. Détermine quelle option correspond le mieux aux informations du contexte
3. Réponds UNIQUEMENT avec le texte exact de l'option correcte
4. Si aucune option ne peut être justifiée par le contexte, réponds "Informations insuffisantes dans le contexte"

RÉPONSE :"""


class QCMVisionAnalysisService:
    """Service complet d'analyse de QCM : Vision + RAG + Génération de réponse."""

    def __init__(self):
        if not config.GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY manquante")

        # MODIFIÉ : Utilisation de ChatGoogleGenerativeAI pour le modèle vision
        self.vision_llm = ChatGoogleGenerativeAI(
            model=VISION_MODEL,
            google_api_key=config.GEMINI_API_KEY,
        )

        # LLM pour génération de réponse (inchangé)
        self.llm = ChatGoogleGenerativeAI(
            model=config.LLM_CHAT_MODEL,
            google_api_key=config.GEMINI_API_KEY,
            temperature=ANSWER_TEMPERATURE
        )

        # Embeddings pour RAG (inchangé)
        self.embeddings_model = GoogleGenerativeAIEmbeddings(
            model=config.LLM_EMBEDDING_MODEL,
            google_api_key=config.GEMINI_API_KEY
        )

        self.answer_prompt = PromptTemplate.from_template(ANSWER_GENERATION_PROMPT)

    def analyze_qcm_complete(self, image_path: str, context_doc_ids: List[str]) -> Dict:
        """
        Analyse complète d'un QCM : extraction vision + RAG + génération réponse.

        Args:
            image_path: Chemin vers l'image du QCM
            context_doc_ids: Liste des IDs de documents à utiliser comme contexte

        Returns:
            Dict avec question, options, réponse et métadonnées
        """
        total_start = time.time()

        if LOG_TIMINGS:
            print(f"[QCM-ANALYSIS] === DÉBUT ANALYSE COMPLÈTE ===")
            print(f"[QCM-ANALYSIS] Image: {image_path}")
            print(f"[QCM-ANALYSIS] Contexte sélectionné: {context_doc_ids}")

        # 1. EXTRACTION VISION
        if LOG_TIMINGS:
            print(f"[VISION] === ÉTAPE 1: EXTRACTION VISION ===")

        vision_start = time.time()
        qcm_data = self._extract_qcm_from_image(image_path)
        vision_time = time.time() - vision_start

        if not qcm_data:
            raise ValueError("Échec extraction du QCM depuis l'image")

        question = qcm_data['question']
        options = qcm_data['options']

        if LOG_TIMINGS:
            print(f"[VISION] Terminé en {vision_time:.2f}s")
            print(f"[VISION] Question extraite: {question[:100]}...")
            print(f"[VISION] Options: {[opt[:50] + '...' if len(opt) > 50 else opt for opt in options]}")

        # 2. RAG - RÉCUPÉRATION CONTEXTE
        if LOG_TIMINGS:
            print(f"[RAG] === ÉTAPE 2: RÉCUPÉRATION CONTEXTE ===")

        rag_start = time.time()
        context_text = self._retrieve_context(question, context_doc_ids)
        rag_time = time.time() - rag_start

        if LOG_TIMINGS:
            print(f"[RAG] Terminé en {rag_time:.2f}s")
            print(f"[RAG] Contexte récupéré: {len(context_text)} caractères")

        # 3. GÉNÉRATION RÉPONSE
        if LOG_TIMINGS:
            print(f"[ANSWER] === ÉTAPE 3: GÉNÉRATION RÉPONSE ===")

        answer_start = time.time()
        answer = self._generate_answer(question, options, context_text)
        answer_time = time.time() - answer_start

        if LOG_TIMINGS:
            print(f"[ANSWER] Terminé en {answer_time:.2f}s")
            print(f"[ANSWER] Réponse générée: {answer}")

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
            print(f"[QCM-ANALYSIS] === ANALYSE TERMINÉE ===")
            print(f"[QCM-ANALYSIS] Temps total: {total_time:.2f}s")
            print(
                f"[QCM-ANALYSIS] Breakdown: Vision({vision_time:.1f}s) + RAG({rag_time:.1f}s) + Answer({answer_time:.1f}s)")

        return result

    def _extract_qcm_from_image(self, image_path: str) -> Optional[Dict]:
        """Extrait question et options depuis l'image via le wrapper LangChain."""
        try:
            # Charger image
            image = Image.open(image_path)
            buffer = BytesIO()
            image.save(buffer, format="PNG")
            image_b64 = base64.b64encode(buffer.getvalue()).decode()
            if LOG_TIMINGS:
                print(f"[VISION] Image chargée: {image.size} pixels")

            # MODIFIÉ : Création d'un message multimodal pour LangChain
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

            # MODIFIÉ : Appel via la méthode invoke de LangChain
            print(f"[VISION] Appel Gemini Vision via LangChain...")
            response = self.vision_llm.invoke([message])

            # MODIFIÉ : La réponse est dans l'attribut .content
            response_text = response.content.strip()

            if LOG_GEMINI_RESPONSES:
                print(f"[VISION] Réponse Gemini brute ({len(response_text)} chars):")
                print(f"[VISION] {response_text}")
                print(f"[VISION] === FIN RÉPONSE GEMINI ===")

            # Parser JSON (inchangé)
            cleaned_response = self._clean_json_response(response_text)
            qcm_data = json.loads(cleaned_response)

            # Validation (inchangée)
            if not self._validate_qcm_data(qcm_data):
                return None

            return qcm_data

        except Exception as e:
            print(f"[VISION] ERREUR: {e}")
            logger.error(f"Erreur extraction vision: {e}")
            return None

    def _retrieve_context(self, question: str, context_doc_ids: List[str]) -> str:
        """Récupère le contexte pertinent via RAG."""
        try:
            print(f"[RAG] Génération embedding pour: {question[:100]}...")

            # Générer embedding de la question
            query_embedding = self.embeddings_model.embed_query(question)

            # Recherche dans vector store
            print(f"[RAG] Recherche dans documents: {context_doc_ids}")
            context_chunks = vector_store_service.query(
                query_embedding,
                n_results=RAG_CHUNKS_COUNT,
                context_doc_ids=context_doc_ids
            )

            print(f"[RAG] {len(context_chunks)} chunks récupérés")

            if LOG_RAG_CHUNKS and context_chunks:
                print(f"[RAG] === CHUNKS RÉCUPÉRÉS ===")
                for i, chunk in enumerate(context_chunks, 1):
                    print(f"[RAG] Chunk {i}: {chunk[:200]}...")
                print(f"[RAG] === FIN CHUNKS ===")

            if not context_chunks:
                return "Aucun contexte pertinent trouvé dans les documents sélectionnés."

            # Assembler le contexte
            context = "\n\n---\n\n".join(context_chunks)

            # Limiter la taille si nécessaire
            if len(context) > MAX_CONTEXT_CHARS:
                context = context[:MAX_CONTEXT_CHARS] + "\n\n[... contexte tronqué ...]"
                print(f"[RAG] Contexte tronqué à {MAX_CONTEXT_CHARS} chars")

            return context

        except Exception as e:
            print(f"[RAG] ERREUR: {e}")
            logger.error(f"Erreur récupération contexte: {e}")
            return "Erreur lors de la récupération du contexte."

    def _generate_answer(self, question: str, options: List[str], context: str) -> str:
        """Génère la réponse basée sur le contexte."""
        try:
            # Formater les options
            options_text = "\n".join([f"{i + 1}. {opt}" for i, opt in enumerate(options)])

            # Créer le prompt
            prompt_input = {
                "question": question,
                "options": options_text,
                "context": context
            }

            print(f"[ANSWER] Génération réponse via LLM...")

            # Appel LLM
            chain = self.answer_prompt | self.llm
            response = chain.invoke(prompt_input)

            answer = response.content.strip()

            if LOG_GEMINI_RESPONSES:
                print(f"[ANSWER] Prompt envoyé:")
                print(f"[ANSWER] Question: {question}")
                print(f"[ANSWER] Options: {options_text}")
                print(f"[ANSWER] Contexte: {context[:300]}...")
                print(f"[ANSWER] Réponse LLM: {answer}")
                print(f"[ANSWER] === FIN RÉPONSE LLM ===")

            return answer

        except Exception as e:
            print(f"[ANSWER] ERREUR: {e}")
            logger.error(f"Erreur génération réponse: {e}")
            return "Erreur lors de la génération de la réponse."

    def _clean_json_response(self, response: str) -> str:
        """Nettoie la réponse pour extraire le JSON."""
        response = response.strip()

        # Supprimer markdown
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

        # Extraire JSON
        start_idx = response.find('{')
        end_idx = response.rfind('}')

        if start_idx != -1 and end_idx != -1:
            response = response[start_idx:end_idx + 1]

        return response

    def _validate_qcm_data(self, qcm_data: Dict) -> bool:
        """Valide les données extraites du QCM."""
        try:
            if not isinstance(qcm_data, dict):
                print("[VALIDATION] Erreur: pas un dictionnaire")
                return False

            if 'question' not in qcm_data or 'options' not in qcm_data:
                print("[VALIDATION] Erreur: clés manquantes")
                return False

            question = qcm_data['question'].strip()
            if len(question) < MIN_QUESTION_LENGTH:
                print(f"[VALIDATION] Question trop courte: {len(question)} chars")
                return False

            options = qcm_data['options']
            if not isinstance(options, list) or len(options) < 2:
                print(
                    f"[VALIDATION] Options invalides: {len(options) if isinstance(options, list) else 'pas une liste'}")
                return False

            # Nettoyer et limiter les options
            clean_options = [opt.strip() for opt in options if opt.strip()]
            qcm_data['options'] = clean_options[:MAX_OPTIONS_TO_EXTRACT]

            return True

        except Exception as e:
            print(f"[VALIDATION] Erreur: {e}")
            return False


# Instance singleton
qcm_vision_analysis_service = QCMVisionAnalysisService()