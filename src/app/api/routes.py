# src/app/api/routes.py
from fastapi import APIRouter, UploadFile, File, HTTPException, status
from src.app.service.document_service import process_document_and_embed
from src.app.service.qcm_analysis_service import analyze_qcm_screenshot
from src.app.utils.file_utils import is_allowed_file, save_temp_file

api_router = APIRouter()

@api_router.post("/process-document", summary="Traite et embed un document PDF")
async def process_document(file: UploadFile = File(...)):
    """
    Endpoint pour uploader un PDF. Le texte est extrait, découpé en chunks,
    et stocké dans la base de données vectorielle ChromaDB.
    """
    if not is_allowed_file(file.filename, "pdf"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Type de fichier PDF non autorisé.")

    try:
        # Sauvegarde temporaire pour traitement
        temp_path = save_temp_file(file)
        # Service qui gère l'OCR, le chunking et l'embedding
        chunk_count = await process_document_and_embed(temp_path)
        return {"message": f"Document traité avec succès. {chunk_count} segments ajoutés à la base de connaissances."}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@api_router.post("/solve-qcm", summary="Analyse une capture d'écran de QCM et trouve la réponse")
async def solve_qcm(file: UploadFile = File(...)):
    """
    Endpoint pour uploader une capture d'écran de QCM.
    Le texte est extrait via OCR, puis le RAG est utilisé pour trouver la réponse.
    """
    if not is_allowed_file(file.filename, "image"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Type de fichier image non autorisé.")

    try:
        temp_path = save_temp_file(file)
        # Service qui gère l'analyse de l'image et la recherche de réponse
        result = await analyze_qcm_screenshot(temp_path)
        return result
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))