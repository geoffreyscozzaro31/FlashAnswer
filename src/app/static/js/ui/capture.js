// src/app/static/js/ui/capture.js

/**
 * Handles the screen capture and cropping functionality.
 * This module is self-contained and creates its own UI, returning a Promise
 * that resolves with the cropped image File or null if cancelled.
 */
export class Capture {
    constructor(i18n) {
        this.i18n = i18n;
        this.overlay = null;
        this.selection = { startX: 0, startY: 0, endX: 0, endY: 0 };
        this.isDrawing = false;
    }

    /**
     * Checks if the browser supports the Screen Capture API.
     * @returns {boolean}
     */
    isSupported() {
        // 'ImageCapture' provides a more direct way to grab a frame.
        return 'getDisplayMedia' in navigator.mediaDevices && 'ImageCapture' in window;
    }

    /**
     * Starts the screen capture process.
     * @returns {Promise<File|null>} A Promise that resolves with the cropped File object or null on cancellation.
     */
    startCapture() {
        return new Promise(async (resolve, reject) => {
            if (!this.isSupported()) {
                alert(this.i18n.t('captureNotSupported'));
                // Rejecting the promise indicates a hard failure.
                return reject(new Error('Screen Capture API not supported.'));
            }

            try {
                // Request permission to capture the screen.
                const stream = await navigator.mediaDevices.getDisplayMedia({
                    video: { mediaSource: "screen", cursor: "crosshair" },
                    audio: false,
                });

                const track = stream.getVideoTracks()[0];
                // A brief delay helps ensure the stream is fully initialized.
                await new Promise(r => setTimeout(r, 200));

                const imageCapture = new ImageCapture(track);
                const bitmap = await imageCapture.grabFrame();

                // Stop the track immediately after capturing the frame to remove the browser's "sharing screen" UI.
                track.stop();

                // Convert the captured bitmap to a data URL to be used in the cropping UI.
                const canvas = document.createElement('canvas');
                canvas.width = bitmap.width;
                canvas.height = bitmap.height;
                canvas.getContext('2d').drawImage(bitmap, 0, 0);
                const imageUrl = canvas.toDataURL('image/png');

                // Show the cropping UI. The `resolve` function is passed along
                // to be called when the user confirms or cancels.
                this.showCropInterface(imageUrl, resolve);

            } catch (err) {
                console.error(this.i18n.t('captureGenericErrorLog'), err);
                const message = err.name === 'NotAllowedError'
                    ? this.i18n.t('capturePermissionDenied')
                    : this.i18n.t('captureErrorWithMessage', { message: err.message });
                alert(message);
                // Resolving with null indicates a user-cancellable failure (like denying permission).
                resolve(null);
            }
        });
    }

    /**
     * Creates and displays the cropping overlay UI.
     * @param {string} imageUrl - The data URL of the captured screen.
     * @param {Function} resolve - The resolve function of the parent Promise.
     */
    showCropInterface(imageUrl, resolve) {
        // Create overlay elements
        this.overlay = document.createElement('div');
        this.overlay.className = 'capture-overlay';

        const instructions = document.createElement('div');
        instructions.className = 'capture-overlay__instructions';
        instructions.textContent = this.i18n.t('captureInstructions');

        const img = document.createElement('img');
        img.src = imageUrl;
        img.className = 'capture-overlay__image';

        const canvas = document.createElement('canvas');
        canvas.className = 'capture-overlay__canvas';

        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'capture-overlay__button-container';

        const confirmBtn = document.createElement('button');
        confirmBtn.textContent = this.i18n.t('confirm');
        confirmBtn.className = 'capture-overlay__btn capture-overlay__btn--confirm';

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = this.i18n.t('cancel');
        cancelBtn.className = 'capture-overlay__btn capture-overlay__btn--cancel';

        // Assemble the UI
        buttonContainer.append(confirmBtn, cancelBtn);
        this.overlay.append(instructions, img, canvas, buttonContainer);
        document.body.appendChild(this.overlay);

        // Once the image is loaded, set the canvas dimensions to match the displayed image size.
        img.onload = () => {
            const rect = img.getBoundingClientRect();
            canvas.width = rect.width;
            canvas.height = rect.height;
            this.setupCanvasEvents(canvas);
        };

        // Bind events
        confirmBtn.onclick = () => this.confirmSelection(img, resolve);
        cancelBtn.onclick = () => {
            resolve(null); // Resolve with null for cancellation
            this.cleanup();
        };
    }

    /**
     * Sets up mouse and touch events for drawing the selection rectangle on the canvas.
     * @param {HTMLCanvasElement} canvas
     */
    setupCanvasEvents(canvas) {
        const ctx = canvas.getContext('2d');

        const getCoords = (e) => {
            const rect = canvas.getBoundingClientRect();
            // Handle both mouse and touch events
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            return { x: clientX - rect.left, y: clientY - rect.top };
        };

        const startDraw = (e) => {
            this.isDrawing = true;
            const { x, y } = getCoords(e);
            this.selection.startX = x;
            this.selection.startY = y;
        };

        const draw = (e) => {
            if (!this.isDrawing) return;
            e.preventDefault(); // Prevents page scroll on touch devices

            const { x, y } = getCoords(e);
            this.selection.endX = x;
            this.selection.endY = y;

            const selX = Math.min(this.selection.startX, this.selection.endX);
            const selY = Math.min(this.selection.startY, this.selection.endY);
            const selW = Math.abs(this.selection.endX - this.selection.startX);
            const selH = Math.abs(this.selection.endY - this.selection.startY);

            // Redraw the overlay and selection rectangle
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.clearRect(selX, selY, selW, selH);
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 2;
            ctx.strokeRect(selX, selY, selW, selH);
        };

        const stopDraw = () => {
            this.isDrawing = false;
        };

        // Mouse events
        canvas.onmousedown = startDraw;
        canvas.onmousemove = draw;
        canvas.onmouseup = stopDraw;
        canvas.onmouseleave = stopDraw;

        // Touch events
        canvas.ontouchstart = startDraw;
        canvas.ontouchmove = draw;
        canvas.ontouchend = stopDraw;
    }

    /**
     * Handles the final crop logic when the user confirms the selection.
     * @param {HTMLImageElement} img - The displayed screenshot image.
     * @param {Function} resolve - The resolve function of the parent Promise.
     */
    confirmSelection(img, resolve) {
        const w = Math.abs(this.selection.endX - this.selection.startX);
        const h = Math.abs(this.selection.endY - this.selection.startY);

        if (w < 10 || h < 10) {
            alert(this.i18n.t('selectionTooSmall'));
            return;
        }

        const x = Math.min(this.selection.startX, this.selection.endX);
        const y = Math.min(this.selection.startY, this.selection.endY);

        // Calculate scaling factor between the displayed image and its original resolution.
        const scaleX = img.naturalWidth / img.getBoundingClientRect().width;
        const scaleY = img.naturalHeight / img.getBoundingClientRect().height;

        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = w * scaleX;
        cropCanvas.height = h * scaleY;
        const cropCtx = cropCanvas.getContext('2d');

        // Draw the selected part of the original image onto the new canvas at full resolution.
        cropCtx.drawImage(
            img,
            x * scaleX, y * scaleY, w * scaleX, h * scaleY, // Source rectangle (from original image)
            0, 0, cropCanvas.width, cropCanvas.height      // Destination rectangle (on new canvas)
        );

        // Convert the cropped canvas to a Blob, then to a File.
        cropCanvas.toBlob(blob => {
            const file = new File([blob], 'screenshot.png', { type: 'image/png' });
            resolve(file); // Resolve the promise with the final File object.
            this.cleanup();
        }, 'image/png');
    }

    /**
     * Removes the overlay from the DOM and resets the state.
     */
    cleanup() {
        if (this.overlay) {
            document.body.removeChild(this.overlay);
            this.overlay = null;
            this.isDrawing = false;
            this.selection = {};
        }
    }
}