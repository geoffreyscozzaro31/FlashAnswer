# src/app/service/document_service.py
import fitz  # PyMuPDF
import uuid
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from src.app.service.vector_store_service import vector_store_service
from src.app import config

async def process_document_and_embed(pdf_path: str) -> int:
    """Extracts text, splits it, and embeds it into ChromaDB."""
    # 1. Clear the previous knowledge base
    vector_store_service.clear_collection()

    # 2. Extract text from PDF with PyMuPDF (supports OCR)
    text_content = ""
    with fitz.open(pdf_path) as doc:
        for page in doc:
            text_content += page.get_text()

    if not text_content.strip():
        raise ValueError("No text could be extracted from the PDF.")

    # 3. Split the text into chunks
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
    chunks = text_splitter.split_text(text_content)

    # 4. Create embeddings
    embeddings_model = GoogleGenerativeAIEmbeddings(model=config.LLM_EMBEDDING_MODEL, google_api_key=config.GEMINI_API_KEY)
    embeddings = embeddings_model.embed_documents(chunks)

    # 5. Add to ChromaDB
    ids = [str(uuid.uuid4()) for _ in chunks]
    metadatas = [{"source": "uploaded_pdf"} for _ in chunks]
    vector_store_service.add_documents(chunks, embeddings, metadatas, ids)

    return len(chunks)