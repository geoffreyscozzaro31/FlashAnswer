import { Capture } from './capture.js';

export class QCMCard {
    constructor(stateManager, i18n) {
        this.stateManager = stateManager;
        this.i18n = i18n;
        this.captureModule = new Capture(i18n);
        this.cacheDOMElements();
        this.setupEventListeners();
        this.stateManager.subscribe(state => this.render(state));
    }

    cacheDOMElements() {
        this.dom = {
            card: document.getElementById('qcmCard'),
            dropZone: document.getElementById('qcmDropZone'),
            input: document.getElementById('qcmInput'),
            fileList: document.getElementById('qcmFileList'),
            warning: document.getElementById('contextWarning'),
            captureBtn: document.getElementById('captureBtn'),
            langButtons: document.querySelectorAll('.lang-switcher__btn'),

            // Live capture elements
            liveCaptureControls: document.getElementById('liveCaptureControls'),
            findAnswerLiveBtn: document.getElementById('findAnswerLiveBtn'),
            stopCaptureBtn: document.getElementById('stopCaptureBtn'),
            uploadGroup: [ // Elements to hide during live capture
                document.getElementById('qcmDropZone'),
                document.querySelector('.separator'),
                document.getElementById('captureBtn')
            ]
        };
    }

    setupEventListeners() {
        // Standard file upload
        this.dom.dropZone.addEventListener('click', () => this.triggerInputClick());
        this.dom.input.addEventListener('change', e => this.handleFileSelect(e.target.files[0]));

        // Language switcher
        this.dom.langButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                document.dispatchEvent(new CustomEvent('languageChange', { detail: { lang: btn.dataset.lang } }));
            });
        });

        // Live Capture events
        this.dom.captureBtn.addEventListener('click', () => this.startLiveCapture());
        this.dom.findAnswerLiveBtn.addEventListener('click', () => this.solveFromLiveCapture());
        this.dom.stopCaptureBtn.addEventListener('click', () => this.captureModule.stopCapture());

        // Listen for state changes from the capture module
        document.addEventListener('captureStateChange', (e) => this.onCaptureStateChange(e.detail));
    }

    triggerInputClick() {
        if (this.stateManager.getState().selectedContextIds.size === 0) {
            this.showContextWarning();
            return;
        }
        this.dom.input.click();
    }

    handleFileSelect(file) {
        if (!file) return;
        this.updateFileListUI(file);
        document.dispatchEvent(new CustomEvent('qcmFileSelected', { detail: { file } }));
    }

    async startLiveCapture() {
        if (this.stateManager.getState().selectedContextIds.size === 0) {
            this.showContextWarning();
            return;
        }
        await this.captureModule.startCapture();
    }

    solveFromLiveCapture() {
        const file = this.captureModule.getLatestCapture();
        if (file) {
            this.handleFileSelect(file);
        } else {
            console.warn("No capture available to send.");
            // Optionally, provide user feedback here
        }
    }

    onCaptureStateChange({ isCapturing }) {
        this.dom.liveCaptureControls.classList.toggle('card--hidden', !isCapturing);
        this.dom.uploadGroup.forEach(el => el.classList.toggle('card--hidden', isCapturing));
    }

    showContextWarning() {
        this.dom.warning.classList.remove('warning-message--hidden');
        setTimeout(() => {
            this.dom.warning.classList.add('warning-message--hidden');
        }, 5000);
    }

    updateFileListUI(file) {
        this.dom.fileList.innerHTML = file ? `<div>${file.name}</div>` : '';
    }

    render(state) {
        // Show/hide the card based on the main UI state
        this.dom.card.classList.toggle('card--hidden', state.uiState !== 'form');

        // Update language switcher active state
        this.dom.langButtons.forEach(btn => {
            btn.classList.toggle('lang-switcher__btn--active', btn.dataset.lang === state.lang);
        });

        // When the app resets to its initial form state, we ONLY clear the file list.
        // We DO NOT stop an active capture.
        if (state.uiState === 'form') {
            this.updateFileListUI(null);
        }
    }
}