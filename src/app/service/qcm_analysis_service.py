import json

import easyocr
from PIL import Image
from langchain.prompts import PromptTemplate
from langchain_google_genai import GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI

from src.app import config
from src.app.service.vector_store_service import vector_store_service


async def analyze_qcm_screenshot_easyocr(image_path: str, context_doc_ids: list[str]) -> dict:
    """OCR avec EasyOCR, puis RAG pour trouver la réponse."""
    # 1. OCR avec EasyOCR
    try:
        # Initialiser EasyOCR (supporte français et anglais)
        reader = easyocr.Reader(['fr', 'en'], gpu=False)  # gpu=True si CUDA disponible

        # Lire l'image
        image = Image.open(image_path)

        # EasyOCR peut prendre directement le chemin ou un array numpy
        results = reader.readtext(image_path)

        # Extraire le texte
        raw_text = ' '.join([result[1] for result in results])

        if not raw_text.strip():
            raise ValueError("EasyOCR n'a détecté aucun texte dans l'image.")

    except Exception as e:
        raise RuntimeError(f"Erreur lors de l'OCR avec EasyOCR: {e}")

    # Le reste du code reste identique...
    llm = ChatGoogleGenerativeAI(model=config.LLM_CHAT_MODEL, google_api_key=config.GEMINI_API_KEY, temperature=0)

    extraction_prompt = PromptTemplate.from_template(
        """Extrait la question principale et les options de réponse du texte OCR suivant.\nRéponds uniquement avec un JSON contenant les clés 'question' et 'options' (une liste de chaînes).\nTEXTE OCR :\n---\n{ocr_text}\n---\nJSON :"""
    )
    extraction_chain = extraction_prompt | llm
    response_json_str = await extraction_chain.ainvoke({"ocr_text": raw_text})

    try:
        qcm_data = json.loads(response_json_str.content)
        question = qcm_data["question"]
    except (json.JSONDecodeError, KeyError):
        qcm_data = {}
        question = raw_text

    # RAG et réponse (identique au code original)
    embeddings_model = GoogleGenerativeAIEmbeddings(model=config.LLM_EMBEDDING_MODEL,
                                                    google_api_key=config.GEMINI_API_KEY)
    query_embedding = embeddings_model.embed_query(question)

    context_chunks = vector_store_service.query(query_embedding, n_results=5, context_doc_ids=context_doc_ids)
    context = "\n\n---\n\n".join(
        context_chunks) if context_chunks else "Aucun contexte pertinent trouvé dans les documents sélectionnés."

    answer_prompt = PromptTemplate.from_template(
        """Basé **uniquement** sur le CONTEXTE fourni, réponds à la QUESTION suivante.\nParmi les OPTIONS, choisis la réponse la plus précise justifiée par le contexte.\nTa réponse doit être seulement le texte de l'option correcte.\n\nCONTEXTE :\n{context}\n\nQUESTION : {question}\n\nOPTIONS :\n{options}\n\nRÉPONSE CORRECTE :"""
    )
    answer_chain = answer_prompt | llm
    response = await answer_chain.ainvoke({
        "context": context,
        "question": qcm_data.get("question", "N/A"),
        "options": "\n".join([f"- {opt}" for opt in qcm_data.get("options", [])])
    })

    return {
        "extracted_question": qcm_data.get("question", "Extraction échouée"),
        "options": qcm_data.get("options", []),
        "answer": response.content.strip(),
        "retrieved_context": context
    }
