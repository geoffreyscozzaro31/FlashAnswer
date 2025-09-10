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
            cardBody: document.getElementById('qcmCardBody'), // Added for toast message placement
            dropZone: document.getElementById('qcmDropZone'),
            input: document.getElementById('qcmInput'),
            fileList: document.getElementById('qcmFileList'),
            warning: document.getElementById('contextWarning'),
            captureBtn: document.getElementById('captureBtn'),
            langButtons: document.querySelectorAll('.lang-switcher__btn'),
            liveCaptureControls: document.getElementById('liveCaptureControls'),
            stopCaptureBtn: document.getElementById('stopCaptureBtn'),
            uploadGroup: [
                document.getElementById('qcmDropZone'),
                document.querySelector('.separator'),
                document.getElementById('captureBtn')
            ]
        };
    }

    setupEventListeners() {
        this.dom.dropZone.addEventListener('click', () => this.triggerInputClick());
        this.dom.input.addEventListener('change', e => this.handleFileSelect(e.target.files[0]));

        this.dom.langButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                document.dispatchEvent(new CustomEvent('languageChange', { detail: { lang: btn.dataset.lang } }));
            });
        });

        this.dom.captureBtn.addEventListener('click', () => this.startLiveCapture());
        this.dom.stopCaptureBtn.addEventListener('click', () => this.captureModule.stopCapture());
        document.addEventListener('captureStateChange', (e) => this.onCaptureStateChange(e.detail));
        document.addEventListener('significantChangeDetected', () => this.handleSignificantChange());
    }

    handleSignificantChange() {
        this.solveFromLiveCapture();
    }

    signalProcessingComplete() {
        this.captureModule.resetChangeDetection();
    }

    // MODIFIED: The blocking check has been removed.
    triggerInputClick() {
        this.dom.input.click();
    }

    handleFileSelect(file) {
        if (!file) return;
        this.updateFileListUI(file);
        document.dispatchEvent(new CustomEvent('qcmFileSelected', { detail: { file } }));
    }

    // MODIFIED: The blocking check has been removed.
    async startLiveCapture() {
        await this.captureModule.startCapture();
    }

    solveFromLiveCapture() {
        setTimeout(() => {
            const file = this.captureModule.getLatestCapture();
            if (file) {
                this.handleFileSelect(file);
            } else {
                console.warn("No capture available to send.");
                this.captureModule.resetChangeDetection();
            }
        }, 100);
    }

    onCaptureStateChange({ isCapturing }) {
        this.stateManager.setCapturing(isCapturing);
        this.dom.liveCaptureControls.classList.toggle('card--hidden', !isCapturing);
        this.dom.uploadGroup.forEach(el => el.classList.toggle('card--hidden', isCapturing));
    }

    // DEPRECATED: This hard warning is no longer the primary UX.
    showContextWarning() {
        this.dom.warning.textContent = this.i18n.t('contextRequired'); // Assumes this key exists
        this.dom.warning.classList.remove('warning-message--hidden', 'warning-message--info');
        setTimeout(() => {
            this.dom.warning.classList.add('warning-message--hidden');
        }, 5000);
    }

    // NEW: Method for showing a non-blocking informational message.
    showContextInfoMessage(message) {
        this.dom.warning.textContent = message;
        this.dom.warning.classList.add('warning-message--info'); // Add class for different styling
        this.dom.warning.classList.remove('warning-message--hidden');
        setTimeout(() => {
            this.dom.warning.classList.add('warning-message--hidden');
            // Clean up the class after the animation
            setTimeout(() => this.dom.warning.classList.remove('warning-message--info'), 500);
        }, 4000);
    }

    updateFileListUI(file) {
        this.dom.fileList.innerHTML = file ? `<div>Processing...</div>` : '';
    }



    render(state) {
        this.dom.card.classList.toggle('card--hidden', state.uiState !== 'form' && !state.isCapturing);

        this.dom.langButtons.forEach(btn => {
            btn.classList.toggle('lang-switcher__btn--active', btn.dataset.lang === state.lang);
        });
        if (state.uiState === 'form' && !state.isCapturing) {
            this.updateFileListUI(null);
        }
    }
}