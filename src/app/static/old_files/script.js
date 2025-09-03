class QCMResolverApp {
    constructor() {
        // Default language set to English
        this.state = {
            lang: 'en',
            qcmFile: null,
            lastResult: null,
            documents: [],
            selectedContextIds: new Set(),
        };
        this.cacheDOMElements();
        this.setupEventListeners();
        if (typeof QCMCapture !== 'undefined') {
            this.captureModule = new QCMCapture(this);
        }
        this.initI18n();
        this.fetchAndRenderDocuments();
    }

    cacheDOMElements() {
        this.dom = {
            pageTitle: document.querySelector('title'),
            qcmCard: document.getElementById('qcmCard'),
            resultsSection: document.getElementById('resultsSection'),
            loadingState: document.getElementById('loadingState'),
            errorState: document.getElementById('errorState'),
            resultState: document.getElementById('resultState'),
            pdfDropZone: document.getElementById('pdfDropZone'),
            pdfInput: document.getElementById('pdfInput'),
            pdfUploadStatus: document.getElementById('pdfUploadStatus'),
            documentList: document.getElementById('documentList'),
            qcmDropZone: document.getElementById('qcmDropZone'),
            qcmInput: document.getElementById('qcmInput'),
            qcmFileList: document.getElementById('qcmFileList'),
            contextWarning: document.getElementById('contextWarning'),
            errorMessage: document.getElementById('errorMessage'),
            resultQuestion: document.getElementById('resultQuestion'),
            resultAnswer: document.getElementById('resultAnswer'),
            resultContext: document.getElementById('resultContext'),
            loadingMessage: document.getElementById('loadingMessage'),
            langButtons: document.querySelectorAll('.lang-btn'),
            resetBtn: document.getElementById('resetBtn'),
            startOverBtn: document.getElementById('startOverBtn'),
            captureBtn: document.getElementById('captureBtn'),
        };
    }

    setupEventListeners() {
        this.dom.langButtons.forEach(btn => btn.addEventListener('click', () => this.setLanguage(btn.dataset.lang)));
        this.setupDropZone(this.dom.pdfDropZone, this.dom.pdfInput, 'pdf');
        this.dom.pdfInput.addEventListener('change', e => this.handleFileSelect(e.target.files[0], 'pdf'));
        this.setupDropZone(this.dom.qcmDropZone, this.dom.qcmInput, 'qcm');
        this.dom.qcmInput.addEventListener('change', e => this.handleFileSelect(e.target.files[0], 'qcm'));
        this.dom.resetBtn.addEventListener('click', () => this.resetUI());
        this.dom.startOverBtn.addEventListener('click', () => this.resetUI());
        this.dom.documentList.addEventListener('click', e => this.handleDocumentClick(e));
    }

    setupDropZone(zone, input, type) {
        zone.addEventListener('click', () => {
            if (type === 'qcm' && this.state.selectedContextIds.size === 0) {
                this.showContextWarning();
                return;
            }
            input.click();
        });
        zone.addEventListener('dragover', e => {
            e.preventDefault();
            if (type === 'qcm' && this.state.selectedContextIds.size === 0) {
                return;
            }
            zone.classList.add('dragover');
        });
        zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
        zone.addEventListener('drop', e => {
            e.preventDefault();
            zone.classList.remove('dragover');
            if (type === 'qcm' && this.state.selectedContextIds.size === 0) {
                this.showContextWarning();
                return;
            }
            if (e.dataTransfer.files.length) {
                this.handleFileSelect(e.dataTransfer.files[0], type);
            }
        });
    }

    showContextWarning() {
        if (!this.dom.contextWarning) return;
        this.dom.contextWarning.classList.remove('hidden');
        setTimeout(() => {
            this.dom.contextWarning.classList.add('hidden');
        }, 5000);
    }

    async handleFileSelect(file, type) {
        if (!file) return;
        if (type === 'pdf') {
            await this.processDocument(file);
        } else if (type === 'qcm') {
            this.state.qcmFile = file;
            this.updateQcmFileListUI();
            await this.solveQCM();
        }
    }

    updateQcmFileListUI() {
        const file = this.state.qcmFile;
        const listElement = this.dom.qcmFileList;
        listElement.innerHTML = '';
        if (!file) return;
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.innerHTML = `<span>${file.name}</span>`;
        listElement.appendChild(fileItem);
    }

    async fetchAndRenderDocuments() {
        try {
            const response = await fetch('/api/documents');
            if (!response.ok) throw new Error('Failed to fetch documents.');
            this.state.documents = await response.json();
            this.renderDocumentList();
        } catch (error) {
            this.dom.documentList.innerHTML = `<p style="color:var(--error-color)">${this.i18n.t('loadingError')}</p>`;
            console.error(error);
        }
    }

    renderDocumentList() {
        this.dom.documentList.innerHTML = '';
        if (this.state.documents.length === 0) {
            this.dom.documentList.innerHTML = `<p data-i18n-key="noDocuments">${this.i18n.t('noDocuments')}</p>`;
            return;
        }

        this.state.documents.forEach(doc => {
            const docEl = document.createElement('div');
            docEl.className = 'document-item';
            docEl.dataset.id = doc.id;
            if (this.state.selectedContextIds.has(doc.id)) {
                docEl.classList.add('active');
            }
            docEl.innerHTML = `
                <span class="document-name" title="${doc.name}">${doc.name}</span>
                <button class="delete-doc-btn" data-action="delete" title="${this.i18n.t('deleteTooltip')}">&times;</button>
            `;
            this.dom.documentList.appendChild(docEl);
        });
    }

    handleDocumentClick(event) {
        const docItem = event.target.closest('.document-item');
        if (!docItem) return;

        const docId = docItem.dataset.id;
        if (event.target.closest('[data-action="delete"]')) {
            this.deleteDocument(docId);
            return;
        }

        docItem.classList.toggle('active');
        if (this.state.selectedContextIds.has(docId)) {
            this.state.selectedContextIds.delete(docId);
        } else {
            this.state.selectedContextIds.add(docId);
        }

        if (this.state.selectedContextIds.size > 0) {
            this.dom.contextWarning.classList.add('hidden');
        }
    }

    async deleteDocument(docId) {
        if (!confirm(this.i18n.t('deleteConfirm'))) return;
        try {
            const response = await fetch(`/api/documents/${docId}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Server error during deletion.');
            this.state.selectedContextIds.delete(docId);
            await this.fetchAndRenderDocuments();
        } catch (error) {
            alert(this.i18n.t('alertError'));
        }
    }

    async processDocument(pdfFile) {
        if (!pdfFile) return;
        this.dom.pdfUploadStatus.textContent = this.i18n.t('processingPdf');
        const formData = new FormData();
        formData.append('file', pdfFile);

        try {
            const response = await fetch('/api/process-document', { method: 'POST', body: formData });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || 'Server error');
            }
            this.dom.pdfUploadStatus.textContent = this.i18n.t('pdfAdded', { fileName: pdfFile.name });
            setTimeout(() => this.dom.pdfUploadStatus.textContent = '', 3000);
            await this.fetchAndRenderDocuments();
        } catch (error) {
            this.dom.pdfUploadStatus.textContent = this.i18n.t('pdfError', { errorMessage: error.message });
        }
    }

    async solveQCM() {
        if (!this.state.qcmFile) return;
        if (this.state.selectedContextIds.size === 0) {
            this.showContextWarning();
            return;
        }

        this.setUIState('loading', this.i18n.t('solvingQcm'));
        const formData = new FormData();
        formData.append('file', this.state.qcmFile);
        const contextIds = Array.from(this.state.selectedContextIds);
        formData.append('context_ids', JSON.stringify(contextIds));

        try {
            const response = await fetch('/api/solve-qcm', { method: 'POST', body: formData });
            const result = await response.json();
            if (!response.ok) throw new Error(result.detail || 'Server error');
            this.state.lastResult = result;
            this.setUIState('success', result);
        } catch (error) {
            this.setUIState('error', error.message);
        }
    }

    setUIState(state, data = null) {
        this.dom.qcmCard.classList.add('hidden');
        this.dom.resultsSection.classList.remove('hidden');
        [this.dom.loadingState, this.dom.errorState, this.dom.resultState].forEach(el => el.classList.add('hidden'));

        switch (state) {
            case 'loading':
                this.dom.loadingState.classList.remove('hidden');
                this.dom.loadingMessage.textContent = data || '';
                break;
            case 'error':
                this.dom.errorState.classList.remove('hidden');
                this.dom.errorMessage.textContent = data;
                break;
            case 'success':
                this.dom.resultState.classList.remove('hidden');
                this.dom.resultQuestion.textContent = data.extracted_question;
                this.dom.resultAnswer.textContent = data.answer;
                this.dom.resultContext.textContent = data.retrieved_context;
                break;
            case 'form':
            default:
                this.dom.qcmCard.classList.remove('hidden');
                this.dom.resultsSection.classList.add('hidden');
                break;
        }
    }

    resetUI() {
        this.state.qcmFile = null;
        this.state.lastResult = null;
        this.dom.qcmInput.value = '';
        this.updateQcmFileListUI();
        this.setUIState('form');
    }

    initI18n() {
        this.i18n = {
            translations: {
                en: {
                    // Main App
                    pageTitle: "QCM Resolver",
                    sidebarTitle: "Knowledge Base",
                    sidebarSubtitle: "Add or select documents to use.",
                    title: "QCM Resolver",
                    subtitle: "Upload your QCM to find the answer based on the selected context.",
                    pdfDropText: "Add a PDF...",
                    contextInstruction: "📋 Click on documents to select them as context",
                    step2Title: "Upload QCM Screenshot",
                    contextWarning: "⚠️ Please select at least one context document from the sidebar",
                    qcmDropText: "Drag & drop an image or <strong>click here</strong>",
                    or: "or",
                    captureScreen: "Capture Screen",
                    noDocuments: "No documents in the database.",
                    processing: "Processing...",
                    processingPdf: "Analyzing document...",
                    solvingQcm: "Finding answer...",
                    error: "Error",
                    retry: "Retry",
                    answerFound: "Answer Found",
                    extractedQuestion: "Extracted Question:",
                    suggestedAnswer: "Suggested Answer:",
                    showContext: "Show context used",
                    startOver: "Start Over",
                    deleteConfirm: "Are you sure you want to delete this document?",
                    deleteTooltip: "Delete",
                    loadingError: "Error loading documents.",
                    pdfAdded: '"{{fileName}}" added.',
                    pdfError: "Error: {{errorMessage}}",
                    alertError: "Error: Could not delete the document.",

                    // Capture Module
                    captureNotSupported: "Your browser does not support this feature.",
                    captureGenericErrorLog: "Error during screen capture:",
                    capturePermissionDenied: "Permission to capture the screen was denied.",
                    captureErrorWithMessage: "Capture error: {{message}}",
                    captureInstructions: "Select the area to capture by dragging your mouse",
                    confirm: "Confirm",
                    cancel: "Cancel",
                    selectionTooSmall: "Selection is too small",
                },
                fr: {
                    // Main App
                    pageTitle: "QCM Resolver",
                    sidebarTitle: "Base de Connaissances",
                    sidebarSubtitle: "Ajoutez ou sélectionnez des documents à utiliser.",
                    title: "QCM Resolver",
                    subtitle: "Uploadez votre QCM pour trouver la réponse basée sur le contexte sélectionné.",
                    pdfDropText: "Ajouter un PDF...",
                    contextInstruction: "📋 Cliquez sur les documents pour les sélectionner comme contexte",
                    step2Title: "Uploadez la capture du QCM",
                    contextWarning: "⚠️ Veuillez sélectionner au moins un document de contexte dans la barre latérale",
                    qcmDropText: "Glissez-déposez une image ou <strong>cliquez ici</strong>",
                    or: "ou",
                    captureScreen: "Capturer l'écran",
                    noDocuments: "Aucun document dans la base.",
                    processing: "Traitement en cours...",
                    processingPdf: "Analyse du document...",
                    solvingQcm: "Recherche de la réponse...",
                    error: "Erreur",
                    retry: "Réessayer",
                    answerFound: "Réponse Trouvée",
                    extractedQuestion: "Question extraite :",
                    suggestedAnswer: "Réponse suggérée :",
                    showContext: "Afficher le contexte utilisé",
                    startOver: "Recommencer",
                    deleteConfirm: "Êtes-vous sûr de vouloir supprimer ce document ?",
                    deleteTooltip: "Supprimer",
                    loadingError: "Erreur de chargement des documents.",
                    pdfAdded: '"{{fileName}}" ajouté.',
                    pdfError: "Erreur : {{errorMessage}}",
                    alertError: "Erreur: Impossible de supprimer le document.",

                    // Capture Module
                    captureNotSupported: "Votre navigateur ne supporte pas cette fonctionnalité.",
                    captureGenericErrorLog: "Erreur durant la capture d'écran :",
                    capturePermissionDenied: "La permission de capturer l'écran a été refusée.",
                    captureErrorWithMessage: "Erreur de capture : {{message}}",
                    captureInstructions: "Sélectionnez la zone à capturer en glissant votre souris",
                    confirm: "Confirmer",
                    cancel: "Annuler",
                    selectionTooSmall: "Sélection trop petite",
                }
            },
            t: (key, replacements = {}) => {
                let translation = this.i18n.translations[this.state.lang]?.[key] || key;
                for (const placeholder in replacements) {
                    translation = translation.replace(`{{${placeholder}}}`, replacements[placeholder]);
                }
                return translation;
            },
        };
        this.setLanguage(this.state.lang, true);
    }

    updateI18nElements() {
        const keysWithHtml = ['pdfDropText', 'qcmDropText'];
        document.querySelectorAll('[data-i18n-key]').forEach(el => {
            const key = el.dataset.i18nKey;
            const translation = this.i18n.t(key);
            if (keysWithHtml.includes(key)) {
                el.innerHTML = translation;
            } else {
                el.textContent = translation;
            }
        });
    }

    setLanguage(lang, isInitial = false) {
        if (!lang || (lang === this.state.lang && !isInitial)) return;
        this.state.lang = lang;
        document.documentElement.lang = lang;
        this.dom.langButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.lang === lang));

        this.updateI18nElements();

        if (this.state.documents.length > 0) {
            this.renderDocumentList();
        }

        if (this.state.lastResult && !this.dom.resultState.classList.contains('hidden')) {
            this.setUIState('success', this.state.lastResult);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new QCMResolverApp();
});