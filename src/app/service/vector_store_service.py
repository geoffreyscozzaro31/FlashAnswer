import chromadb
from pathlib import Path
from src.app import config
from collections import defaultdict


class VectorStoreService:
    def __init__(self):
        self.client = None
        self.collection = None

    def initialize(self):
        db_path = config.CHROMA_DB_PATH
        self.client = chromadb.PersistentClient(path=str(db_path))
        self.collection = self.client.get_or_create_collection(name=config.VECTOR_STORE_COLLECTION)
        print("ChromaDB initialized.")

    def add_documents(self, chunks: list[str], embeddings: list[list[float]], metadatas: list[dict], ids: list[str]):
        if self.collection is None:
            raise RuntimeError("Vector store not initialized.")
        self.collection.add(embeddings=embeddings, documents=chunks, metadatas=metadatas, ids=ids)

    def query(self, query_embedding: list[float], n_results: int = 5, context_doc_ids: list[str] = None) -> list[str]:
        if self.collection is None:
            raise RuntimeError("Vector store not initialized.")

        query_params = {
            "query_embeddings": [query_embedding],
            "n_results": n_results
        }

        # Add a where filter if context_doc_ids are provided
        if context_doc_ids:
            query_params["where"] = {"doc_id": {"$in": context_doc_ids}}

        results = self.collection.query(**query_params)
        return results['documents'][0] if results and 'documents' in results and results['documents'] else []

    def clear_collection(self):
        if self.collection:
            self.client.delete_collection(name=self.collection.name)
            self.collection = self.client.get_or_create_collection(name=config.VECTOR_STORE_COLLECTION)
            print(f"Collection '{self.collection.name}' cleared.")

    def get_all_documents(self) -> list[dict]:
        """Retrieves a list of unique documents from the collection's metadata."""
        if self.collection is None:
            return []

        all_metadatas = self.collection.get(include=["metadatas"])['metadatas']
        if not all_metadatas:
            return []

        documents = {}
        for meta in all_metadatas:
            doc_id = meta.get('doc_id')
            if doc_id and doc_id not in documents:
                documents[doc_id] = {"id": doc_id, "name": meta.get('source', 'Unknown Document')}

        return list(documents.values())

    def delete_document(self, doc_id: str) -> bool:
        """Deletes all chunks associated with a specific doc_id."""
        if self.collection is None:
            return False

        # Find all chunk IDs for the given document ID
        ids_to_delete = self.collection.get(where={"doc_id": doc_id})['ids']

        if not ids_to_delete:
            return False

        self.collection.delete(ids=ids_to_delete)
        return True


vector_store_service = VectorStoreService()