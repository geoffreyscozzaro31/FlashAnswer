
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
            stopCaptureBtn: document.getElementById('stopCaptureBtn'),

            uploadGroup: [ // Elements to hide during live capture
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
        // The capture module will now automatically trigger the first analysis
        await this.captureModule.startCapture();
    }

    solveFromLiveCapture() {
        // A short delay to ensure the file from the blob is ready
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

    showContextWarning() {
        this.dom.warning.classList.remove('warning-message--hidden');
        setTimeout(() => {
            this.dom.warning.classList.add('warning-message--hidden');
        }, 5000);
    }

    updateFileListUI(file) {
        this.dom.fileList.innerHTML = file ? `<div>Processing...</div>` : '';
    }

    render(state) {
        // Keep the card visible during capture so the "Stop" button is always accessible
        this.dom.card.classList.toggle('card--hidden', state.uiState !== 'form' && !state.isCapturing);

        this.dom.langButtons.forEach(btn => {
            btn.classList.toggle('lang-switcher__btn--active', btn.dataset.lang === state.lang);
        });
        if (state.uiState === 'form' && !state.isCapturing) {
            this.updateFileListUI(null);
        }
    }
}