// src/app/static/js/state.js

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
        };
        this.listeners = [];
    }

    /**
     * Subscribe a listener function to be called on state changes.
     * @param {Function} listener - The callback function.
     */
    subscribe(listener) {
        this.listeners.push(listener);
    }

    /**
     * Notifies all subscribed listeners about a state change.
     */
    notify() {
        this.listeners.forEach(listener => listener(this.state));
    }

    getState() {
        return { ...this.state };
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
        // No notify, as setUiState('success') will trigger the render.
    }

    updateSelectedContexts(docId) {
        if (this.state.selectedContextIds.has(docId)) {
            this.state.selectedContextIds.delete(docId);
        } else {
            this.state.selectedContextIds.add(docId);
        }
        this.notify();
    }

    removeSelectedContext(docId) {
        this.state.selectedContextIds.delete(docId);
        this.notify();
    }

    resetQCM() {
        this.state.qcmFile = null;
        this.state.lastResult = null;
        // No notify, as setUiState('form') will trigger the render.
    }
}