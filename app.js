// Initialize the application when DOM is fully loaded
document.addEventListener('DOMContentLoaded', async () => {
    // Check if required libraries are loaded
    if (typeof PDFLib === 'undefined' || typeof fabric === 'undefined') {
        showToast('Required libraries not loaded. Please check your configuration.', true);
        return;
    }

    // DOM Elements
    const elements = {
        pdfUpload: document.getElementById('pdf-upload'),
        uploadError: document.getElementById('upload-error'),
        pdfPreview: document.getElementById('pdf-preview'),
        signatureCanvasEl: document.getElementById('signature-canvas'),
        clearSignatureBtn: document.getElementById('clear-signature'),
        saveSignatureBtn: document.getElementById('save-signature'),
        addSignatureBtn: document.getElementById('add-signature'),
        downloadPdfBtn: document.getElementById('download-pdf'),
        loadingSpinner: document.getElementById('loading-spinner'),
        signatureSize: document.getElementById('signature-size'),
        toast: document.getElementById('toast')
    };

    // State
    const state = {
        uploadedPdfDoc: null,
        savedSignature: null,
        isProcessing: false,
        currentSignatureSize: 150
    };

    // Initialize signature canvas
    const signatureCanvas = new fabric.Canvas(elements.signatureCanvasEl, {
        isDrawingMode: true,
        width: elements.signatureCanvasEl.offsetWidth,
        height: elements.signatureCanvasEl.offsetHeight,
        backgroundColor: 'white'
    });

    // Set up drawing brush
    signatureCanvas.freeDrawingBrush = new fabric.PencilBrush(signatureCanvas);
    signatureCanvas.freeDrawingBrush.width = 2;
    signatureCanvas.freeDrawingBrush.color = '#000000';

    // Utility Functions
    function showToast(message, isError = false) {
        elements.toast.textContent = message;
        elements.toast.style.display = 'block';
        elements.toast.style.backgroundColor = isError ? '#fee2e2' : '#dcfce7';
        elements.toast.style.color = isError ? '#dc2626' : '#16a34a';
        setTimeout(() => {
            elements.toast.style.display = 'none';
        }, 3000);
    }

    function setLoading(loading) {
        state.isProcessing = loading;
        elements.loadingSpinner.style.display = loading ? 'block' : 'none';
        elements.pdfUpload.disabled = loading;
        elements.clearSignatureBtn.disabled = loading;
        elements.saveSignatureBtn.disabled = loading;
    }

    // PDF Processing Functions
    async function processPdfUpload(file) {
        if (!file || file.type !== 'application/pdf') {
            throw new Error('Please upload a valid PDF file.');
        }

        setLoading(true);
        elements.uploadError.style.display = 'none';
        elements.pdfPreview.innerHTML = '<div class="loading">Loading PDF pages...</div>';

        try {
            const arrayBuffer = await file.arrayBuffer();
            state.uploadedPdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
            
            // Clear previous preview
            elements.pdfPreview.innerHTML = '';
            
            // Process pages
            const pageCount = state.uploadedPdfDoc.getPageCount();
            
            for (let i = 0; i < pageCount; i++) {
                await renderPdfPage(i);
            }

            elements.addSignatureBtn.disabled = true;
            elements.downloadPdfBtn.disabled = true;
            
            showToast('PDF loaded successfully');
        } catch (error) {
            console.error('PDF processing error:', error);
            elements.uploadError.textContent = 'Error processing PDF. Please try a different file.';
            elements.uploadError.style.display = 'block';
            elements.pdfPreview.innerHTML = '<p class="text-center">Error loading PDF. Please try again.</p>';
        } finally {
            setLoading(false);
        }
    }

    async function renderPdfPage(pageIndex) {
        const page = state.uploadedPdfDoc.getPages()[pageIndex];
        const pageContainer = document.createElement('div');
        pageContainer.classList.add('page-container');
        pageContainer.dataset.pageIndex = pageIndex;

        try {
            // Convert the specific page to PNG
            const pngBytes = await page.translateToBase64({ format: 'png' });
            const img = document.createElement('img');
            img.src = `data:image/png;base64,${pngBytes}`;
            img.dataset.pageIndex = pageIndex;
            img.alt = `Page ${pageIndex + 1}`;
            
            pageContainer.appendChild(img);
            elements.pdfPreview.appendChild(pageContainer);
        } catch (error) {
            console.error(`Error rendering page ${pageIndex + 1}:`, error);
            showToast(`Error rendering page ${pageIndex + 1}`, true);
        }
    }

    // Signature Functions
    function createSignatureSVG() {
        return signatureCanvas.toSVG({
            width: state.currentSignatureSize,
            height: (state.currentSignatureSize * signatureCanvas.height) / signatureCanvas.width,
            viewBox: {
                x: 0,
                y: 0,
                width: signatureCanvas.width,
                height: signatureCanvas.height
            }
        });
    }

    // Event Listeners
    elements.pdfUpload.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            await processPdfUpload(file);
        }
    });

    elements.clearSignatureBtn.addEventListener('click', () => {
        signatureCanvas.clear();
        signatureCanvas.backgroundColor = 'white';
