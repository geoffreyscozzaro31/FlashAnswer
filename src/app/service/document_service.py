import uuid

import fitz  # PyMuPDF
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.embeddings import HuggingFaceEmbeddings

from src.app.config import HF_EMBEDDING_MODEL
from src.app.service.vector_store_service import vector_store_service


async def process_document_and_embed(pdf_path: str, original_filename: str) -> int:
    """Extracts text, splits it, and embeds it into ChromaDB persistently."""

    # 1. Extraire le texte du PDF
    text_content = ""
    with fitz.open(pdf_path) as doc:
        for page in doc:
            text_content += page.get_text()

    if not text_content.strip():
        raise ValueError("No text could be extracted from the PDF.")

    # 2. Diviser le texte en chunks
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
    chunks = text_splitter.split_text(text_content)

    # 3. Initialiser le modèle d'embedding
    embeddings_model = HuggingFaceEmbeddings(model_name=HF_EMBEDDING_MODEL)

    # --- ÉTAPE AJOUTÉE ---
    # 4. Générer les embeddings (vecteurs) pour chaque chunk de texte
    print("Generating embeddings for all chunks...")
    embeddings_vectors = embeddings_model.embed_documents(chunks)
    print("Embeddings generated.")

    # 5. Préparer les métadonnées et les IDs
    doc_id = str(uuid.uuid4())
    metadatas = [{"source": original_filename, "doc_id": doc_id} for _ in chunks]
    ids = [str(uuid.uuid4()) for _ in chunks]

    # --- APPEL CORRIGÉ ---
    # Maintenant, on passe la liste de vecteurs `embeddings_vectors`
    vector_store_service.add_documents(
        chunks=chunks,
        embeddings=embeddings_vectors,
        metadatas=metadatas,
        ids=ids
    )

    return len(chunks)