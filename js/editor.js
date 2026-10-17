export class EditorManager {
    constructor(editorEl, onContentChange) {
        this.editor = editorEl;
        this.toolbar = document.getElementById('floating-toolbar');
        this.onContentChange = onContentChange;

        this.undoStack = [];
        this.redoStack = [];
        this.savedRange = null;

        this.bindSelection();
        this.bindFormatting();
        this.bindUndoRedo();
    }

    pushState() {
        this.undoStack.push(this.editor.innerHTML);
        if (this.undoStack.length > 50) this.undoStack.shift();
        this.redoStack = [];
    }

    saveSelection() {
        const sel = window.getSelection();
        if (sel.rangeCount > 0) {
            this.savedRange = sel.getRangeAt(0).cloneRange();
        }
    }

    restoreSelection() {
        if (this.savedRange) {
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(this.savedRange);
        }
    }

    bindSelection() {
        document.addEventListener('selectionchange', () => {
            const sel = window.getSelection();
            if (!sel.isCollapsed && this.editor.contains(sel.anchorNode)) {
                this.saveSelection();
                const range = sel.getRangeAt(0);
                const rect = range.getBoundingClientRect();

                if (window.innerWidth > 768) {
                    const top = rect.top + window.scrollY - 54;
                    const left = rect.left + window.scrollX - 20;
                    this.toolbar.style.top = `${Math.max(10, top)}px`;
                    this.toolbar.style.left = `${Math.max(10, left)}px`;
                }
                this.toolbar.classList.remove('d-none');
            } else {
                setTimeout(() => {
                    const activeSel = window.getSelection();
                    if (activeSel.isCollapsed) {
                        this.toolbar.classList.add('d-none');
                    }
                }, 200);
            }
        });
    }

    bindFormatting() {
        // Formatting Buttons (Bold, Italic, Underline)
        this.toolbar.querySelectorAll('button[data-cmd]').forEach((btn) => {
            btn.addEventListener('mousedown', (e) => {
                e.preventDefault(); // Prevents selection loss
                this.restoreSelection();
                this.pushState();
                const cmd = btn.getAttribute('data-cmd');
                document.execCommand(cmd, false, null);
                this.onContentChange();
            });
        });

        // Dedicated Background Highlight Tool (Soft Yellow Marker)
        const highlightBtn = document.getElementById('btn-text-highlight');
        if (highlightBtn) {
            highlightBtn.addEventListener('mousedown', (e) => {
                e.preventDefault();
                this.restoreSelection();
                this.pushState();

                const sel = window.getSelection();
                if (sel.rangeCount > 0 && !sel.isCollapsed) {
                    const range = sel.getRangeAt(0);
                    const mark = document.createElement('mark');
                    mark.className = 'note-highlight';
                    mark.appendChild(range.extractContents());
                    range.insertNode(mark);
                    this.onContentChange();
                }
            });
        }

        // Color Dots Palette (Direct Text Color)
        this.toolbar.querySelectorAll('.color-dot').forEach((dot) => {
            dot.addEventListener('mousedown', (e) => {
                e.preventDefault();
                this.restoreSelection();
                this.pushState();
                const color = dot.getAttribute('data-color');
                document.execCommand('foreColor', false, color);
                this.onContentChange();
            });
        });

        // Copy Button
        document.getElementById('btn-text-copy')?.addEventListener('mousedown', (e) => {
            e.preventDefault();
            document.execCommand('copy');
        });

        // Cut Button
        document.getElementById('btn-text-cut')?.addEventListener('mousedown', (e) => {
            e.preventDefault();
            this.restoreSelection();
            this.pushState();
            document.execCommand('cut');
            this.onContentChange();
        });
    }

    bindUndoRedo() {
        document.getElementById('btn-undo')?.addEventListener('click', () => this.undo());
        document.getElementById('btn-redo')?.addEventListener('click', () => this.redo());

        this.editor.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                this.undo();
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
                e.preventDefault();
                this.redo();
            }
        });
    }

    undo() {
        if (this.undoStack.length > 0) {
            this.redoStack.push(this.editor.innerHTML);
            this.editor.innerHTML = this.undoStack.pop();
            this.attachDynamicListeners();
            this.onContentChange();
        }
    }

    redo() {
        if (this.redoStack.length > 0) {
            this.undoStack.push(this.editor.innerHTML);
            this.editor.innerHTML = this.redoStack.pop();
            this.attachDynamicListeners();
            this.onContentChange();
        }
    }

    insertBlockHTML(html) {
        this.pushState();
        this.editor.focus();
        document.execCommand('insertHTML', false, html);
        this.attachDynamicListeners();
        this.onContentChange();
    }

    attachDynamicListeners() {
        this.editor.querySelectorAll('.btn-block-del').forEach((btn) => {
            btn.onclick = (e) => {
                e.stopPropagation();
                this.pushState();
                const block = btn.closest('.embed-block');
                if (block) block.remove();
                this.onContentChange();
            };
        });
    }
}