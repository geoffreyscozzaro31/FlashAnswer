# src/app/service/qcm_analysis_service.py
import pytesseract
from PIL import Image
from langchain_google_genai import GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI
from langchain.prompts import PromptTemplate
from src.app.service.vector_store_service import vector_store_service
from src.app import config


async def analyze_qcm_screenshot(image_path: str) -> dict:
    """OCR the image, RAG to find the answer."""
    # 1. OCR to extract raw text from the image
    try:
        raw_text = pytesseract.image_to_string(Image.open(image_path))
        if not raw_text.strip():
            raise ValueError("OCR did not detect any text on the image.")
    except Exception as e:
        raise RuntimeError(f"Error during OCR: {e}")

    # 2. Use Gemini to extract the question and options from the raw text
    llm = ChatGoogleGenerativeAI(model=config.LLM_CHAT_MODEL, google_api_key=config.GEMINI_API_KEY, temperature=0)

    extraction_prompt = PromptTemplate.from_template(
        """Extract the main question and answer options from the following OCR text.\nRespond only with a JSON containing the keys 'question' and 'options' (a list of strings).\nOCR TEXT :\n---\n{ocr_text}\n---\nJSON :"""
    )
    extraction_chain = extraction_prompt | llm
    response_json_str = await extraction_chain.ainvoke({"ocr_text": raw_text})

    import json
    try:
        qcm_data = json.loads(response_json_str.content)
        question = qcm_data["question"]
    except (json.JSONDecodeError, KeyError):
        # If the LLM fails, use the raw text as fallback
        question = raw_text

    # 3. RAG: Search for relevant documents in ChromaDB
    embeddings_model = GoogleGenerativeAIEmbeddings(model=config.LLM_EMBEDDING_MODEL,
                                                    google_api_key=config.GEMINI_API_KEY)
    query_embedding = embeddings_model.embed_query(question)
    context_chunks = vector_store_service.query(query_embedding, n_results=5)
    context = "\n\n---\n\n".join(context_chunks)

    # 4. Use Gemini with the context to find the correct answer
    answer_prompt = PromptTemplate.from_template(
        """Based **only** on the provided CONTEXT, answer the following QUESTION.\nAmong the OPTIONS, choose the most accurate answer justified by the context.\nYour answer must be only the text of the correct option.\n\nCONTEXT :\n{context}\n\nQUESTION : {question}\n\nOPTIONS :\n{options}\n\nCORRECT ANSWER :"""
    )
    answer_chain = answer_prompt | llm
    response = await answer_chain.ainvoke({
        "context": context,
        "question": qcm_data.get("question", "N/A"),
        "options": "\n".join([f"- {opt}" for opt in qcm_data.get("options", [])])
    })

    return {
        "extracted_question": qcm_data.get("question", "Extraction failed"),
        "options": qcm_data.get("options", []),
        "answer": response.content.strip(),
        "retrieved_context": context
    }