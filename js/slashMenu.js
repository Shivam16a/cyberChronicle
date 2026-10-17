export class SlashMenu {
    constructor(editorElement, onSelectBlock) {
        this.editor = editorElement;
        this.popup = document.getElementById('slash-popup');
        this.onSelectBlock = onSelectBlock;
        this.savedSlashRange = null; // Exact memory of where '/' was typed
        this.bindEvents();
    }

    bindEvents() {
        // 1. Keyup handler: '/' par open karna, Backspace par agar '/' mit jaye to turant hide karna
        this.editor.addEventListener('keyup', (e) => {
            const sel = window.getSelection();
            if (!sel.rangeCount) return;

            const range = sel.getRangeAt(0);
            const textBeforeCursor = this.getTextBeforeCursor(range);

            if (e.key === '/') {
                // Memorize exact range of typed slash
                this.saveSlashRange(range);
                this.showPopupAtCursor(range);
            } else if (e.key === 'Backspace' || e.key === 'Escape') {
                // Agar cursor ke peeche ab '/' nahi bacha ya Esc dabaya gaya, hide popup
                if (!textBeforeCursor.endsWith('/')) {
                    this.hide();
                }
            } else {
                // Agar user ne space ya enter dabaya to hide
                if (e.key === ' ' || e.key === 'Enter') {
                    this.hide();
                }
            }
        });

        // 2. Page me kahi bhi aur click kare to popup hide ho jana
        document.addEventListener('pointerdown', (e) => {
            if (!this.popup.contains(e.target) && e.target !== this.editor) {
                this.hide();
            }
        });

        // 3. Selection change hone par (cursor move kiya kahi aur)
        document.addEventListener('selectionchange', () => {
            if (!this.popup.classList.contains('d-none')) {
                const sel = window.getSelection();
                if (sel.rangeCount > 0) {
                    const range = sel.getRangeAt(0);
                    const txt = this.getTextBeforeCursor(range);
                    if (!txt.endsWith('/')) {
                        this.hide();
                    }
                }
            }
        });

        // 4. Item click hone par: typed '/' ko delete karke theek usi jagah par block lagana
        this.popup.querySelectorAll('.slash-item').forEach((btn) => {
            btn.addEventListener('pointerdown', (e) => {
                e.preventDefault(); // Cursor focus loose na ho
                const action = btn.getAttribute('data-action');

                this.removeTypedSlashAndInsert(() => {
                    this.onSelectBlock(action);
                });
                this.hide();
            });
        });
    }

    getTextBeforeCursor(range) {
        const node = range.startContainer;
        if (node.nodeType === Node.TEXT_NODE) {
            return node.textContent.substring(0, range.startOffset);
        }
        return '';
    }

    saveSlashRange(range) {
        this.savedSlashRange = range.cloneRange();
    }

    removeTypedSlashAndInsert(callback) {
        const sel = window.getSelection();
        if (this.savedSlashRange) {
            sel.removeAllRanges();
            sel.addRange(this.savedSlashRange);

            const node = this.savedSlashRange.startContainer;
            const offset = this.savedSlashRange.startOffset;

            // Agar cursor ke turant pehle '/' hai to use specifically remove karna
            if (node.nodeType === Node.TEXT_NODE && offset > 0) {
                const charBefore = node.textContent.charAt(offset - 1);
                if (charBefore === '/') {
                    node.deleteData(offset - 1, 1);
                    // Cursor ko delete hue position par set karna
                    const newRange = document.createRange();
                    newRange.setStart(node, offset - 1);
                    newRange.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(newRange);
                }
            }
        }
        // Wahi par callback (element insertion) chalana
        callback();
    }

    showPopupAtCursor(range) {
        const rect = range.getBoundingClientRect();
        const popupHeight = 340; // Estimated height of scrollable slash popup
        const popupWidth = 310;

        let top = 0;
        let left = rect.left + window.scrollX;

        // Viewport collision check: Agar cursor ke niche jagah kam hai to UPAR kholein
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;

        if (spaceBelow < popupHeight && spaceAbove > popupHeight) {
            // Pop ABOVE the cursor
            top = rect.top + window.scrollY - popupHeight - 8;
        } else {
            // Pop BELOW the cursor (normal)
            top = rect.bottom + window.scrollY + 8;
        }

        // Horizontal boundary collision check
        if (left + popupWidth > window.innerWidth - 15) {
            left = window.innerWidth - popupWidth - 15;
        }
        if (left < 10) left = 10;

        // Mobile centering adjustment
        if (window.innerWidth <= 768) {
            left = (window.innerWidth - Math.min(popupWidth, window.innerWidth - 24)) / 2;
        }

        this.popup.style.top = `${Math.max(10, top)}px`;
        this.popup.style.left = `${Math.max(10, left)}px`;
        this.popup.classList.remove('d-none');
    }

    hide() {
        this.popup.classList.add('d-none');
        this.savedSlashRange = null;
    }
}