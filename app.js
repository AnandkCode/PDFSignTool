document.addEventListener('DOMContentLoaded', async () => {
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
        prevPageBtn: document.getElementById('prev-page'),
        nextPageBtn: document.getElementById('next-page'),
        currentPageEl: document.getElementById('current-page'),
        totalPagesEl: document.getElementById('total-pages'),
        toast: document.getElementById('toast')
    };

    // State
    const state = {
        uploadedPdfDoc: null,
        savedSignature: null,
        isProcessing: false,
        currentSignatureSize: 150,
        currentPage: 0,
        totalPages: 0,
        pdfPages: []
    };

    // Initialize signature canvas
    const signatureCanvas = new fabric.Canvas(elements.signatureCanvasEl, {
        isDrawingMode: true,
        width: elements.signatureCanvasEl.offsetWidth,
        height: elements.signatureCanvasEl.offsetHeight,
        backgroundColor: 'white'
    });

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

    function updatePaginationControls() {
        elements.currentPageEl.textContent = state.currentPage + 1;
        elements.totalPagesEl.textContent = state.totalPages;
        elements.prevPageBtn.disabled = state.currentPage === 0;
        elements.nextPageBtn.disabled = state.currentPage >= state.totalPages - 1;
    }

    async function loadPdfPage(pageIndex) {
        if (!state.pdfPages[pageIndex]) {
            const page = state.uploadedPdfDoc.getPages()[pageIndex];
            const scale = 2; // Increased scale for better quality
            const viewport = page.getSize();
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            
            canvas.width = viewport.width * scale;
            canvas.height = viewport.height * scale;
            
            // Convert PDF page to PNG with higher quality
            const pngBytes = await page.translateToBase64({
                format: 'png',
                width: canvas.width,
                height: canvas.height
            });
            
            state.pdfPages[pageIndex] = `data:image/png;base64,${pngBytes}`;
        }
        
        elements.pdfPreview.innerHTML = `
            <img src="${state.pdfPages[pageIndex]}" 
                 alt="Page ${pageIndex + 1}" 
                 style="width: 100%; height: auto;">
        `;
    }

    // PDF Processing Functions
    async function processPdfUpload(file) {
        if (!file || file.type !== 'application/pdf') {
            throw new Error('Please upload a valid PDF file.');
        }

        setLoading(true);
        elements.uploadError.style.display = 'none';
        elements.pdfPreview.innerHTML = '<div class="loading">Loading PDF...</div>';

        try {
            const arrayBuffer = await file.arrayBuffer();
            state.uploadedPdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
            
            state.totalPages = state.uploadedPdfDoc.getPageCount();
            state.currentPage = 0;
            state.pdfPages = new Array(state.totalPages).fill(null);
            
            updatePaginationControls();
            await loadPdfPage(0);
            
            elements.addSignatureBtn.disabled = true;
            elements.downloadPdfBtn.disabled = true;
            
            showToast('PDF loaded successfully');
        } catch (error) {
            console.error('PDF processing error:', error);
            elements.uploadError.textContent = 'Error processing PDF. Please try a different file.';
            elements.uploadError.style.display = 'block';
            elements.pdfPreview.innerHTML = '<p class="text-center">Error loading PDF</p>';
        } finally {
            setLoading(false);
        }
    }

    // Event Listeners
    elements.pdfUpload.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            await processPdfUpload(file);
        }
    });

    elements.prevPageBtn.addEventListener('click', async () => {
        if (state.currentPage > 0) {
            state.currentPage--;
            await loadPdfPage(state.currentPage);
            updatePaginationControls();
        }
    });

    elements.nextPageBtn.addEventListener('click', async () => {
        if (state.currentPage < state.totalPages - 1) {
            state.currentPage++;
            await loadPdfPage(state.currentPage);
            updatePaginationControls();
        }
    });

    // ... (rest of your existing event listeners for signature handling)
    elements.clearSignatureBtn.addEventListener('click', () => {
        signatureCanvas.clear();
        signatureCanvas.backgroundColor = 'white';
        state.savedSignature = null;
        elements.addSignatureBtn.disabled = true;
        showToast('Signature cleared');
    });

    elements.saveSignatureBtn.addEventListener('click', () => {
        if (signatureCanvas.getObjects().length > 0) {
            state.savedSignature = signatureCanvas.toDataURL();
            elements.addSignatureBtn.disabled = false;
            showToast('Signature saved');
        } else {
            showToast('Please draw a signature first', true);
        }
    });

    // Handle window resize
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            signatureCanvas.setDimensions({
                width: elements.signatureCanvasEl.offsetWidth,
                height: elements.signatureCanvasEl.offsetHeight
            });
        }, 250);
    });
});
