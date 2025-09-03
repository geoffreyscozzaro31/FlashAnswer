// src/app/static/js/api.js

/**
 * Handles all communication with the backend API.
 */
export class ApiService {
    async fetchDocuments() {
        const response = await fetch('/api/documents');
        if (!response.ok) throw new Error('Failed to fetch documents.');
        return response.json();
    }

    async uploadDocument(file) {
        const formData = new FormData();
        formData.append('file', file);
        const response = await fetch('/api/process-document', { method: 'POST', body: formData });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || 'Server error during document processing.');
        }
        return response.json();
    }

    async deleteDocument(docId) {
        const response = await fetch(`/api/documents/${docId}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Server error during deletion.');
    }

    async solveQcm(file, contextIds) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('context_ids', JSON.stringify(contextIds));
        const response = await fetch('/api/solve-qcm', { method: 'POST', body: formData });
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail || 'Server error during QCM solving.');
        return result;
    }
}