/**
 * js/share.js
 * Xiaomi Notes Style Share Controller with Direct Native Share Sheet
 */
export class ShareManager {
    constructor(getNoteDetailsCallback) {
        this.getNoteDetails = getNoteDetailsCallback;
        this.backdrop = document.getElementById('shareSheetBackdrop');
        this.generatingModal = document.getElementById('generating-modal');

        this.btnOpen = document.getElementById('btn-share-note');
        this.btnCancel = document.getElementById('btn-share-cancel');
        this.btnCancelGen = document.getElementById('btn-cancel-generating');

        this.btnText = document.getElementById('btn-share-text');
        this.btnImage = document.getElementById('btn-share-image');
        this.btnLink = document.getElementById('btn-share-link');
        this.btnWord = document.getElementById('btn-share-word');

        this.isCancelled = false;
        this.initEvents();
    }

    initEvents() {
        if (this.btnOpen) {
            this.btnOpen.addEventListener('click', () => this.open());
        }

        if (this.btnCancel) {
            this.btnCancel.addEventListener('click', () => this.close());
        }

        if (this.btnCancelGen) {
            this.btnCancelGen.addEventListener('click', () => {
                this.isCancelled = true;
                this.hideGenerating();
            });
        }

        if (this.backdrop) {
            this.backdrop.addEventListener('click', (e) => {
                if (e.target === this.backdrop) this.close();
            });
        }

        if (this.btnText) {
            this.btnText.addEventListener('click', () => this.shareAsText());
        }

        if (this.btnImage) {
            this.btnImage.addEventListener('click', () => this.shareAsImage());
        }

        if (this.btnLink) {
            this.btnLink.addEventListener('click', () => this.shareViaLink());
        }

        if (this.btnWord) {
            this.btnWord.addEventListener('click', () => this.shareAsWord());
        }
    }

    open() {
        if (this.backdrop) this.backdrop.classList.remove('d-none');
    }

    close() {
        if (this.backdrop) this.backdrop.classList.add('d-none');
    }

    showGenerating() {
        this.isCancelled = false;
        if (this.generatingModal) this.generatingModal.classList.remove('d-none');
    }

    hideGenerating() {
        if (this.generatingModal) this.generatingModal.classList.add('d-none');
    }

    // 1. SHARE AS TEXT
    async shareAsText() {
        this.close();
        const { title, plainText } = this.getNoteDetails();
        const fullText = `${title}\n\n${plainText}`;

        if (navigator.share) {
            try {
                await navigator.share({
                    title: `Notes_and_Diary - ${title}`,
                    text: fullText
                });
                return;
            } catch (err) { }
        }

        await navigator.clipboard.writeText(fullText);
        alert('Note text copied to clipboard!');
    }

    // 2. SHARE AS IMAGE (CARD ONLY CAPTURE WITH DIRECT SHARE SHEET)
    async shareAsImage() {
        this.close();
        this.showGenerating();

        const noteCard = document.getElementById('tilt-card');
        if (!noteCard) {
            this.hideGenerating();
            return;
        }

        try {
            const originalTransform = noteCard.style.transform;
            noteCard.style.transform = 'none';

            if (typeof html2canvas === 'undefined') {
                throw new Error('html2canvas library loaded nahi hai');
            }

            const canvas = await html2canvas(noteCard, {
                scale: 2,
                useCORS: true,
                allowTaint: true,
                backgroundColor: document.body.classList.contains('theme-default') ? '#ffffff' : '#0b1329',
                logging: false
            });

            noteCard.style.transform = originalTransform;

            if (this.isCancelled) return;

            canvas.toBlob(async (blob) => {
                this.hideGenerating();
                if (!blob) {
                    alert('Image generation failed.');
                    return;
                }

                const fileName = 'Notes_and_Diary.png';
                const file = new File([blob], fileName, { type: 'image/png' });

                // Check if Web Share API with files is available
                const canShareFiles = navigator.canShare && navigator.canShare({ files: [file] });

                if (canShareFiles) {
                    try {
                        await navigator.share({
                            files: [file],
                            title: 'Notes_and_Diary',
                            text: 'Note shared via Notes & Diary'
                        });
                        return;
                    } catch (err) {
                        if (err.name === 'AbortError') return; // User dismiss
                    }
                }

                // Fallback: Agar browser ne direct async file share block kiya ho ya desktop ho
                const link = document.createElement('a');
                link.download = fileName;
                link.href = URL.createObjectURL(blob);
                link.click();
                URL.revokeObjectURL(link.href);
            }, 'image/png');

        } catch (err) {
            this.hideGenerating();
            console.error('Image share error:', err);
            alert('Image render nahi ho saki: ' + err.message);
        }
    }

    // 3. SHARE VIA LINK (Session Storage & P2P Stream - No LocalStorage Bloat)
    async shareViaLink() {
        this.close();
        const { title, htmlContent } = this.getNoteDetails();

        // 6-digit unique room code
        const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();

        const roomPayload = {
            title: title || 'Shared Note',
            content: htmlContent,
            updatedAt: Date.now()
        };

        // Temporary session memory (tab band hote hi auto-clean ho jayega, localStorage me garbage nahi banega)
        sessionStorage.setItem('ROOM_NOTE_' + roomCode, JSON.stringify(roomPayload));

        // Creator ke URL me room hash set karein
        window.location.hash = `#room=${roomCode}`;

        const shareableUrl = `${window.location.origin}${window.location.pathname}#room=${roomCode}`;

        if (navigator.share) {
            try {
                await navigator.share({
                    title: `Note Room: ${title}`,
                    text: `Join real-time note & chat: "${title}"`,
                    url: shareableUrl
                });
            } catch (err) { }
        } else {
            await navigator.clipboard.writeText(shareableUrl);
            alert(`✅ Live Note & Chat Room Created!\n\nLink copied:\n${shareableUrl}\n\nAapki chat window open ho gayi hai. Is link ko doosre device me paste karein!`);
        }

        // Creator ki window me Live Chat Drawer auto-open karein
        if (window.activeChatEngine) {
            window.activeChatEngine.openPanel();
        }
    }

    // 4. SHARE AS WORD FILE
    shareAsWord() {
        this.close();
        const { title, htmlContent } = this.getNoteDetails();

        const wordHTML = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>Notes_and_Diary</title>
        <style>
          body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; line-height: 1.6; }
          h1 { color: #1e3a8a; font-size: 20pt; margin-bottom: 6px; }
          .meta { color: #64748b; font-size: 9pt; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <div class="meta">Exported from Notes & Diary | Date: ${new Date().toLocaleString()}</div>
        <hr/>
        <div>${htmlContent}</div>
      </body>
      </html>
    `;

        const blob = new Blob(['\ufeff', wordHTML], { type: 'application/msword' });
        const fileName = 'Notes_and_Diary.doc';
        const file = new File([blob], fileName, { type: 'application/msword' });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            navigator.share({ files: [file], title: fileName }).catch(() => { });
            return;
        }

        const url = URL.createObjectURL(blob);
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = fileName;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(url);
    }
}