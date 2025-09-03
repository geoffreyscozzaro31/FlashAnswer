// src/app/static/js/ui/qcmCard.js
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
        };
    }

    setupEventListeners() {
        this.dom.dropZone.addEventListener('click', () => this.triggerInputClick());
        this.dom.input.addEventListener('change', e => this.handleFileSelect(e.target.files[0]));
        // Drag and drop events...

        this.dom.captureBtn.addEventListener('click', async () => {
            if (this.stateManager.getState().selectedContextIds.size === 0) {
                this.showContextWarning();
                return;
            }
            const file = await this.captureModule.startCapture();
            if (file) {
                this.handleFileSelect(file);
            }
        });

        this.dom.langButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                document.dispatchEvent(new CustomEvent('languageChange', { detail: { lang: btn.dataset.lang } }));
            });
        });
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

        // Clear file list on reset
        if (state.uiState === 'form' && !state.qcmFile) {
            this.updateFileListUI(null);
        }
    }
}