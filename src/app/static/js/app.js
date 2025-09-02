// src/app/static/js/app.js
import { StateManager } from './state.js';
import { ApiService } from './api.js';
import { I18n } from './i18n.js';
import { Sidebar } from './ui/sidebar.js';
import { QCMCard } from './ui/qcmCard.js';
import { Results } from './ui/results.js';
import { Capture } from './ui/capture.js';

export class App {
    constructor() {
        this.stateManager = new StateManager();
        this.apiService = new ApiService();
        this.i18n = new I18n(this.stateManager);

        // Initialize UI Components
        this.sidebar = new Sidebar(this.stateManager, this.i18n);
        this.qcmCard = new QCMCard(this.stateManager, this.i18n);
        this.results = new Results(this.stateManager, this.i18n);
        this.capture = new Capture(this.i18n);

        this.bindEventListeners();
        this.initializeApp();
    }

    /**
     * Binds handlers to custom events fired by UI components.
     * This is the core of the Controller logic.
     */
    bindEventListeners() {
        document.addEventListener('languageChange', (e) => this.setLanguage(e.detail.lang));
        document.addEventListener('documentFileSelected', (e) => this.processDocument(e.detail.file));
        document.addEventListener('documentSelectionChange', (e) => this.stateManager.updateSelectedContexts(e.detail.id));
        document.addEventListener('documentDelete', (e) => this.deleteDocument(e.detail.id));
        document.addEventListener('qcmFileSelected', (e) => this.solveQCM(e.detail.file));
        document.addEventListener('resetApp', () => this.resetUI());
    }

    /**
     * Initial application setup.
     */
    async initializeApp() {
        this.setLanguage('en', true); // Set default language
        await this.loadDocuments();
    }

    setLanguage(lang, isInitial = false) {
        if (!lang || (!isInitial && lang === this.stateManager.getState().lang)) return;
        this.stateManager.setLanguage(lang);
    }

    async loadDocuments() {
        try {
            const documents = await this.apiService.fetchDocuments();
            this.stateManager.setDocuments(documents);
        } catch (error) {
            console.error('Failed to load documents:', error);
            this.stateManager.setDocuments([]); // You might want a specific error state here
        }
    }

    async processDocument(file) {
        this.sidebar.setUploadStatus(this.i18n.t('processingPdf'));
        try {
            await this.apiService.uploadDocument(file);
            this.sidebar.setUploadStatus(this.i18n.t('pdfAdded', { fileName: file.name }), true);
            await this.loadDocuments(); // Refresh the list
        } catch (error) {
            this.sidebar.setUploadStatus(this.i18n.t('pdfError', { errorMessage: error.message }), false, true);
        }
    }

    async deleteDocument(docId) {
        if (!confirm(this.i18n.t('deleteConfirm'))) return;
        try {
            await this.apiService.deleteDocument(docId);
            this.stateManager.removeSelectedContext(docId);
            await this.loadDocuments(); // Refresh the list
        } catch (error) {
            alert(this.i18n.t('alertError'));
        }
    }

    async solveQCM(file) {
        const { selectedContextIds } = this.stateManager.getState();
        if (selectedContextIds.size === 0) {
            this.qcmCard.showContextWarning();
            return;
        }

        this.stateManager.setUiState('loading', this.i18n.t('solvingQcm'));
        try {
            const contextIds = Array.from(selectedContextIds);
            const result = await this.apiService.solveQcm(file, contextIds);
            this.stateManager.setLastResult(result);
            this.stateManager.setUiState('success', result);
        } catch (error) {
            this.stateManager.setUiState('error', error.message);
        }
    }

    resetUI() {
        this.stateManager.resetQCM();
        this.stateManager.setUiState('form');
    }
}