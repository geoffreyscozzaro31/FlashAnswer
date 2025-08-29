import asyncio
import json
import os
from typing import List

from fastapi import APIRouter, UploadFile, File, HTTPException, status, Form

from src.app.service.document_service import process_document_and_embed
from src.app.service.qcm_vision_service import qcm_vision_analysis_service
from src.app.service.vector_store_service import vector_store_service
from src.app.utils.file_utils import is_allowed_file, save_temp_file

api_router = APIRouter()


@api_router.post("/process-document", summary="Process and embed a PDF document")
async def process_document(file: UploadFile = File(...)):
    """
    Endpoint to upload a PDF. The text is extracted, split into chunks,
    and added to the ChromaDB vector database.
    """
    if not is_allowed_file(file.filename, "pdf"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Context file type not allowed.")

    try:
        temp_path = save_temp_file(file)
        # Pass the original filename to the service for metadata
        chunk_count = await process_document_and_embed(temp_path, file.filename)
        return {"message": f"Document '{file.filename}' processed successfully. {chunk_count} segments added."}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@api_router.post("/solve-qcm", summary="Analyze a QCM screenshot and find the answer")
async def solve_qcm(context_ids: str = Form("[]"), file: UploadFile = File(...)):
    if not is_allowed_file(file.filename, "image"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Image file type not allowed.")

    temp_path = None
    try:
        doc_ids: List[str] = json.loads(context_ids)

        temp_path = save_temp_file(file)

        result = await asyncio.to_thread(
            qcm_vision_analysis_service.analyze_qcm_complete,
            image_path=temp_path,
            context_doc_ids=doc_ids
        )
        return result

    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"An internal error occurred: {e}")
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)


@api_router.get("/documents", summary="List all processed documents")
async def get_documents():
    """Endpoint to get the list of all unique documents in the knowledge base."""
    try:
        documents = vector_store_service.get_all_documents()
        return documents
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@api_router.delete("/documents/{doc_id}", summary="Delete a document and its embeddings")
async def delete_document(doc_id: str):
    """Endpoint to delete a document and all its associated chunks from the vector store."""
    try:
        success = vector_store_service.delete_document(doc_id)
        if not success:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")
        return {"message": f"Document {doc_id} deleted successfully."}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
