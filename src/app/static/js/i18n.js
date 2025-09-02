// src/app/static/js/i18n.js
import { translations } from './translations.js';

export class I18n {
    constructor(stateManager) {
        this.stateManager = stateManager;
        this.stateManager.subscribe(state => this.onStateChange(state));
    }

    onStateChange(state) {
        if (this.currentLang !== state.lang) {
            this.currentLang = state.lang;
            document.documentElement.lang = this.currentLang;
            this.updateUI();
        }
    }

    t(key, replacements = {}) {
        const lang = this.stateManager.getState().lang || 'en';
        let translation = translations[lang]?.[key] || key;
        for (const placeholder in replacements) {
            translation = translation.replace(`{{${placeholder}}}`, replacements[placeholder]);
        }
        return translation;
    }

    updateUI() {
        const keysWithHtml = ['pdfDropText', 'qcmDropText'];
        document.querySelectorAll('[data-i18n-key]').forEach(el => {
            const key = el.dataset.i18nKey;
            const translation = this.t(key);
            if (keysWithHtml.includes(key)) {
                el.innerHTML = translation;
            } else {
                el.textContent = translation;
            }
        });
    }
}