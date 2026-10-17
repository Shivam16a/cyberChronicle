import { db } from './db.js';
import { ThemeManager } from './themes.js';
import { SlashMenu } from './slashMenu.js';
import { EditorManager } from './editor.js';
import { MediaRecorderEngine } from './voiceVideo.js';
import { ReminderSystem } from './reminders.js';
import { CloudSyncManager } from './cloudSync.js';
import { ShareManager } from './share.js';
import { ImageEditorManager } from './imageEditor.js';
import { ChatRoomEngine } from './chatRoom.js';
import { AIAssistantManager } from './aiAssistant.js';
import { ProfileManager } from './profile.js';
import { NetworkRelay } from './networkRelay.js';
import { DirectMessenger } from './directMessenger.js';

let activeNoteId = null;
let isDraftMode = false; // Note agar khali hai to save nahi hoga
let editorManager = null;
let themeManager = null;
let slashMenu = null;
window.activeChatEngine = null; // Global reference taaki creator aur receiver dono access kar sakein

const urlpart1 = "macros/s/AKfycbxN527adCYISz31I99LKzaCdrotOvQ4k866V0gp7LU4vYvlZxRYr7e4VPdlLpItNZWo"

const DEFAULT_APPS_SCRIPT_URL = `https://script.google.com/${urlpart1}/exec`;

document.addEventListener('DOMContentLoaded', async () => {
    // ============================================================
    // SAFE CLEANUP: Purane temporary garbage keys wipe karein
    // DEVICE ID, THEME, aur GEMINI KEY safe rahenge!
    // ============================================================
    const preservedKeys = ['CYBER_DEVICE_UUID', 'CYBER_THEME', 'GEMINI_API_KEY', 'USER_PROFILE_DATA', 'SAVED_FRIENDS_PROFILES'];
    Object.keys(localStorage).forEach((key) => {
        if (!preservedKeys.includes(key)) {
            // Sirf ROOM_NOTE_ aur SHARED_NOTE_ jaisi temporary keys hatengi
            if (key.startsWith('ROOM_NOTE_') || key.startsWith('SHARED_NOTE_') || key.startsWith('c0Bn')) {
                localStorage.removeItem(key);
            }
        }
    });

    await db.init();
    themeManager = new ThemeManager();

    const noteBody = document.getElementById('note-body');
    const tiltCard = document.getElementById('tilt-card');
    const sidebar = document.getElementById('sidebar');
    const sidebarBackdrop = document.getElementById('sidebar-backdrop');

    // Display Device ID (Always Preserved)
    const devId = CloudSyncManager.getDeviceId();
    const lblDeviceId = document.getElementById('lbl-device-id');
    if (lblDeviceId) lblDeviceId.innerText = devId;

    // Responsive Drawer Toggle for Mobile
    const toggleDrawer = () => {
        sidebar.classList.toggle('show');
        sidebarBackdrop.classList.toggle('active');
    };

    const closeDrawer = () => {
        sidebar.classList.remove('show');
        sidebarBackdrop.classList.remove('active');
    };

    const sidebarToggleBtn = document.getElementById('sidebar-toggle');
    if (sidebarToggleBtn) {
        sidebarToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleDrawer();
        });
    }

    if (sidebarBackdrop) {
        sidebarBackdrop.addEventListener('click', closeDrawer);
    }

    // Image Editor & Context Menu Initialization:
    new ImageEditorManager(noteBody, () => {
        autoSave();
    });

    const endpoint = document.getElementById('cloud-endpoint')?.value || DEFAULT_APPS_SCRIPT_URL;

    // Profile Manager Init
    window.activeProfileManager = new ProfileManager(
        devId,
        endpoint
    );

    // Network Relay Initialize (Auto saves device to Sheets + Polls notifications)
    const relay = new NetworkRelay(devId, endpoint, (incoming) => {
        // Direct note received callback
        if (incoming && incoming.payload && incoming.payload.roomCode) {
            if (confirm(`Incoming Note from ${incoming.from}: "${incoming.payload.title}". Open now?`)) {
                window.location.hash = `#room=${incoming.payload.roomCode}`;
                window.location.reload();
            }
        }
    });

    // ============================================================
    // DEDICATED RIGHT-SIDE DIRECT MESSENGER INITIALIZER
    // ============================================================
    window.activeDirectMessenger = new DirectMessenger(devId, endpoint, (roomCode) => {
        window.location.hash = `#room=${roomCode}`;
    });

    // ============================================================
    // AI ASSISTANT INITIALIZATION (Google AI Studio / Gemini)
    // ============================================================
    new AIAssistantManager(
        // 1. Current note content fetcher
        () => extractNoteInfo(),
        // 2. Post-processing content injector
        (processedHTML) => {
            noteBody.innerHTML = processedHTML;
            editorManager.attachDynamicListeners();
            autoSave();
        }
    );

    // ============================================================
    // AUTO TITLE & PREVIEW EXTRACTION (Checking if note is empty)
    // ============================================================
    function extractNoteInfo() {
        const rawHTML = noteBody.innerHTML;
        const temp = document.createElement('div');
        temp.innerHTML = rawHTML;

        // Check for media or images
        const hasMedia = temp.querySelector('img, audio, video, table, canvas, input') !== null;
        const cleanPlainText = temp.innerText.trim();

        // Check if note is genuinely empty (no text and no media)
        const isEmpty = cleanPlainText.length === 0 && !hasMedia;

        const lines = cleanPlainText
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line.length > 0);

        const title = lines.length > 0 ? lines[0] : (hasMedia ? 'Media note' : 'Untitled Note');
        const preview = lines.length > 1 ? lines.slice(1).join(' ') : (hasMedia ? 'Attached media files' : 'No additional text');

        return {
            title,
            preview,
            plainText: cleanPlainText,
            htmlContent: rawHTML,
            isEmpty
        };
    }

    // ============================================================
    // REAL-TIME COLLABORATIVE ROOM & CHAT INITIALIZER (#room=XXXXXX)
    // ============================================================
    function initRoomSession(roomCode) {
        // 1. Read from Session memory (no permanent localStorage bloat)
        let sessionData = sessionStorage.getItem('ROOM_NOTE_' + roomCode);
        if (sessionData) {
            try {
                const parsed = JSON.parse(sessionData);
                if (parsed && parsed.content) {
                    noteBody.innerHTML = parsed.content;
                }
            } catch (e) { }
        }

        // 2. Chat & Live Sync Engine Initialize karein
        window.activeChatEngine = new ChatRoomEngine(
            roomCode,
            devId,
            () => {
                const { title, htmlContent } = extractNoteInfo();
                return { title, content: htmlContent, updatedAt: Date.now() };
            },
            (incomingData) => {
                if (incomingData && incomingData.content !== undefined) {
                    noteBody.innerHTML = incomingData.content;
                    editorManager.attachDynamicListeners();
                    sessionStorage.setItem('ROOM_NOTE_' + roomCode, JSON.stringify(incomingData));

                    const statusBadge = document.getElementById('save-status');
                    if (statusBadge) statusBadge.innerText = `ROOM: ${roomCode} (SYNCED)`;
                }
            }
        );

        // 3. Bidirectional Read-Write Typing Sync
        noteBody.addEventListener('input', () => {
            const { title, htmlContent } = extractNoteInfo();
            const payload = { title, content: htmlContent, updatedAt: Date.now() };

            sessionStorage.setItem('ROOM_NOTE_' + roomCode, JSON.stringify(payload));

            if (window.activeChatEngine) {
                window.activeChatEngine.broadcastMessage({
                    type: 'note_edit',
                    sender: devId,
                    payload: payload
                });
            }
        });

        const statusBadge = document.getElementById('save-status');
        if (statusBadge) statusBadge.innerText = `ROOM: ${roomCode} (LIVE)`;
    }

    // Check if opened via #room= link
    if (window.location.hash.startsWith('#room=')) {
        const roomCode = window.location.hash.replace('#room=', '').toUpperCase();
        initRoomSession(roomCode);
    }

    // Listen to hash change (e.g. Creator jab 'Share via link' dabaye)
    window.addEventListener('hashchange', () => {
        if (window.location.hash.startsWith('#room=')) {
            const roomCode = window.location.hash.replace('#room=', '').toUpperCase();
            if (!window.activeChatEngine) {
                initRoomSession(roomCode);
            }
        }
    });

    // ============================================================
    // SHORT LINK READER (#s=xxxxxx)
    // ============================================================
    const urlHash = window.location.hash;
    if (urlHash.startsWith('#s=')) {
        const shortId = urlHash.replace('#s=', '');

        let noteData = sessionStorage.getItem('SHARED_NOTE_' + shortId);

        const renderShared = (data) => {
            if (sidebar) sidebar.style.display = 'none';
            const topNav = document.querySelector('.top-nav');
            if (topNav) {
                topNav.innerHTML = `
                    <div class="d-flex align-items-center justify-content-between w-100">
                        <span class="badge bg-secondary-subtle text-secondary">Shared Note View</span>
                        <button class="cyber-btn btn-sm" id="btn-save-shared"><i class="bi bi-download"></i> Save to My Notes</button>
                    </div>
                `;
            }
            noteBody.innerHTML = data.content || '';
            noteBody.setAttribute('contenteditable', 'false'); // View only

            document.getElementById('btn-save-shared')?.addEventListener('click', async () => {
                await db.saveNote({
                    id: 'note_' + Date.now(),
                    title: data.title || 'Imported Note',
                    content: data.content || '',
                    updatedAt: Date.now()
                });
                window.location.hash = '';
                window.location.reload();
            });
        };

        if (noteData) {
            renderShared(JSON.parse(noteData));
            return;
        } else {
            const endpoint = document.getElementById('cloud-endpoint')?.value || DEFAULT_APPS_SCRIPT_URL;
            fetch(`${endpoint}?s=${shortId}`)
                .then(r => r.json())
                .then(data => {
                    if (data && data.content) renderShared(data);
                })
                .catch(() => { });
            return;
        }
    }

    // Share Controller initialization
    new ShareManager(() => {
        const { title, htmlContent, plainText } = extractNoteInfo();
        return { title, htmlContent, plainText };
    });

    // Editor Manager Initialization
    editorManager = new EditorManager(noteBody, () => autoSave());

    // 3D Tilt calculation (Only on desktop)
    document.addEventListener('mousemove', (e) => {
        const toggle3D = document.getElementById('toggle-3d-tilt');
        if (window.innerWidth <= 768 || (toggle3D && !toggle3D.checked)) return;
        const x = (e.clientX / window.innerWidth - 0.5) * 12;
        const y = (e.clientY / window.innerHeight - 0.5) * -12;
        if (tiltCard) tiltCard.style.transform = `rotateY(${x}deg) rotateX(${y}deg)`;
    });

    // Slash Menu initialization
    slashMenu = new SlashMenu(noteBody, (action) => {
        handleBlockInsertion(action);
    });

    // Slash Menu Action Routing
    function handleBlockInsertion(action) {
        if (action === 'h1') {
            document.execCommand('formatBlock', false, '<h1>');
        } else if (action === 'h2') {
            document.execCommand('formatBlock', false, '<h2>');
        } else if (action === 'h3') {
            document.execCommand('formatBlock', false, '<h3>');
        } else if (action === 'p') {
            document.execCommand('formatBlock', false, '<p>');
        } else if (action === 'quote') {
            editorManager.insertBlockHTML(`
                <blockquote class="note-quote">
                    “ Write important thought or note here...
                </blockquote><br/>
            `);
        } else if (action === 'checklist') {
            editorManager.insertBlockHTML(`
                <div class="embed-block">
                    <button class="btn-block-del" title="Delete Task">✕</button>
                    <div class="d-flex align-items-center gap-2">
                        <input type="checkbox" style="width:18px; height:18px; cursor:pointer;" />
                        <span contenteditable="true">To-do task item...</span>
                    </div>
                </div><br/>
            `);
        } else if (action === 'ul') {
            document.execCommand('insertUnorderedList');
        } else if (action === 'ol') {
            document.execCommand('insertOrderedList');
        } else if (action === 'indent') {
            document.execCommand('indent');
        } else if (action === 'outdent') {
            document.execCommand('outdent');
        } else if (action === 'alignLeft') {
            document.execCommand('justifyLeft');
        } else if (action === 'alignCenter') {
            document.execCommand('justifyCenter');
        } else if (action === 'alignRight') {
            document.execCommand('justifyRight');
        } else if (action === 'divider') {
            editorManager.insertBlockHTML('<hr style="border-top: 2px dashed var(--border-color); margin: 18px 0;" /><br/>');
        } else if (action === 'table') {
            editorManager.insertBlockHTML(`
                <div class="embed-block">
                    <button class="btn-block-del" title="Delete Table">✕</button>
                    <table class="note-table">
                        <thead>
                            <tr><th>Item</th><th>Description</th><th>Qty / Status</th></tr>
                        </thead>
                        <tbody>
                            <tr><td>Task 1</td><td>Sample detail</td><td>Active</td></tr>
                            <tr><td>Task 2</td><td>Second detail</td><td>Done</td></tr>
                        </tbody>
                    </table>
                </div><br/>
            `);
        } else if (action === 'doodle') {
            editorManager.insertBlockHTML(`
                <div class="embed-block" style="text-align:center;">
                    <button class="btn-block-del" title="Delete Doodle">✕</button>
                    <canvas width="320" height="180" style="border:1px dashed var(--border-color); background:rgba(0,0,0,0.05); border-radius:8px; cursor:crosshair;" class="doodle-canvas"></canvas>
                    <small class="d-block text-muted">Doodle canvas</small>
                </div><br/>
            `);
        } else if (action === 'dual-image') {
            const dualInput = document.getElementById('file-dual-images');
            if (dualInput) dualInput.click();
        } else if (action === 'image') {
            const singleImg = document.getElementById('file-image-input');
            if (singleImg) singleImg.click();
        } else if (action === 'camera' || action === 'video') {
            const vidBtn = document.getElementById('btn-media-video');
            if (vidBtn) vidBtn.click();
        } else if (action === 'contact') {
            editorManager.insertBlockHTML(`
                <div class="embed-block" style="border-left: 3px solid #00aaff;">
                    <button class="btn-block-del" title="Delete Contact">✕</button>
                    <div><strong>👤 Contact:</strong> <span contenteditable="true">Person Name</span></div>
                    <div><strong>📞 Phone:</strong> <span contenteditable="true">+91 00000 00000</span></div>
                    <div><strong>📍 Address:</strong> <span contenteditable="true">Address Details</span></div>
                </div><br/>
            `);
        } else if (action === 'vocab') {
            editorManager.insertBlockHTML(`
                <div class="embed-block" style="border-left: 3px solid #ffaa00;">
                    <button class="btn-block-del" title="Delete Vocab">✕</button>
                    <div><strong>📖 Phrase:</strong> <span contenteditable="true">"Carpe Diem"</span></div>
                    <div><strong>💡 Meaning:</strong> <span contenteditable="true">Seize the day</span></div>
                </div><br/>
            `);
        } else if (action === 'audio') {
            const audBtn = document.getElementById('btn-media-audio');
            if (audBtn) audBtn.click();
        }
    }

    // Dual Image Selector
    const dualImgInput = document.getElementById('file-dual-images');
    if (dualImgInput) {
        dualImgInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files).slice(0, 2);
            if (files.length === 0) return;

            const readPromises = files.map(file => {
                return new Promise(res => {
                    const r = new FileReader();
                    r.onload = ev => res(ev.target.result);
                    r.readAsDataURL(file);
                });
            });

            Promise.all(readPromises).then(urls => {
                let imgsHTML = urls.map(u => `<img src="${u}" alt="Dual Image" style="width:100%; border-radius:6px;" />`).join('');
                editorManager.insertBlockHTML(`
                    <div class="embed-block">
                        <button class="btn-block-del" title="Delete Images">✕</button>
                        <div class="dual-image-container side-by-side" style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                            ${imgsHTML}
                        </div>
                    </div><br/>
                `);
            });
        });
    }

    // Single Image Picker (No cut/delete icon on image, context menu handles it)
    const singleImgInput = document.getElementById('file-image-input');
    if (singleImgInput) {
        singleImgInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    editorManager.insertBlockHTML(`<img src="${ev.target.result}" alt="Note Image" /><br/>`);
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Media Action Buttons
    const btnMediaImg = document.getElementById('btn-media-image');
    if (btnMediaImg && singleImgInput) {
        btnMediaImg.addEventListener('click', () => singleImgInput.click());
    }

    const btnMediaAud = document.getElementById('btn-media-audio');
    if (btnMediaAud) {
        btnMediaAud.addEventListener('click', async () => {
            alert('Recording 4s Voice Memo...');
            try {
                const b64Audio = await MediaRecorderEngine.recordAudio(4000);
                editorManager.insertBlockHTML(`
                    <div class="embed-block">
                        <button class="btn-block-del" title="Delete Voice">✕</button>
                        <audio controls src="${b64Audio}"></audio>
                    </div><br/>
                `);
            } catch {
                alert('Microphone access needed.');
            }
        });
    }

    const btnMediaVid = document.getElementById('btn-media-video');
    if (btnMediaVid) {
        btnMediaVid.addEventListener('click', async () => {
            alert('Recording 3s Video Snippet...');
            try {
                const b64Video = await MediaRecorderEngine.recordVideo(3500);
                editorManager.insertBlockHTML(`
                    <div class="embed-block">
                        <button class="btn-block-del" title="Delete Video">✕</button>
                        <video controls width="320" src="${b64Video}"></video>
                    </div><br/>
                `);
            } catch {
                alert('Camera access needed.');
            }
        });
    }

    const btnReminder = document.getElementById('btn-media-reminder');
    if (btnReminder) {
        btnReminder.addEventListener('click', () => {
            const { title } = extractNoteInfo();
            const label = prompt('Reminder label:', title || 'Reminder');
            const sec = parseInt(prompt('Remind after how many seconds?', '10'), 10);
            if (sec) ReminderSystem.schedule(label, sec);
        });
    }

    // ============================================================
    // LAZY AUTO-SAVE (EMPTY NOTES NEVER PERSIST IN SIDEBAR)
    // + Debounced Cloud Sync Stream
    // ============================================================
    let cloudStreamDebounce = null;

    async function autoSave() {
        if (!activeNoteId) return;
        const { title, htmlContent, isEmpty } = extractNoteInfo();

        if (isEmpty) {
            if (!isDraftMode) {
                await db.deleteNote(activeNoteId);
                isDraftMode = true;
                renderNotesList();
            }
            const saveBadge = document.getElementById('save-status');
            if (saveBadge) saveBadge.innerText = 'DRAFT (EMPTY)';
            return;
        }

        isDraftMode = false;
        const all = await db.getAllNotes();
        const existing = all.find((n) => n.id === activeNoteId) || {};

        const updatedNote = {
            ...existing,
            id: activeNoteId,
            title: title,
            content: htmlContent,
            updatedAt: Date.now()
        };

        await db.saveNote(updatedNote);
        const saveBadge = document.getElementById('save-status');
        if (saveBadge) saveBadge.innerText = 'SAVED LOCALLY';
        renderNotesList();

        // Background Google Cloud Stream (Sheets + Drive + Docs)
        if (cloudStreamDebounce) clearTimeout(cloudStreamDebounce);
        cloudStreamDebounce = setTimeout(async () => {
            const endpoint = document.getElementById('cloud-endpoint')?.value || DEFAULT_APPS_SCRIPT_URL;
            if (endpoint && !endpoint.includes('YOUR_DEFAULT_ID_HERE')) {
                const currentNotes = await db.getAllNotes();
                CloudSyncManager.syncWithGoogleCloud(endpoint, currentNotes)
                    .then(() => {
                        if (saveBadge) saveBadge.innerText = 'CLOUD BACKED UP (GOOGLE VAULT)';
                    })
                    .catch(() => { });
            }
        }, 4000);
    }

    noteBody.addEventListener('input', autoSave);

    // Create New Note
    const handleCreateNewNote = async () => {
        const { isEmpty } = extractNoteInfo();
        if (isDraftMode && isEmpty) {
            noteBody.focus();
            if (window.innerWidth <= 768) closeDrawer();
            return;
        }

        activeNoteId = 'note_' + Date.now();
        isDraftMode = true;

        noteBody.innerHTML = '';
        const blockIdEl = document.getElementById('note-block-id');
        if (blockIdEl) blockIdEl.innerText = activeNoteId.slice(-6);

        const timeEl = document.getElementById('note-timestamp');
        if (timeEl) timeEl.innerText = 'Just now';

        const saveBadge = document.getElementById('save-status');
        if (saveBadge) saveBadge.innerText = 'NEW PAGE';

        noteBody.focus();
        if (window.innerWidth <= 768) closeDrawer();
        renderNotesList();
    };

    const btnNew = document.getElementById('btn-new-note');
    if (btnNew) btnNew.addEventListener('click', handleCreateNewNote);

    // Delete Page
    const btnDelPage = document.getElementById('btn-delete-page');
    if (btnDelPage) {
        btnDelPage.addEventListener('click', async () => {
            if (!activeNoteId) return;
            if (!isDraftMode) {
                if (confirm('Delete this active page?')) {
                    await db.deleteNote(activeNoteId);
                }
            }
            const rem = await db.getAllNotes();
            if (rem.length > 0) {
                loadNote(rem[0].id);
            } else {
                handleCreateNewNote();
            }
        });
    }

    async function loadNote(id) {
        const { isEmpty } = extractNoteInfo();
        if (isDraftMode && isEmpty && activeNoteId && activeNoteId !== id) {
            await db.deleteNote(activeNoteId);
        }

        activeNoteId = id;
        isDraftMode = false;

        const all = await db.getAllNotes();
        const note = all.find((n) => n.id === id);
        if (!note) return;

        noteBody.innerHTML = note.content;
        const blockIdEl = document.getElementById('note-block-id');
        if (blockIdEl) blockIdEl.innerText = id.slice(-6);

        const timeEl = document.getElementById('note-timestamp');
        if (timeEl) timeEl.innerText = new Date(note.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        editorManager.attachDynamicListeners();
        renderNotesList();
    }

    // Render List
    async function renderNotesList(filter = '') {
        const listEl = document.getElementById('notes-list');
        if (!listEl) return;
        const all = await db.getAllNotes();
        listEl.innerHTML = '';

        const validNotes = all.filter(n => {
            const temp = document.createElement('div');
            temp.innerHTML = n.content || '';
            const hasMedia = temp.querySelector('img, audio, video, table, canvas, input') !== null;
            return temp.innerText.trim().length > 0 || hasMedia;
        });

        const filtered = validNotes.filter(
            (n) => n.title.toLowerCase().includes(filter.toLowerCase()) || n.content.toLowerCase().includes(filter.toLowerCase())
        );

        filtered.sort((a, b) => b.updatedAt - a.updatedAt);

        filtered.forEach((note) => {
            const li = document.createElement('li');
            li.className = `note-item ${note.id === activeNoteId ? 'active' : ''}`;

            const temp = document.createElement('div');
            temp.innerHTML = note.content;
            const lines = temp.innerText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
            const previewText = lines.length > 1 ? lines.slice(1).join(' ') : 'No additional text';

            const d = new Date(note.updatedAt);
            const dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric' });

            li.innerHTML = `
                <div class="note-item-content">
                    <div class="note-item-title">${note.title || 'Untitled Note'}</div>
                    <div class="note-item-preview">${dateStr} &nbsp;·&nbsp; ${previewText}</div>
                </div>
                <button class="btn btn-sm text-danger border-0 p-1 ms-2" title="Delete Note"><i class="bi bi-trash"></i></button>
            `;

            li.addEventListener('click', (e) => {
                if (e.target.closest('button')) return;
                loadNote(note.id);
                if (window.innerWidth <= 768) closeDrawer();
            });

            li.querySelector('button').addEventListener('click', async (e) => {
                e.stopPropagation();
                if (confirm(`Delete "${note.title}"?`)) {
                    await db.deleteNote(note.id);
                    const rem = await db.getAllNotes();
                    if (rem.length > 0) loadNote(rem[0].id);
                    else handleCreateNewNote();
                }
            });

            listEl.appendChild(li);
        });
    }

    const searchInput = document.getElementById('note-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            renderNotesList(e.target.value);
        });
    }

    const themeSelect = document.getElementById('theme-selector');
    if (themeSelect) {
        themeSelect.addEventListener('change', (e) => {
            themeManager.setTheme(e.target.value);
        });
    }

    const toggleParticles = document.getElementById('toggle-particles');
    if (toggleParticles) {
        toggleParticles.addEventListener('change', (e) => {
            themeManager.enabled = e.target.checked;
        });
    }

    // Cloud Sync Button
    const btnSyncCloud = document.getElementById('btn-sync-cloud');
    if (btnSyncCloud) {
        btnSyncCloud.addEventListener('click', async () => {
            const endpointInput = document.getElementById('cloud-endpoint');
            const url = (endpointInput && endpointInput.value) ? endpointInput.value : DEFAULT_APPS_SCRIPT_URL;
            const all = await db.getAllNotes();
            const badge = document.getElementById('save-status');
            if (badge) badge.innerText = 'SYNCING TO GOOGLE DRIVE...';

            try {
                await CloudSyncManager.syncWithGoogleCloud(url, all);
                if (badge) badge.innerText = 'SYNCED SUCCESSFULLY';
                alert(`[DEVICE ID: ${devId}]\nData backed up to Google Sheet, Google Drive & Google Docs!`);
            } catch {
                if (badge) badge.innerText = 'SYNC FAILED';
                alert('Could not sync with Google Apps Script.');
            }
        });
    }

    // Export Disk
    const btnExport = document.getElementById('btn-export-json');
    if (btnExport) {
        btnExport.addEventListener('click', async () => {
            const all = await db.getAllNotes();
            CloudSyncManager.exportDisk(all);
        });
    }

    // Restore Backup
    const importInput = document.getElementById('btn-import-json');
    if (importInput) {
        importInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const importedData = JSON.parse(event.target.result);

                    const notesToRestore = Array.isArray(importedData)
                        ? importedData
                        : (importedData.notes || [importedData]);

                    if (!notesToRestore || notesToRestore.length === 0) {
                        alert('Backup file me koi notes nahi mile!');
                        return;
                    }

                    for (const note of notesToRestore) {
                        if (note && note.id) {
                            await db.saveNote(note);
                        }
                    }

                    const settingsModalEl = document.getElementById('settingsModal');
                    if (settingsModalEl && window.bootstrap) {
                        const modalInstance = bootstrap.Modal.getInstance(settingsModalEl);
                        if (modalInstance) modalInstance.hide();
                    }

                    const allNotes = await db.getAllNotes();
                    if (allNotes.length > 0) {
                        await loadNote(allNotes[0].id);
                    }
                    await renderNotesList();

                    alert(`Success! ${notesToRestore.length} notes successfully restore ho gaye.`);
                } catch (err) {
                    console.error('Restore error:', err);
                    alert('Invalid JSON backup file! Data restore nahi ho saka.');
                } finally {
                    importInput.value = '';
                }
            };
            reader.readAsText(file);
        });
    }

    // Initial Boot Logic
    if (!window.location.hash.startsWith('#room=') && !window.location.hash.startsWith('#s=')) {
        const initialNotes = await db.getAllNotes();
        if (initialNotes.length > 0) {
            loadNote(initialNotes[0].id);
        } else {
            handleCreateNewNote();
        }
    }
});