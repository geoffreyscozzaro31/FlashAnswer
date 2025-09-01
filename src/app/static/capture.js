// src/app/static/capture.js
class QCMCapture {
    constructor(app) {
        this.app = app; // Référence à l'instance principale de QCMResolverApp
        this.captureBtn = document.getElementById('captureBtn');

        if (this.isSupported()) {
            this.init();
        } else {
            this.disable();
        }
    }

    isSupported() {
        return 'getDisplayMedia' in navigator.mediaDevices;
    }

    init() {
        this.captureBtn.addEventListener('click', async () => {
            if (this.app.state.selectedContextIds.size === 0) {
                this.app.showContextWarning();
                return;
            }
            await this.startCapture();
        });
    }

    disable() {
        this.captureBtn.disabled = true;
        this.captureBtn.title = 'Votre navigateur ne supporte pas cette fonctionnalité.';
        this.captureBtn.style.opacity = '0.5';
        this.captureBtn.style.cursor = 'not-allowed';
    }

    async startCapture() {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: { mediaSource: "screen", cursor: "crosshair" },
                audio: false,
                preferCurrentTab: false,
            });

            const track = stream.getVideoTracks()[0];

            // Attendre un court instant pour s'assurer que le flux est actif
            await new Promise(resolve => setTimeout(resolve, 200));

            const imageCapture = new ImageCapture(track);
            const bitmap = await imageCapture.grabFrame();
            
            track.stop(); // Arrêter le partage dès que l'image est capturée

            const canvas = document.createElement('canvas');
            canvas.width = bitmap.width;
            canvas.height = bitmap.height;
            const context = canvas.getContext('2d');
            context.drawImage(bitmap, 0, 0);

            canvas.toBlob(blob => {
                if (blob) {
                    const file = new File([blob], 'screenshot.png', { type: 'image/png' });
                    this.app.handleFileSelect(file, 'qcm');
                }
            }, 'image/png');

        } catch (err) {
            console.error("Erreur durant la capture d'écran :", err);
            // Affiche une erreur dans l'UI si l'utilisateur annule ou si une erreur survient
            if (err.name === 'NotAllowedError') {
                 this.app.setUIState('error', "La permission de capturer l'écran a été refusée.");
            } else {
                 this.app.setUIState('error', `Erreur de capture : ${err.message}`);
            }
        }
    }
}