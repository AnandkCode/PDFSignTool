// Bundle required libraries (pdf-lib and fabric.js) here
// This would typically be done with a bundler like webpack
// For now, we'll load them from local files you would need to add

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize required libraries
    const { PDFDocument } = PDFLib;
    
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
        backgroundColor: 'transparent'
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

        try {
            const arrayBuffer = await file.arrayBuffer();
            state.uploadedPdfDoc = await PDFDocument.load(arrayBuffer);
            
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
            // Convert PDF page to PNG for preview
            const pngBytes = await state.uploadedPdfDoc.saveAsBase64({ format: 'png' });
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
        const svg = signatureCanvas.toSVG({
            width: state.currentSignatureSize,
            height: (state.currentSignatureSize * signatureCanvas.height) / signatureCanvas.width,
            viewBox: {
                x: 0,
                y: 0,
                width: signatureCanvas.width,
                height: signatureCanvas.height
            }
        });
        return svg;
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
        signatureCanvas.backgroundColor = 'transparent';
        state.savedSignature = null;
        elements.addSignatureBtn.disabled = true;
        showToast('Signature cleared');
    });

    elements.saveSignatureBtn.addEventListener('click', () => {
        if (signatureCanvas.getObjects().length > 0) {
            state.savedSignature = createSignatureSVG();
            elements.addSignatureBtn.disabled = false;
            showToast('Signature saved');
        } else {
            showToast('Please draw a signature first', true);
        }
    });

    elements.signatureSize.addEventListener('input', (e) => {
        state.currentSignatureSize = parseInt(e.target.value);
        if (state.savedSignature) {
            const signatureOverlays = document.querySelectorAll('.signature-overlay');
            signatureOverlays.forEach(overlay => {
                overlay.style.width = `${state.currentSignatureSize}px`;
            });
        }
    });

    elements.addSignatureBtn.addEventListener('click', () => {
        if (!state.savedSignature) {
            showToast('Please save a signature first', true);
            return;
        }

        const pageContainers = document.querySelectorAll('.page-container');
        pageContainers.forEach(container => {
            container.addEventListener('click', addSignatureToPage);
        });

        showToast('Click on a PDF page to add your signature');
    });

    async function addSignatureToPage(event) {
        const pageContainer = event.currentTarget;
        
        // Create signature element
        const signatureImg = document.createElement('div');
        signatureImg.innerHTML = state.savedSignature;
        signatureImg.classList.add('signature-overlay');
        signatureImg.style.width = `${state.currentSignatureSize}px`;
        signatureImg.style.position = 'absolute';
        signatureImg.style.cursor = 'move';
        signatureImg.draggable = false;

        // Make signature draggable
        let isDragging = false;
        let currentX;
        let currentY;
        let initialX;
        let initialY;
        let xOffset = 0;
        let yOffset = 0;

        const setTranslate = (xPos, yPos, el) => {
            el.style.transform = `translate3d(${xPos}px, ${yPos}px, 0)`;
        };

        const dragStart = (e) => {
            if (e.type === "touchstart") {
                initialX = e.touches[0].clientX - xOffset;
                initialY = e.touches[0].clientY - yOffset;
            } else {
                initialX = e.clientX - xOffset;
                initialY = e.clientY - yOffset;
            }

            if (e.target === signatureImg) {
                isDragging = true;
            }
        };

        const drag = (e) => {
            if (isDragging) {
                e.preventDefault();

                if (e.type === "touchmove") {
                    currentX = e.touches[0].clientX - initialX;
                    currentY = e.touches[0].clientY - initialY;
                } else {
                    currentX = e.clientX - initialX;
                    currentY = e.clientY - initialY;
                }

                xOffset = currentX;
                yOffset = currentY;

                setTranslate(currentX, currentY, signatureImg);
            }
        };

        const dragEnd = () => {
            isDragging = false;
        };

        signatureImg.addEventListener('mousedown', dragStart);
        signatureImg.addEventListener('touchstart', dragStart);

        document.addEventListener('mousemove', drag);
        document.addEventListener('touchmove', drag);

        document.addEventListener('mouseup', dragEnd);
        document.addEventListener('touchend', dragEnd);

        pageContainer.appendChild(signatureImg);
        elements.downloadPdfBtn.disabled = false;
        
        showToast('Signature added - Drag to position');
    }

    elements.downloadPdfBtn.addEventListener('click', async () => {
        if (!state.uploadedPdfDoc) {
            showToast('Please upload a PDF first', true);
            return;
        }

        setLoading(true);

        try {
            const pdfDoc = await PDFDocument.load(await elements.pdfUpload.files[0].arrayBuffer());
            const signatureOverlays = document.querySelectorAll('.signature-overlay');

            for (const overlay of signatureOverlays) {
                const pageContainer = overlay.closest('.page-container');
                const pageIndex = parseInt(pageContainer.dataset.pageIndex);
                const page = pdfDoc.getPages()[pageIndex];
                const { width, height } = page.getSize();

                // Get signature position relative to page
                const rect = overlay.getBoundingClientRect();
                const containerRect = pageContainer.getBoundingClientRect();
                
                const relativeX = (rect.left - containerRect.left) / containerRect.width;
                const relativeY = (rect.top - containerRect.top) / containerRect.height;

                // Convert SVG to PNG for embedding
                const svgBlob = new Blob([overlay.innerHTML], { type: 'image/svg+xml' });
                const svgUrl = URL.createObjectURL(svgBlob);
                const img = await fetch(svgUrl).then(r => r.blob());
                const signatureBytes = await img.arrayBuffer();
                
                const signatureImage = await pdfDoc.embedPng(signatureBytes);

                // Calculate signature dimensions
                const signatureWidth = (overlay.offsetWidth / containerRect.width) * width;
                const signatureHeight = (overlay.offsetHeight / containerRect.height) * height;

                // Add signature to PDF
                page.drawImage(signatureImage, {
                    x: relativeX * width,
                    y: height - (relativeY * height) - signatureHeight,
                    width: signatureWidth,
                    height: signatureHeight
                });

                URL.revokeObjectURL(svgUrl);
            }

            const pdfBytes = await pdfDoc.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'signed_document.pdf';
            link.click();

            showToast('PDF downloaded successfully');
        } catch (error) {
            console.error('Error saving PDF:', error);
            showToast('Error saving PDF. Please try again.', true);
        } finally {
            setLoading(false);
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
