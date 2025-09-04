/**
 * Manages continuous screen capture of a user-selected browser tab.
 * This class is stateful and controls the entire lifecycle from stream acquisition
 * to background frame grabbing and automatic change detection.
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

        // Change detection properties
        this.previousFrameData = null;
        this.isProcessingChange = false; // Prevents spamming requests for the same change
        this.CHANGE_THRESHOLD = 0.02; // 15% pixel difference
    }

    isSupported() {
        return 'getDisplayMedia' in navigator.mediaDevices;
    }

    async startCapture() {
        if (!this.isSupported()) {
            alert(this.i18n.t('captureNotSupported'));
            return false;
        }

        try {
            this.stream = await navigator.mediaDevices.getDisplayMedia({
                video: { mediaSource: "screen" },
                audio: false,
            });

            this.videoEl = document.createElement('video');
            this.videoEl.style.display = 'none';
            document.body.appendChild(this.videoEl);
            this.videoEl.srcObject = this.stream;
            await this.videoEl.play();

            this.isCapturing = true;

            // Start the capture loop
            this.captureInterval = setInterval(() => this.captureAndProcessFrame(), 1000);

            document.dispatchEvent(new CustomEvent('captureStateChange', { detail: { isCapturing: true } }));
            return true;

        } catch (err) {
            console.error(this.i18n.t('captureGenericErrorLog'), err);
            this.cleanup();
            return false;
        }
    }

    captureAndProcessFrame() {
        if (!this.videoEl || this.videoEl.paused || this.videoEl.ended) return;

        const canvas = document.createElement('canvas');
        canvas.width = this.videoEl.videoWidth;
        canvas.height = this.videoEl.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(this.videoEl, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(blob => {
            if (blob) {
                this.lastCapturedFile = new File([blob], 'capture.png', { type: 'image/png' });
            }
        }, 'image/png');

        const currentFrameData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        this.detectChange(currentFrameData);
        this.previousFrameData = currentFrameData;
    }

    detectChange(currentFrameData) {
        if (this.isProcessingChange) return;

        // The very first frame is always considered a significant change
        if (!this.previousFrameData) {
            this.isProcessingChange = true;
            document.dispatchEvent(new CustomEvent('significantChangeDetected'));
            return;
        }

        const width = currentFrameData.width;
        const height = currentFrameData.height;
        if (width !== this.previousFrameData.width || height !== this.previousFrameData.height) return;

        const data1 = this.previousFrameData.data;
        const data2 = currentFrameData.data;
        let diffPixels = 0;
        const totalPixels = width * height;

        for (let i = 0; i < data1.length; i += 4) {
            if (Math.abs(data1[i] - data2[i]) > 10 || Math.abs(data1[i+1] - data2[i+1]) > 10 || Math.abs(data1[i+2] - data2[i+2]) > 10) {
                diffPixels++;
            }
        }

        const diffRatio = diffPixels / totalPixels;
        if (diffRatio > this.CHANGE_THRESHOLD) {
            this.isProcessingChange = true;
            document.dispatchEvent(new CustomEvent('significantChangeDetected'));
        }
    }

    resetChangeDetection() {
        this.isProcessingChange = false;
    }

    getLatestCapture() {
        return this.lastCapturedFile;
    }

    stopCapture() {
        if (this.captureInterval) clearInterval(this.captureInterval);
        this.cleanup();
        document.dispatchEvent(new CustomEvent('captureStateChange', { detail: { isCapturing: false } }));
    }

    cleanup() {
        this.isCapturing = false;
        this.previousFrameData = null;
        this.isProcessingChange = false;
        if (this.captureInterval) { clearInterval(this.captureInterval); this.captureInterval = null; }
        if (this.stream) { this.stream.getTracks().forEach(track => track.stop()); this.stream = null; }
        if (this.videoEl) { document.body.removeChild(this.videoEl); this.videoEl = null; }
        this.lastCapturedFile = null;
    }
}