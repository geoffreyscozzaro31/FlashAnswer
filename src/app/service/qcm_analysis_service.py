# src/app/service/qcm_analysis_service.py
import pytesseract
from PIL import Image
from langchain_google_genai import GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI
from langchain.prompts import PromptTemplate
from src.app.service.vector_store_service import vector_store_service
from src.app import config


async def analyze_qcm_screenshot(image_path: str) -> dict:
    """OCR de l'image, RAG pour trouver la réponse."""
    # 1. OCR pour extraire le texte brut de l'image
    try:
        raw_text = pytesseract.image_to_string(Image.open(image_path))
        if not raw_text.strip():
            raise ValueError("OCR n'a détecté aucun texte sur l'image.")
    except Exception as e:
        raise RuntimeError(f"Erreur lors de l'OCR : {e}")

    # 2. Utiliser Gemini pour extraire la question et les options du texte brut
    llm = ChatGoogleGenerativeAI(model=config.LLM_CHAT_MODEL, google_api_key=config.GEMINI_API_KEY, temperature=0)

    extraction_prompt = PromptTemplate.from_template(
        """Extrait la question principale et les options de réponse du texte OCR suivant.
        Réponds uniquement avec un JSON contenant les clés "question" et "options" (une liste de chaînes).
        Texte OCR :
        ---
        {ocr_text}
        ---
        JSON :"""
    )
    extraction_chain = extraction_prompt | llm
    response_json_str = await extraction_chain.ainvoke({"ocr_text": raw_text})

    import json
    try:
        qcm_data = json.loads(response_json_str.content)
        question = qcm_data["question"]
    except (json.JSONDecodeError, KeyError):
        # Si le LLM échoue, on utilise le texte brut comme fallback
        question = raw_text

    # 3. RAG : Chercher les documents pertinents dans ChromaDB
    embeddings_model = GoogleGenerativeAIEmbeddings(model=config.LLM_EMBEDDING_MODEL,
                                                    google_api_key=config.GEMINI_API_KEY)
    query_embedding = embeddings_model.embed_query(question)
    context_chunks = vector_store_service.query(query_embedding, n_results=5)
    context = "\n\n---\n\n".join(context_chunks)

    # 4. Utiliser Gemini avec le contexte pour trouver la bonne réponse
    answer_prompt = PromptTemplate.from_template(
        """En te basant **uniquement** sur le CONTEXTE fourni, réponds à la QUESTION suivante.
        Parmi les OPTIONS, choisis la réponse la plus précise et justifiée par le contexte.
        Ta réponse doit être uniquement le texte de l'option correcte.

        CONTEXTE :
        {context}

        QUESTION : {question}

        OPTIONS :
        {options}

        RÉPONSE CORRECTE :"""
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