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
        this.captureBtn.title = this.app.i18n.t('captureNotSupported');
        this.captureBtn.classList.add('disabled');
    }

    async startCapture() {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: { mediaSource: "screen", cursor: "crosshair" },
                audio: false,
                preferCurrentTab: false,
            });

            const track = stream.getVideoTracks()[0];
            // Brief delay to ensure the stream is ready
            await new Promise(resolve => setTimeout(resolve, 200));

            // Use ImageCapture API if available (more modern)
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
            } else { // Fallback for older browsers
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
            console.error(this.app.i18n.t('captureGenericErrorLog'), err);
            // Use translation keys for user-facing error messages
            if (err.name === 'NotAllowedError') {
                this.app.setUIState('error', this.app.i18n.t('capturePermissionDenied'));
            } else {
                this.app.setUIState('error', this.app.i18n.t('captureErrorWithMessage', { message: err.message }));
            }
        }
    }

    showCropInterface() {
        this.cropOverlay = document.createElement('div');
        this.cropOverlay.id = 'qcm-crop-overlay';

        const img = document.createElement('img');
        img.src = this.capturedImage;
        img.classList.add('qcm-captured-image');

        const canvas = document.createElement('canvas');
        canvas.classList.add('qcm-selection-canvas');

        const instructions = document.createElement('div');
        instructions.classList.add('qcm-instructions');
        // Use translation key for instructions
        instructions.textContent = this.app.i18n.t('captureInstructions');

        const buttons = document.createElement('div');
        buttons.classList.add('qcm-button-container');

        const confirmBtn = document.createElement('button');
        // Use translation key for button text
        confirmBtn.textContent = this.app.i18n.t('confirm');
        confirmBtn.classList.add('qcm-btn', 'qcm-btn--confirm');

        const cancelBtn = document.createElement('button');
        // Use translation key for button text
        cancelBtn.textContent = this.app.i18n.t('cancel');
        cancelBtn.classList.add('qcm-btn', 'qcm-btn--cancel');

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
            canvas.style.width = `${rect.width}px`;
            canvas.style.height = `${rect.height}px`;

            this.setupCanvasEvents(canvas);
        };

        confirmBtn.onclick = () => this.confirmSelection(img);
        cancelBtn.onclick = () => this.closeCropInterface();
    }

    setupCanvasEvents(canvas) {
        const ctx = canvas.getContext('2d');
        let isDrawing = false;

        const getCoords = (e) => {
            const rect = canvas.getBoundingClientRect();
            return {
                x: (e.touches ? e.touches[0].clientX : e.clientX) - rect.left,
                y: (e.touches ? e.touches[0].clientY : e.clientY) - rect.top,
            };
        };

        const startDraw = (e) => {
            isDrawing = true;
            const { x, y } = getCoords(e);
            this.selection.startX = x;
            this.selection.startY = y;
        };

        const draw = (e) => {
            if (!isDrawing) return;
            e.preventDefault();

            const { x, y } = getCoords(e);
            this.selection.endX = x;
            this.selection.endY = y;

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const selX = Math.min(this.selection.startX, this.selection.endX);
            const selY = Math.min(this.selection.startY, this.selection.endY);
            const selW = Math.abs(this.selection.endX - this.selection.startX);
            const selH = Math.abs(this.selection.endY - this.selection.startY);

            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.clearRect(selX, selY, selW, selH);
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 2;
            ctx.strokeRect(selX, selY, selW, selH);
        };

        const stopDraw = () => {
            isDrawing = false;
        };

        // Mouse events
        canvas.onmousedown = startDraw;
        canvas.onmousemove = draw;
        canvas.onmouseup = stopDraw;
        canvas.onmouseleave = stopDraw; // Stop if mouse leaves canvas

        // Touch events
        canvas.ontouchstart = startDraw;
        canvas.ontouchmove = draw;
        canvas.ontouchend = stopDraw;
    }


    confirmSelection(img) {
        const w = Math.abs(this.selection.endX - this.selection.startX);
        const h = Math.abs(this.selection.endY - this.selection.startY);

        if (w < 10 || h < 10) {
            // Use translation key for the alert
            alert(this.app.i18n.t('selectionTooSmall'));
            return;
        }

        const x = Math.min(this.selection.startX, this.selection.endX);
        const y = Math.min(this.selection.startY, this.selection.endY);

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