export class Results {
    constructor(stateManager, i18n) {
        this.stateManager = stateManager;
        this.i18n = i18n;
        this.cacheDOMElements();
        this.setupEventListeners();
        this.stateManager.subscribe(state => this.render(state));
    }

    cacheDOMElements() {
        this.dom = {
            section: document.getElementById('resultsSection'),
            loading: document.getElementById('loadingState'),
            error: document.getElementById('errorState'),
            success: document.getElementById('resultState'),
            loadingMsg: document.getElementById('loadingMessage'),
            errorMsg: document.getElementById('errorMessage'),
            question: document.getElementById('resultQuestion'),
            answer: document.getElementById('resultAnswer'),
            context: document.getElementById('resultContext'),
            resetBtn: document.getElementById('resetBtn'),
        };
    }

    setupEventListeners() {
        this.dom.resetBtn.addEventListener('click', () => document.dispatchEvent(new Event('resetApp')));
    }

    render(state) {
        const { uiState, lastResult, errorMessage, loadingMessage, isCapturing } = state;

        // The results section is visible for any state other than the initial 'form' state.
        // During capture, it will flicker between 'loading' and 'success'.
        this.dom.section.classList.toggle('results--hidden', uiState === 'form' && !isCapturing);

        this.dom.loading.classList.toggle('card--hidden', uiState !== 'loading');
        this.dom.error.classList.toggle('card--hidden', uiState !== 'error');
        this.dom.success.classList.toggle('card--hidden', uiState !== 'success');

        if (uiState === 'loading') {
            this.dom.loadingMsg.textContent = loadingMessage || '';
        } else if (uiState === 'error') {
            this.dom.errorMsg.textContent = errorMessage;
        } else if (uiState === 'success' && lastResult) {
            this.dom.question.textContent = lastResult.extracted_question;
            this.dom.answer.textContent = lastResult.answer;
            this.dom.context.textContent = lastResult.retrieved_context;
        }
    }
}