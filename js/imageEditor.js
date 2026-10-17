/**
 * js/imageEditor.js
 * Xiaomi Notes Fullscreen Image Annotator & Context Menu
 */
export class ImageEditorManager {
    constructor(editorElement, onImageModified) {
        this.editor = editorElement;
        this.onImageModified = onImageModified;
        this.selectedImage = null;

        // Context Menu Elements
        this.contextMenu = document.getElementById('image-context-menu');

        // Drawing Modal Elements
        this.modal = document.getElementById('doodle-editor-modal');
        this.canvas = document.getElementById('doodle-draw-canvas');
        this.ctx = this.canvas.getContext('2d');

        // Drawing State
        this.isDrawing = false;
        this.currentTool = 'highlighter';
        this.currentColor = '#facc15';
        this.brushWidth = 24;
        this.brushOpacity = 0.5;
        this.isStraightLine = false;
        this.startX = 0;
        this.startY = 0;

        this.undoHistory = [];
        this.redoHistory = [];

        this.initContextListeners();
        this.initDoodleListeners();
    }

    /* ================= 1. CONTEXT MENU LOGIC ================= */
    initContextListeners() {
        // Image par click/tap detect karna
        this.editor.addEventListener('click', (e) => {
            if (e.target.tagName === 'IMG') {
                e.stopPropagation();
                this.openContextMenu(e.target, e.clientX, e.clientY);
            } else {
                this.closeContextMenu();
            }
        });

        document.addEventListener('click', (e) => {
            if (!this.contextMenu.contains(e.target)) {
                this.closeContextMenu();
            }
        });

        // 1. Doodle / Draw over Image
        document.getElementById('ctx-action-doodle').addEventListener('click', () => {
            const img = this.selectedImage;
            this.closeContextMenu();
            if (img) this.openDoodleEditor(img);
        });

        // 2. Switch Size (Small / Large)
        document.getElementById('ctx-action-resize').addEventListener('click', () => {
            if (this.selectedImage) {
                this.selectedImage.classList.toggle('small-size');
                this.closeContextMenu();
                this.onImageModified();
            }
        });

        // 3. Save / Download image
        document.getElementById('ctx-action-save').addEventListener('click', () => {
            if (this.selectedImage) {
                const link = document.createElement('a');
                link.download = `Note_Image_${Date.now()}.png`;
                link.href = this.selectedImage.src;
                link.click();
                this.closeContextMenu();
            }
        });

        // 4. Cut
        document.getElementById('ctx-action-cut').addEventListener('click', () => {
            if (this.selectedImage) {
                navigator.clipboard.writeText(this.selectedImage.src);
                this.selectedImage.remove();
                this.closeContextMenu();
                this.onImageModified();
            }
        });

        // 5. Copy
        document.getElementById('ctx-action-copy').addEventListener('click', () => {
            if (this.selectedImage) {
                navigator.clipboard.writeText(this.selectedImage.src);
                alert('Image copied to clipboard!');
                this.closeContextMenu();
            }
        });

        // 6. Share
        document.getElementById('ctx-action-share').addEventListener('click', async () => {
            if (this.selectedImage && navigator.share) {
                try {
                    const blob = await (await fetch(this.selectedImage.src)).blob();
                    const file = new File([blob], 'image.png', { type: blob.type });
                    await navigator.share({ files: [file], title: 'Note Image' });
                } catch (e) { }
            }
            this.closeContextMenu();
        });

        // 7. Delete Image (From context menu)
        document.getElementById('ctx-action-delete').addEventListener('click', () => {
            if (this.selectedImage) {
                this.selectedImage.remove();
                this.selectedImage = null;
                this.closeContextMenu();
                this.onImageModified();
            }
        });
    }

    openContextMenu(imgElement, x, y) {
        this.selectedImage = imgElement;
        document.querySelectorAll('.note-body img').forEach((img) => img.classList.remove('selected-img'));
        imgElement.classList.add('selected-img');

        // Position check
        let top = y + window.scrollY;
        let left = x + window.scrollX;

        if (left + 240 > window.innerWidth) left = window.innerWidth - 250;
        if (top + 280 > window.innerHeight + window.scrollY) top = top - 280;

        this.contextMenu.style.top = `${Math.max(10, top)}px`;
        this.contextMenu.style.left = `${Math.max(10, left)}px`;
        this.contextMenu.classList.remove('d-none');
    }

    closeContextMenu() {
        this.contextMenu.classList.add('d-none');
        if (this.selectedImage) {
            this.selectedImage.classList.remove('selected-img');
        }
    }

    /* ================= 2. FULLSCREEN DOODLE LOGIC ================= */
    openDoodleEditor(imgElement) {
        this.selectedImage = imgElement;
        this.undoHistory = [];
        this.redoHistory = [];

        const baseImg = new Image();
        baseImg.crossOrigin = 'anonymous';
        baseImg.onload = () => {
            this.canvas.width = baseImg.naturalWidth || baseImg.width || 800;
            this.canvas.height = baseImg.naturalHeight || baseImg.height || 600;

            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.drawImage(baseImg, 0, 0);

            this.saveUndoState();
            this.modal.classList.remove('d-none');
        };
        baseImg.src = imgElement.src;
    }

    saveUndoState() {
        this.undoHistory.push(this.canvas.toDataURL());
        if (this.undoHistory.length > 30) this.undoHistory.shift();
        this.redoHistory = [];
    }

    initDoodleListeners() {
        const getPos = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.width / rect.width;
            const scaleY = this.canvas.height / rect.height;
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            return {
                x: (clientX - rect.left) * scaleX,
                y: (clientY - rect.top) * scaleY
            };
        };

        const startDraw = (e) => {
            e.preventDefault();
            this.isDrawing = true;
            const pos = getPos(e);
            this.startX = pos.x;
            this.startY = pos.y;

            this.ctx.beginPath();
            this.ctx.moveTo(pos.x, pos.y);
        };

        const drawMove = (e) => {
            if (!this.isDrawing) return;
            e.preventDefault();
            const pos = getPos(e);

            this.ctx.lineCap = 'round';
            this.ctx.lineJoin = 'round';

            if (this.currentTool === 'eraser') {
                this.ctx.globalCompositeOperation = 'destination-out';
                this.ctx.lineWidth = 30;
                this.ctx.lineTo(pos.x, pos.y);
                this.ctx.stroke();
            } else {
                this.ctx.globalCompositeOperation = 'source-over';
                this.ctx.strokeStyle = this.currentColor;

                if (this.currentTool === 'highlighter') {
                    this.ctx.globalAlpha = this.brushOpacity;
                    this.ctx.lineWidth = this.brushWidth;
                } else if (this.currentTool === 'pen') {
                    this.ctx.globalAlpha = 1;
                    this.ctx.lineWidth = 5;
                } else if (this.currentTool === 'pencil') {
                    this.ctx.globalAlpha = 0.8;
                    this.ctx.lineWidth = 2;
                } else {
                    this.ctx.globalAlpha = 1;
                    this.ctx.lineWidth = 8;
                }

                if (!this.isStraightLine) {
                    this.ctx.lineTo(pos.x, pos.y);
                    this.ctx.stroke();
                }
            }
        };

        const stopDraw = (e) => {
            if (!this.isDrawing) return;
            if (this.isStraightLine && this.currentTool !== 'eraser') {
                const pos = getPos(e);
                this.ctx.lineTo(pos.x, pos.y);
                this.ctx.stroke();
            }
            this.isDrawing = false;
            this.ctx.globalAlpha = 1;
            this.saveUndoState();
        };

        this.canvas.addEventListener('mousedown', startDraw);
        this.canvas.addEventListener('mousemove', drawMove);
        window.addEventListener('mouseup', stopDraw);

        this.canvas.addEventListener('touchstart', startDraw, { passive: false });
        this.canvas.addEventListener('touchmove', drawMove, { passive: false });
        window.addEventListener('touchend', stopDraw);

        // Cancel Button
        document.getElementById('doodle-btn-cancel').addEventListener('click', () => {
            this.modal.classList.add('d-none');
        });

        // Save Button
        document.getElementById('doodle-btn-save').addEventListener('click', () => {
            if (this.selectedImage) {
                this.selectedImage.src = this.canvas.toDataURL('image/png');
                this.onImageModified();
            }
            this.modal.classList.add('d-none');
        });

        // Undo / Redo
        document.getElementById('doodle-btn-undo').addEventListener('click', () => {
            if (this.undoHistory.length > 1) {
                this.redoHistory.push(this.undoHistory.pop());
                const prev = new Image();
                prev.onload = () => {
                    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
                    this.ctx.drawImage(prev, 0, 0);
                };
                prev.src = this.undoHistory[this.undoHistory.length - 1];
            }
        });

        document.getElementById('doodle-btn-redo').addEventListener('click', () => {
            if (this.redoHistory.length > 0) {
                const nextState = this.redoHistory.pop();
                this.undoHistory.push(nextState);
                const nextImg = new Image();
                nextImg.onload = () => {
                    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
                    this.ctx.drawImage(nextImg, 0, 0);
                };
                nextImg.src = nextState;
            }
        });

        // Tool Stations Selection
        document.querySelectorAll('.tool-station-btn[data-tool]').forEach((btn) => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tool-station-btn').forEach((b) => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentTool = btn.getAttribute('data-tool');

                // Toggle props modal
                document.getElementById('props-tool-title').innerText = btn.getAttribute('title');
                document.getElementById('doodle-props-popup').classList.toggle('d-none');
            });
        });

        // Quick Config Button
        document.getElementById('doodle-btn-quick-config').addEventListener('click', () => {
            document.getElementById('doodle-props-popup').classList.toggle('d-none');
        });

        // Properties Inputs
        const propWidth = document.getElementById('doodle-prop-width');
        const propOpacity = document.getElementById('doodle-prop-opacity');
        const colorPreview = document.getElementById('props-color-preview');
        const straightToggle = document.getElementById('doodle-prop-straight');

        propWidth.addEventListener('input', (e) => {
            this.brushWidth = parseInt(e.target.value);
        });

        propOpacity.addEventListener('input', (e) => {
            this.brushOpacity = parseInt(e.target.value) / 100;
            colorPreview.style.opacity = this.brushOpacity;
        });

        straightToggle.addEventListener('change', (e) => {
            this.isStraightLine = e.target.checked;
        });

        document.querySelectorAll('.color-circle[data-color]').forEach((c) => {
            c.addEventListener('click', () => {
                document.querySelectorAll('.color-circle').forEach((el) => el.classList.remove('active'));
                c.classList.add('active');
                this.currentColor = c.getAttribute('data-color');
                colorPreview.style.background = this.currentColor;
                document.getElementById('dock-active-color-bubble').style.background = this.currentColor;
            });
        });

        document.getElementById('doodle-prop-custom-color').addEventListener('input', (e) => {
            this.currentColor = e.target.value;
            colorPreview.style.background = this.currentColor;
            document.getElementById('dock-active-color-bubble').style.background = this.currentColor;
        });
    }
}