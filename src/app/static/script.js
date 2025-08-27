document.addEventListener('DOMContentLoaded', () => {
    // Éléments de l'Étape 1 (PDF)
    const step1 = document.getElementById('step1');
    const pdfDropZone = document.getElementById('pdfDropZone');
    const pdfInput = document.getElementById('pdfInput');
    const pdfStatus = document.getElementById('pdfStatus');

    // Éléments de l'Étape 2 (QCM)
    const step2 = document.getElementById('step2');
    const qcmDropZone = document.getElementById('qcmDropZone');
    const qcmInput = document.getElementById('qcmInput');

    // Éléments de statut
    const loading = document.getElementById('loading');
    const resultDiv = document.getElementById('result');

    // --- Gestion du Drag & Drop ---
    const setupDropZone = (zone, input) => {
        zone.addEventListener('click', () => input.click());
        zone.addEventListener('dragover', e => {
            e.preventDefault();
            if (!zone.classList.contains('disabled')) zone.classList.add('dragover');
        });
        zone.addEventListener('dragleave', e => {
            e.preventDefault();
            zone.classList.remove('dragover');
        });
        zone.addEventListener('drop', e => {
            e.preventDefault();
            zone.classList.remove('dragover');
            if (!zone.classList.contains('disabled') && e.dataTransfer.files.length) {
                input.files = e.dataTransfer.files;
                input.dispatchEvent(new Event('change'));
            }
        });
    };

    setupDropZone(pdfDropZone, pdfInput);
    setupDropZone(qcmDropZone, qcmInput);

    // --- Logique de traitement ---
    pdfInput.addEventListener('change', async () => {
        const file = pdfInput.files[0];
        if (!file) return;

        pdfStatus.textContent = `Traitement de ${file.name}...`;
        loading.classList.remove('hidden');
        resultDiv.classList.add('hidden');

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('/api/process-document', { method: 'POST', body: formData });
            const result = await response.json();

            if (!response.ok) throw new Error(result.detail || 'Erreur serveur');

            pdfStatus.textContent = `✅ ${result.message}`;
            step2.classList.remove('hidden');
        } catch (error) {
            pdfStatus.textContent = `❌ Erreur : ${error.message}`;
        } finally {
            loading.classList.add('hidden');
        }
    });

    qcmInput.addEventListener('change', async () => {
        const file = qcmInput.files[0];
        if (!file) return;

        resultDiv.classList.add('hidden');
        loading.classList.remove('hidden');

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('/api/solve-qcm', { method: 'POST', body: formData });
            const result = await response.json();

            if (!response.ok) throw new Error(result.detail || 'Erreur serveur');

            displayResult(result);
        } catch (error) {
            resultDiv.innerHTML = `<h5>Erreur</h5><p>${error.message}</p>`;
            resultDiv.classList.remove('hidden');
        } finally {
            loading.classList.add('hidden');
        }
    });

    function displayResult(data) {
        resultDiv.innerHTML = `
            <h5>Réponse trouvée</h5>
            <p><strong>Question extraite :</strong> ${data.extracted_question}</p>
            <p><strong>Réponse suggérée :</strong></p>
            <mark>${data.answer}</mark>
            <details>
                <summary>Voir le contexte utilisé pour la réponse</summary>
                <pre>${data.retrieved_context}</pre>
            </details>
        `;
        resultDiv.classList.remove('hidden');
    }
});