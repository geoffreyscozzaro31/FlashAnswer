class QCMResolverApp {
    constructor() {
        this.state = {
            lang: 'fr',
            pdfFile: null,
            qcmFile: null,
            lastResult: null,
        };
        this.cacheDOMElements();
        this.setupEventListeners();
        this.initI18n();
    }

    cacheDOMElements() {
        this.dom = {
            // Cards & Sections
            formCard: document.getElementById('formCard'),
            resultsSection: document.getElementById('resultsSection'),
            // States
            loadingState: document.getElementById('loadingState'),
            errorState: document.getElementById('errorState'),
            resultState: document.getElementById('resultState'),
            // Steps
            step1: document.getElementById('step1'),
            step2: document.getElementById('step2'),
            // Drop Zones & Inputs
            pdfDropZone: document.getElementById('pdfDropZone'),
            pdfInput: document.getElementById('pdfInput'),
            qcmDropZone: document.getElementById('qcmDropZone'),
            qcmInput: document.getElementById('qcmInput'),
            // File Lists
            pdfFileList: document.getElementById('pdfFileList'),
            qcmFileList: document.getElementById('qcmFileList'),
            // Results
            errorMessage: document.getElementById('errorMessage'),
            resultQuestion: document.getElementById('resultQuestion'),
            resultAnswer: document.getElementById('resultAnswer'),
            resultContext: document.getElementById('resultContext'),
            loadingMessage: document.getElementById('loadingMessage'),
            // Buttons
            langButtons: document.querySelectorAll('.lang-btn'),
            resetBtn: document.getElementById('resetBtn'),
            startOverBtn: document.getElementById('startOverBtn'),
        };
    }

    setupEventListeners() {
        // Lang Switcher
        this.dom.langButtons.forEach(btn => btn.addEventListener('click', () => this.setLanguage(btn.dataset.lang)));

        // Drop Zones
        this.setupDropZone(this.dom.pdfDropZone, this.dom.pdfInput);
        this.setupDropZone(this.dom.qcmDropZone, this.dom.qcmInput);

        // File Inputs
        this.dom.pdfInput.addEventListener('change', e => this.handleFileSelect(e.target.files[0], 'pdf'));
        this.dom.qcmInput.addEventListener('change', e => this.handleFileSelect(e.target.files[0], 'qcm'));

        // Reset Buttons
        this.dom.resetBtn.addEventListener('click', () => this.resetUI());
        this.dom.startOverBtn.addEventListener('click', () => this.resetUI());
    }

    setupDropZone(zone, input) {
        zone.addEventListener('click', () => input.click());
        zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
        zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
        zone.addEventListener('drop', e => {
            e.preventDefault();
            zone.classList.remove('dragover');
            if (e.dataTransfer.files.length) {
                input.files = e.dataTransfer.files;
                input.dispatchEvent(new Event('change'));
            }
        });
    }

    async handleFileSelect(file, type) {
        if (!file) return;

        this.state[`${type}File`] = file;
        this.updateFileListUI(type);

        if (type === 'pdf') {
            await this.processDocument();
        } else if (type === 'qcm') {
            await this.solveQCM();
        }
    }

    updateFileListUI(type) {
        const file = this.state[`${type}File`];
        const listElement = this.dom[`${type}FileList`];
        listElement.innerHTML = '';
        if (!file) return;

        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.innerHTML = `
            <span>${file.name}</span>
            <button type="button" class="remove-file-btn" data-type="${type}" title="Supprimer">&times;</button>
        `;
        listElement.appendChild(fileItem);

        listElement.querySelector('.remove-file-btn').addEventListener('click', () => {
             this.state[`${type}File`] = null;
             this.updateFileListUI(type);
             if(type === 'pdf') this.dom.step2.classList.add('hidden');
        });
    }

    async processDocument() {
        if (!this.state.pdfFile) return;
        this.setUIState('loading', this.i18n.t('processingPdf'));

        const formData = new FormData();
        formData.append('file', this.state.pdfFile);

        try {
            const response = await fetch('/api/process-document', { method: 'POST', body: formData });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || 'Server error');
            }
            this.dom.step2.classList.remove('hidden');
            this.setUIState('form'); // Retourne au formulaire pour l'étape 2
        } catch (error) {
            this.setUIState('error', error.message);
        }
    }

    async solveQCM() {
        if (!this.state.qcmFile) return;
        this.setUIState('loading', this.i18n.t('solvingQcm'));

        const formData = new FormData();
        formData.append('file', this.state.qcmFile);

        try {
            const response = await fetch('/api/solve-qcm', { method: 'POST', body: formData });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.detail || 'Server error');
            }
            this.state.lastResult = result;
            this.setUIState('success', result);
        } catch (error) {
            this.setUIState('error', error.message);
        }
    }

    setUIState(state, data = null) {
        this.dom.formCard.classList.add('hidden');
        this.dom.resultsSection.classList.add('hidden');
        this.dom.loadingState.classList.add('hidden');
        this.dom.errorState.classList.add('hidden');
        this.dom.resultState.classList.add('hidden');

        switch (state) {
            case 'loading':
                this.dom.resultsSection.classList.remove('hidden');
                this.dom.loadingState.classList.remove('hidden');
                this.dom.loadingMessage.textContent = data || '';
                break;
            case 'error':
                this.dom.resultsSection.classList.remove('hidden');
                this.dom.errorState.classList.remove('hidden');
                this.dom.errorMessage.textContent = data;
                break;
            case 'success':
                this.dom.resultsSection.classList.remove('hidden');
                this.dom.resultState.classList.remove('hidden');
                this.dom.resultQuestion.textContent = data.extracted_question;
                this.dom.resultAnswer.textContent = data.answer;
                this.dom.resultContext.textContent = data.retrieved_context;
                break;
            case 'form':
            default:
                this.dom.formCard.classList.remove('hidden');
                break;
        }
    }

    resetUI() {
        this.state.pdfFile = null;
        this.state.qcmFile = null;
        this.state.lastResult = null;
        this.dom.pdfInput.value = '';
        this.dom.qcmInput.value = '';
        this.updateFileListUI('pdf');
        this.updateFileListUI('qcm');
        this.dom.step2.classList.add('hidden');
        this.setUIState('form');
    }

    // --- I18n ---
    initI18n() {
        this.i18n = {
            translations: {
                en: {
                    title: "QCM Resolver", subtitle: "Upload your course, then your QCM screenshot to find the answer.",
                    step1Title: "Step 1: Upload your knowledge base", pdfDropText: "Drag & drop a PDF file or <strong>click here</strong>",
                    step2Title: "Step 2: Upload the QCM screenshot", qcmDropText: "Drag & drop an image or <strong>click here</strong>",
                    processing: "Processing...", processingPdf: "Analyzing document...", solvingQcm: "Finding answer...",
                    error: "Error", retry: "Retry", answerFound: "Answer Found",
                    extractedQuestion: "Extracted Question", suggestedAnswer: "Suggested Answer",
                    showContext: "Show context used", startOver: "Start Over",
                },
                fr: {
                    title: "QCM Resolver", subtitle: "Uploadez votre cours, puis la capture de votre QCM pour trouver la réponse.",
                    step1Title: "Étape 1 : Uploadez votre base de connaissances", pdfDropText: "Glissez-déposez un fichier PDF ou <strong>cliquez ici</strong>",
                    step2Title: "Étape 2 : Uploadez la capture du QCM", qcmDropText: "Glissez-déposez une image ou <strong>cliquez ici</strong>",
                    processing: "Traitement en cours...", processingPdf: "Analyse du document...", solvingQcm: "Recherche de la réponse...",
                    error: "Erreur", retry: "Réessayer", answerFound: "Réponse Trouvée",
                    extractedQuestion: "Question extraite", suggestedAnswer: "Réponse suggérée",
                    showContext: "Afficher le contexte utilisé", startOver: "Recommencer",
                }
            },
            t: (key) => this.i18n.translations[this.state.lang][key] || key,
        };
        this.setLanguage(this.state.lang, true); // Initial call
    }

    setLanguage(lang, isInitial = false) {
        if (!lang || lang === this.state.lang && !isInitial) return;

        this.state.lang = lang;
        document.documentElement.lang = lang;

        // Mettre à jour la classe 'active' sur les boutons
        this.dom.langButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.lang === lang);
        });

        const keysWithHtml = ['pdfDropText', 'qcmDropText'];

        document.querySelectorAll('[data-i18n-key]').forEach(el => {
            const key = el.dataset.i18nKey;
            const translation = this.i18n.t(key);

            // Utiliser innerHTML seulement pour les clés qui contiennent du HTML
            if (keysWithHtml.includes(key)) {
                el.innerHTML = translation;
            } else {
                el.textContent = translation;
            }
        });

        // Retraduire le résultat si affiché
        if (this.state.lastResult && !this.dom.resultState.classList.contains('hidden')) {
            this.setUIState('success', this.state.lastResult);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new QCMResolverApp();
});