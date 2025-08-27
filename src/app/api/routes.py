# src/app/api/routes.py
from fastapi import APIRouter, UploadFile, File, HTTPException, status
from src.app.service.document_service import process_document_and_embed
from src.app.service.qcm_analysis_service import analyze_qcm_screenshot
from src.app.utils.file_utils import is_allowed_file, save_temp_file

api_router = APIRouter()

@api_router.post("/process-document", summary="Process and embed a PDF document")
async def process_document(file: UploadFile = File(...)):
    """
    Endpoint to upload a PDF. The text is extracted, split into chunks,
    and stored in the ChromaDB vector database.
    """
    if not is_allowed_file(file.filename, "pdf"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="PDF file type not allowed.")

    try:
        # Temporary save for processing
        temp_path = save_temp_file(file)
        # Service that handles OCR, chunking, and embedding
        chunk_count = await process_document_and_embed(temp_path)
        return {"message": f"Document processed successfully. {chunk_count} segments added to the knowledge base."}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@api_router.post("/solve-qcm", summary="Analyze a QCM screenshot and find the answer")
async def solve_qcm(file: UploadFile = File(...)):
    """
    Endpoint to upload a QCM screenshot.
    The text is extracted via OCR, then RAG is used to find the answer.
    """
    if not is_allowed_file(file.filename, "image"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Image file type not allowed.")

    try:
        temp_path = save_temp_file(file)
        # Service that handles image analysis and answer retrieval
        result = await analyze_qcm_screenshot(temp_path)
        return result
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))