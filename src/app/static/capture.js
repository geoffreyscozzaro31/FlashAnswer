class QCMCapture {
    constructor(app) {
        this.app = app;
        this.captureBtn = document.getElementById('captureBtn');
        this.cropOverlay = null;
        this.capturedImage = null;
        this.isSelecting = false;
        this.selection = { startX: 0, startY: 0, endX: 0, endY: 0 };

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
            await new Promise(resolve => setTimeout(resolve, 200));

            if ('ImageCapture' in window) {
                const imageCapture = new ImageCapture(track);
                const bitmap = await imageCapture.grabFrame();
                track.stop();

                const canvas = document.createElement('canvas');
                canvas.width = bitmap.width;
                canvas.height = bitmap.height;
                const context = canvas.getContext('2d');
                context.drawImage(bitmap, 0, 0);

                this.capturedImage = canvas.toDataURL('image/png');
                this.showCropInterface();
            } else {
                const video = document.createElement('video');
                video.srcObject = stream;
                video.play();

                video.onloadedmetadata = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(video, 0, 0);

                    track.stop();
                    this.capturedImage = canvas.toDataURL('image/png');
                    this.showCropInterface();
                };
            }

        } catch (err) {
            console.error("Erreur durant la capture d'écran :", err);
            if (err.name === 'NotAllowedError') {
                this.app.setUIState('error', "La permission de capturer l'écran a été refusée.");
            } else {
                this.app.setUIState('error', `Erreur de capture : ${err.message}`);
            }
        }
    }

    showCropInterface() {
        this.cropOverlay = document.createElement('div');
        this.cropOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0, 0, 0, 0.8);
            z-index: 10000;
            cursor: crosshair;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
        `;

        const img = document.createElement('img');
        img.src = this.capturedImage;
        img.style.cssText = `
            max-width: 90vw;
            max-height: 80vh;
            object-fit: contain;
            border: 2px solid white;
        `;

        const canvas = document.createElement('canvas');
        canvas.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            cursor: crosshair;
            max-width: 90vw;
            max-height: 80vh;
        `;

        const instructions = document.createElement('div');
        instructions.style.cssText = `
            color: white;
            text-align: center;
            margin-bottom: 20px;
            font-size: 18px;
        `;
        instructions.textContent = 'Sélectionnez la zone à capturer en glissant votre souris';

        const buttons = document.createElement('div');
        buttons.style.cssText = `
            margin-top: 20px;
            display: flex;
            gap: 10px;
        `;

        const confirmBtn = document.createElement('button');
        confirmBtn.textContent = 'Confirmer';
        confirmBtn.style.cssText = `
            padding: 10px 20px;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
        `;

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Annuler';
        cancelBtn.style.cssText = `
            padding: 10px 20px;
            background: #6c757d;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
        `;

        buttons.appendChild(confirmBtn);
        buttons.appendChild(cancelBtn);

        this.cropOverlay.appendChild(instructions);
        this.cropOverlay.appendChild(img);
        this.cropOverlay.appendChild(canvas);
        this.cropOverlay.appendChild(buttons);
        document.body.appendChild(this.cropOverlay);

        img.onload = () => {
            const rect = img.getBoundingClientRect();
            canvas.width = rect.width;
            canvas.height = rect.height;
            canvas.style.width = rect.width + 'px';
            canvas.style.height = rect.height + 'px';

            this.setupCanvasEvents(canvas, img);
        };

        confirmBtn.onclick = () => this.confirmSelection(canvas, img);
        cancelBtn.onclick = () => this.closeCropInterface();
    }

    setupCanvasEvents(canvas, img) {
        const ctx = canvas.getContext('2d');
        let isDrawing = false;

        canvas.onmousedown = (e) => {
            isDrawing = true;
            const rect = canvas.getBoundingClientRect();
            this.selection.startX = e.clientX - rect.left;
            this.selection.startY = e.clientY - rect.top;
        };

        canvas.onmousemove = (e) => {
            if (!isDrawing) return;

            const rect = canvas.getBoundingClientRect();
            this.selection.endX = e.clientX - rect.left;
            this.selection.endY = e.clientY - rect.top;

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const x = Math.min(this.selection.startX, this.selection.endX);
            const y = Math.min(this.selection.startY, this.selection.endY);
            const w = Math.abs(this.selection.endX - this.selection.startX);
            const h = Math.abs(this.selection.endY - this.selection.startY);

            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.clearRect(x, y, w, h);
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, w, h);
        };

        canvas.onmouseup = () => {
            isDrawing = false;
        };
    }

    confirmSelection(canvas, img) {
        const x = Math.min(this.selection.startX, this.selection.endX);
        const y = Math.min(this.selection.startY, this.selection.endY);
        const w = Math.abs(this.selection.endX - this.selection.startX);
        const h = Math.abs(this.selection.endY - this.selection.startY);

        if (w < 10 || h < 10) {
            alert('Sélection trop petite');
            return;
        }

        const cropCanvas = document.createElement('canvas');
        const cropCtx = cropCanvas.getContext('2d');

        const scaleX = img.naturalWidth / img.getBoundingClientRect().width;
        const scaleY = img.naturalHeight / img.getBoundingClientRect().height;

        cropCanvas.width = w * scaleX;
        cropCanvas.height = h * scaleY;

        const sourceImg = new Image();
        sourceImg.onload = () => {
            cropCtx.drawImage(
                sourceImg,
                x * scaleX, y * scaleY, w * scaleX, h * scaleY,
                0, 0, cropCanvas.width, cropCanvas.height
            );

            cropCanvas.toBlob(blob => {
                const file = new File([blob], 'screenshot.png', { type: 'image/png' });
                this.app.handleFileSelect(file, 'qcm');
                this.closeCropInterface();
            }, 'image/png');
        };
        sourceImg.src = this.capturedImage;
    }

    closeCropInterface() {
        if (this.cropOverlay) {
            document.body.removeChild(this.cropOverlay);
            this.cropOverlay = null;
        }
    }
}