document.addEventListener('DOMContentLoaded', () => {
    // Step 1 (PDF) elements
    const step1 = document.getElementById('step1');
    const pdfDropZone = document.getElementById('pdfDropZone');
    const pdfInput = document.getElementById('pdfInput');
    const pdfStatus = document.getElementById('pdfStatus');

    // Step 2 (QCM) elements
    const step2 = document.getElementById('step2');
    const qcmDropZone = document.getElementById('qcmDropZone');
    const qcmInput = document.getElementById('qcmInput');

    // Status elements
    const loading = document.getElementById('loading');
    const resultDiv = document.getElementById('result');

    // --- Drag & Drop handling ---
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

    // --- Processing logic ---
    pdfInput.addEventListener('change', async () => {
        const file = pdfInput.files[0];
        if (!file) return;

        pdfStatus.textContent = `Processing ${file.name}...`;
        loading.classList.remove('hidden');
        resultDiv.classList.add('hidden');

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('/api/process-document', { method: 'POST', body: formData });
            const result = await response.json();

            if (!response.ok) throw new Error(result.detail || 'Server error');

            pdfStatus.textContent = `✅ ${result.message}`;
            step2.classList.remove('hidden');
        } catch (error) {
            pdfStatus.textContent = `❌ Error: ${error.message}`;
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

            if (!response.ok) throw new Error(result.detail || 'Server error');

            displayResult(result);
        } catch (error) {
            resultDiv.innerHTML = `<h5>Error</h5><p>${error.message}</p>`;
            resultDiv.classList.remove('hidden');
        } finally {
            loading.classList.add('hidden');
        }
    });

    function displayResult(data) {
        resultDiv.innerHTML = `
            <h5>Answer found</h5>
            <p><strong>Extracted question:</strong> ${data.extracted_question}</p>
            <p><strong>Suggested answer:</strong></p>
            <mark>${data.answer}</mark>
            <details>
                <summary>Show context used for the answer</summary>
                <pre>${data.retrieved_context}</pre>
            </details>
        `;
        resultDiv.classList.remove('hidden');
    }
});