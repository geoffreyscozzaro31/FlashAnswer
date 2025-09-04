/**
 * Manages continuous screen capture of a user-selected browser tab.
 * This class is stateful and controls the entire lifecycle from stream acquisition
 * to background frame grabbing.
 */
export class Capture {
    constructor(i18n) {
        this.i18n = i18n;

        // State properties
        this.stream = null;
        this.videoEl = null;
        this.captureInterval = null;
        this.lastCapturedFile = null;
        this.isCapturing = false;
    }

    isSupported() {
        return 'getDisplayMedia' in navigator.mediaDevices;
    }

    /**
     * Starts the screen capture process by asking the user to select a tab.
     * Once selected, it begins capturing a frame every second.
     * @returns {Promise<boolean>} Resolves true if capture started, false otherwise.
     */
    async startCapture() {
        if (!this.isSupported()) {
            alert(this.i18n.t('captureNotSupported'));
            return false;
        }

        try {
            // Request permission to capture the screen (tab, window, or screen).
            this.stream = await navigator.mediaDevices.getDisplayMedia({
                video: { mediaSource: "screen" },
                audio: false,
            });

            // Create a hidden video element to play the stream.
            this.videoEl = document.createElement('video');
            this.videoEl.style.display = 'none';
            document.body.appendChild(this.videoEl);
            this.videoEl.srcObject = this.stream;
            await this.videoEl.play();

            this.isCapturing = true;

            // Start capturing frames every second.
            this.captureInterval = setInterval(() => this.captureFrame(), 1000);

            // Notify the UI that capture has started.
            document.dispatchEvent(new CustomEvent('captureStateChange', { detail: { isCapturing: true } }));
            return true;

        } catch (err) {
            console.error(this.i18n.t('captureGenericErrorLog'), err);
            const message = err.name === 'NotAllowedError'
                ? this.i18n.t('capturePermissionDenied')
                : this.i18n.t('captureErrorWithMessage', { message: err.message });
            alert(message);
            this.cleanup(); // Clean up if something went wrong.
            return false;
        }
    }

    /**
     * Captures a single frame from the video stream and stores it as a File object.
     */
    captureFrame() {
        if (!this.videoEl || this.videoEl.paused || this.videoEl.ended) return;

        const canvas = document.createElement('canvas');
        canvas.width = this.videoEl.videoWidth;
        canvas.height = this.videoEl.videoHeight;
        const ctx = canvas.getContext('2d');

        // Draw the current video frame to the canvas.
        ctx.drawImage(this.videoEl, 0, 0, canvas.width, canvas.height);

        // Convert the canvas to a Blob and then to a File.
        canvas.toBlob(blob => {
            if (blob) {
                this.lastCapturedFile = new File([blob], 'capture.png', { type: 'image/png' });
            }
        }, 'image/png');
    }

    /**
     * Returns the most recently captured frame.
     * @returns {File|null}
     */
    getLatestCapture() {
        return this.lastCapturedFile;
    }

    /**
     * Stops the capture and cleans up all resources.
     */
    stopCapture() {
        if (this.captureInterval) clearInterval(this.captureInterval);
        this.cleanup();
        // Notify the UI that capture has stopped.
        document.dispatchEvent(new CustomEvent('captureStateChange', { detail: { isCapturing: false } }));
    }

    /**
     * Private cleanup method to stop streams and remove elements.
     */
    cleanup() {
        this.isCapturing = false;
        if (this.captureInterval) {
            clearInterval(this.captureInterval);
            this.captureInterval = null;
        }
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        if (this.videoEl) {
            document.body.removeChild(this.videoEl);
            this.videoEl = null;
        }
        this.lastCapturedFile = null;
    }
}