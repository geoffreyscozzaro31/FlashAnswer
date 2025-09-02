// src/app/static/js/ui/sidebar.js

export class Sidebar {
    constructor(stateManager, i18n) {
        this.stateManager = stateManager;
        this.i18n = i18n;
        this.cacheDOMElements();
        this.setupEventListeners();
        this.stateManager.subscribe(state => this.render(state));
    }

    cacheDOMElements() {
        this.dom = {
            dropZone: document.getElementById('pdfDropZone'),
            input: document.getElementById('pdfInput'),
            uploadStatus: document.getElementById('pdfUploadStatus'),
            list: document.getElementById('documentList'),
        };
    }

    setupEventListeners() {
        // PDF Drop Zone
        this.dom.dropZone.addEventListener('click', () => this.dom.input.click());
        this.dom.dropZone.addEventListener('dragover', e => { e.preventDefault(); this.dom.dropZone.classList.add('drop-zone--dragover'); });
        this.dom.dropZone.addEventListener('dragleave', () => this.dom.dropZone.classList.remove('drop-zone--dragover'));
        this.dom.dropZone.addEventListener('drop', e => {
            e.preventDefault();
            this.dom.dropZone.classList.remove('drop-zone--dragover');
            if (e.dataTransfer.files.length) {
                this.handleFileSelect(e.dataTransfer.files[0]);
            }
        });
        this.dom.input.addEventListener('change', e => this.handleFileSelect(e.target.files[0]));

        // Document List Clicks (Delegation)
        this.dom.list.addEventListener('click', e => {
            const item = e.target.closest('.document-item');
            if (!item) return;
            const id = item.dataset.id;
            if (e.target.closest('.document-item__delete-btn')) {
                document.dispatchEvent(new CustomEvent('documentDelete', { detail: { id } }));
            } else {
                document.dispatchEvent(new CustomEvent('documentSelectionChange', { detail: { id } }));
            }
        });
    }

    handleFileSelect(file) {
        if (!file) return;
        document.dispatchEvent(new CustomEvent('documentFileSelected', { detail: { file } }));
    }

    setUploadStatus(message, autoClear = false, isError = false) {
        this.dom.uploadStatus.textContent = message;
        this.dom.uploadStatus.style.color = isError ? 'var(--error-color)' : 'var(--text-muted-color)';
        if (autoClear) {
            setTimeout(() => { this.dom.uploadStatus.textContent = ''; }, 3000);
        }
    }

    render(state) {
        const { documents, selectedContextIds } = state;
        if (!documents) return;

        this.dom.list.innerHTML = '';
        if (documents.length === 0) {
            this.dom.list.innerHTML = `<p data-i18n-key="noDocuments">${this.i18n.t('noDocuments')}</p>`;
            return;
        }

        documents.forEach(doc => {
            const isActive = selectedContextIds.has(doc.id);
            const docEl = document.createElement('div');
            docEl.className = `document-item ${isActive ? 'document-item--active' : ''}`;
            docEl.dataset.id = doc.id;
            docEl.innerHTML = `
                <span class="document-item__name" title="${doc.name}">${doc.name}</span>
                <button class="document-item__delete-btn" title="${this.i18n.t('deleteTooltip')}">&times;</button>
            `;
            this.dom.list.appendChild(docEl);
        });
    }
}