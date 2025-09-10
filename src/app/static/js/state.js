/**
 * Manages the application's state and notifies listeners of changes.
 * This acts as the "Model" in our architecture.
 */
export class StateManager {
    constructor() {
        this.state = {
            lang: 'en',
            uiState: 'form', // 'form', 'loading', 'error', 'success'
            documents: [],
            selectedContextIds: new Set(),
            qcmFile: null,
            lastResult: null,
            isCapturing: false, // Tracks the state of the live capture
        };
        this.listeners = [];
    }

    subscribe(listener) {
        this.listeners.push(listener);
    }

    notify() {
        this.listeners.forEach(listener => listener(this.state));
    }

    getState() {
        return { ...this.state };
    }

    setCapturing(status) {
        this.state.isCapturing = status;
        this.notify();
    }

    setLanguage(lang) {
        this.state.lang = lang;
        this.notify();
    }

    setDocuments(documents) {
        this.state.documents = documents;
        this.notify();
    }

    setUiState(state, data = null) {
        this.state.uiState = state;
        if (state === 'error') {
            this.state.errorMessage = data;
        } else if (state === 'loading') {
            this.state.loadingMessage = data;
        }
        this.notify();
    }

    setLastResult(result) {
        this.state.lastResult = result;
    }

    updateSelectedContexts(docId) {
        if (this.state.selectedContextIds.has(docId)) {
            this.state.selectedContextIds.delete(docId);
        } else {
            this.state.selectedContextIds.add(docId);
        }
        this.notify();
    }

    selectSingleContext(docId) {
        this.state.selectedContextIds.clear();
        this.state.selectedContextIds.add(docId);
        this.notify();
    }

    removeSelectedContext(docId) {
        this.state.selectedContextIds.delete(docId);
        this.notify();
    }

    resetQCM() {
        this.state.qcmFile = null;
        this.state.lastResult = null;
    }
}