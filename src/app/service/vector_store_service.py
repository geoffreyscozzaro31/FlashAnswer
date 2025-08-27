# src/app/service/vector_store_service.py
import chromadb
from pathlib import Path
from src.app import config

class VectorStoreService:
    def __init__(self):
        self.client = None
        self.collection = None

    def initialize(self):
        db_path = Path(__file__).resolve().parent.parent / "db" / "chroma"
        self.client = chromadb.PersistentClient(path=str(db_path))
        self.collection = self.client.get_or_create_collection(name=config.VECTOR_STORE_COLLECTION)
        print("ChromaDB initialisé.")

    def add_documents(self, chunks: list[str], embeddings: list[list[float]], metadatas: list[dict], ids: list[str]):
        if self.collection is None:
            raise RuntimeError("Vector store not initialized.")
        self.collection.add(embeddings=embeddings, documents=chunks, metadatas=metadatas, ids=ids)

    def query(self, query_embedding: list[float], n_results: int = 5) -> list[str]:
        if self.collection is None:
            raise RuntimeError("Vector store not initialized.")
        results = self.collection.query(query_embeddings=[query_embedding], n_results=n_results)
        return results['documents'][0] if results and 'documents' in results else []

    def clear_collection(self):
        if self.collection:
            self.client.delete_collection(name=self.collection.name)
            self.collection = self.client.get_or_create_collection(name=config.VECTOR_STORE_COLLECTION)
            print(f"Collection '{self.collection.name}' vidée.")

vector_store_service = VectorStoreService()
