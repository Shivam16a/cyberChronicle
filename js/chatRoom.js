/**
 * js/chatRoom.js
 * Multi-User Group Chat with Accurate Word-Level Diff Engine & Profile Integration
 */
export class ChatRoomEngine {
    constructor(roomCode, deviceId, getCurrentNoteFn, onNoteUpdateCallback) {
        this.roomCode = roomCode;
        this.deviceId = deviceId;
        this.getCurrentNote = getCurrentNoteFn;
        this.onNoteUpdate = onNoteUpdateCallback;

        this.panel = document.getElementById('note-chat-panel');
        this.container = document.getElementById('chat-messages-container');
        this.activityContainer = document.getElementById('activity-log-container');
        this.input = document.getElementById('chat-msg-input');
        this.peerStatus = document.getElementById('chat-active-peers');
        this.unreadDot = document.getElementById('chat-unread-dot');

        this.connections = [];
        this.isHost = false;
        this.processedMsgIds = new Set();

        // Baseline document text tracker
        const initNote = this.getCurrentNote();
        this.baselineDocText = this.getPlainText(initNote.content || '');
        this.peerTypingTimers = {};

        this.initPeer();
        this.initUI();
    }

    getDeviceTheme(id) {
        const palette = [
            { border: '#ec4899', bg: 'rgba(236, 72, 153, 0.15)', text: '#db2777' },
            { border: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)', text: '#7c3aed' },
            { border: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', text: '#059669' },
            { border: '#06b6d4', bg: 'rgba(6, 182, 212, 0.15)', text: '#0891b2' },
            { border: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', text: '#d97706' },
            { border: '#f97316', bg: 'rgba(249, 115, 22, 0.15)', text: '#ea580c' },
            { border: '#6366f1', bg: 'rgba(99, 102, 241, 0.15)', text: '#4f46e5' }
        ];

        let hash = 0;
        for (let i = 0; i < id.length; i++) {
            hash = (hash << 5) - hash + id.charCodeAt(i);
            hash |= 0;
        }
        return palette[Math.abs(hash) % palette.length];
    }

    initPeer() {
        this.updateStatus('Connecting to room...');
        const hostPeerId = 'cyber-diary-room-' + this.roomCode.toLowerCase();

        this.broadcast = new BroadcastChannel('P2P_GROUP_' + this.roomCode);
        this.broadcast.onmessage = (e) => this.handleIncomingData(e.data, null);

        this.peer = new Peer(hostPeerId, { debug: 1 });

        this.peer.on('open', () => {
            this.isHost = true;
            this.updateStatus(`Room Host: Online (${this.deviceId})`);

            this.peer.on('connection', (conn) => {
                this.setupConnection(conn);

                conn.on('open', () => {
                    const currentData = this.getCurrentNote();
                    conn.send({
                        type: 'sync_initial_note',
                        sender: this.deviceId,
                        payload: currentData
                    });
                });
            });
        });

        this.peer.on('error', (err) => {
            if (err.type === 'unavailable-id') {
                this.peer = new Peer({ debug: 1 });
                this.peer.on('open', () => {
                    this.isHost = false;
                    this.updateStatus(`Connected to Room`);
                    const conn = this.peer.connect(hostPeerId, { reliable: true });
                    this.setupConnection(conn);

                    conn.on('open', () => {
                        conn.send({ type: 'request_note', sender: this.deviceId });
                    });
                });
            } else {
                this.updateStatus('Local network active');
            }
        });

        setTimeout(() => {
            this.broadcastMessage({ type: 'request_note', sender: this.deviceId });
        }, 400);
    }

    setupConnection(conn) {
        conn.on('open', () => {
            if (!this.connections.some(c => c.peer === conn.peer)) {
                this.connections.push(conn);
            }
            this.updateStatus(`Group Active (${this.connections.length + 1} devices connected)`);
        });

        conn.on('data', (data) => {
            this.handleIncomingData(data, conn);
        });

        conn.on('close', () => {
            this.connections = this.connections.filter((c) => c.peer !== conn.peer);
            this.updateStatus(`Group Active (${this.connections.length + 1} devices connected)`);
        });
    }

    initUI() {
        const tabChat = document.getElementById('tab-btn-chat');
        const tabActivity = document.getElementById('tab-btn-activity');
        if (tabChat && tabActivity) {
            tabChat.onclick = () => {
                tabChat.classList.add('active');
                tabActivity.classList.remove('active');
                this.container.classList.remove('d-none');
                this.activityContainer.classList.add('d-none');
            };
            tabActivity.onclick = () => {
                tabActivity.classList.add('active');
                tabChat.classList.remove('active');
                this.activityContainer.classList.remove('d-none');
                this.container.classList.add('d-none');
            };
        }

        const form = document.getElementById('chat-input-form');
        if (form) {
            form.onsubmit = (e) => {
                e.preventDefault();
                const text = this.input.value.trim();
                if (!text) return;

                // Active profile identity fetch karna (Public vs Private)
                const profile = window.activeProfileManager
                    ? window.activeProfileManager.getChatIdentity()
                    : { displayName: this.deviceId, avatarUrl: "", isPublic: false };

                const msgPacket = {
                    id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
                    type: 'chat',
                    text: text,
                    sender: this.deviceId,
                    displayName: profile.displayName,
                    avatarUrl: profile.avatarUrl,
                    isPublic: profile.isPublic,
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                };

                this.processedMsgIds.add(msgPacket.id);
                this.renderBubble(msgPacket, true);
                this.broadcastMessage(msgPacket);
                this.input.value = '';
            };
        }

        const toggleBtn = document.getElementById('btn-toggle-live-chat');
        if (toggleBtn) {
            toggleBtn.onclick = () => {
                this.panel.classList.toggle('d-none');
                if (!this.panel.classList.contains('d-none') && this.unreadDot) {
                    this.unreadDot.classList.add('d-none');
                }
            };
        }

        const closeBtn = document.getElementById('btn-close-chat');
        if (closeBtn) {
            closeBtn.onclick = () => this.panel.classList.add('d-none');
        }
    }

    broadcastMessage(data, exceptConn = null) {
        this.connections.forEach((conn) => {
            if (conn.open && (!exceptConn || conn.peer !== exceptConn.peer)) {
                try { conn.send(data); } catch (e) { }
            }
        });

        try { this.broadcast.postMessage(data); } catch (e) { }
    }

    getPlainText(html) {
        const d = document.createElement('div');
        d.innerHTML = html || '';
        return d.innerText.trim();
    }

    handleIncomingData(data, fromConn) {
        if (!data || data.sender === this.deviceId) return;

        if (data.id) {
            if (this.processedMsgIds.has(data.id)) return;
            this.processedMsgIds.add(data.id);
        }

        // Hub-and-Spoke Relay
        if (this.isHost) {
            this.broadcastMessage(data, fromConn);
        }

        if (data.type === 'chat') {
            this.renderBubble(data, false);
            if (this.panel.classList.contains('d-none') && this.unreadDot) {
                this.unreadDot.classList.remove('d-none');
            }
        } else if (data.type === 'sync_initial_note') {
            // Receiver first load baseline
            if (this.onNoteUpdate && data.payload) {
                this.onNoteUpdate(data.payload);
                this.baselineDocText = this.getPlainText(data.payload.content || '');
            }
        } else if (data.type === 'note_sync' || data.type === 'note_edit') {
            const newHTML = data.payload ? (data.payload.content || '') : '';
            const newText = this.getPlainText(newHTML);

            // Document update
            if (this.onNoteUpdate && data.payload) {
                this.onNoteUpdate(data.payload);
            }

            // Debounce timer (1.8s idle hone par actual diff nikalna)
            if (this.peerTypingTimers[data.sender]) {
                clearTimeout(this.peerTypingTimers[data.sender]);
            }

            const prevBaseline = this.baselineDocText;

            this.peerTypingTimers[data.sender] = setTimeout(() => {
                this.computePreciseDiff(data.sender, prevBaseline, newText);
                this.baselineDocText = newText; // Baseline updated to latest
                delete this.peerTypingTimers[data.sender];
            }, 1800);

        } else if (data.type === 'request_note') {
            const currentData = this.getCurrentNote();
            this.broadcastMessage({
                type: 'sync_initial_note',
                sender: this.deviceId,
                payload: currentData
            });
        }
    }

    // ============================================================
    // EXACT TEXT DIFF ALGORITHM (Prefix & Suffix Matching)
    // ============================================================
    computePreciseDiff(sender, oldText, newText) {
        if (oldText === newText) return;

        let p = 0; // Common Prefix length
        while (p < oldText.length && p < newText.length && oldText[p] === newText[p]) {
            p++;
        }

        let s = 0; // Common Suffix length
        while (
            s < (oldText.length - p) &&
            s < (newText.length - p) &&
            oldText[oldText.length - 1 - s] === newText[newText.length - 1 - s]
        ) {
            s++;
        }

        // Exact inserted and deleted fragments
        const deletedFragment = oldText.substring(p, oldText.length - s).trim();
        const addedFragment = newText.substring(p, newText.length - s).trim();

        let actionHTML = '';

        if (addedFragment && deletedFragment) {
            // Text replace ya modify hua
            const shortAdd = addedFragment.length > 45 ? addedFragment.substring(0, 45) + '...' : addedFragment;
            const shortDel = deletedFragment.length > 45 ? deletedFragment.substring(0, 45) + '...' : deletedFragment;
            actionHTML = `<span class="text-warning fw-bold">✎ Replaced:</span> "${shortDel}" ➔ <span style="background:rgba(245, 158, 11, 0.15); padding:2px 5px; border-radius:4px;">"${shortAdd}"</span>`;
        } else if (addedFragment) {
            // Sirf naya text add hua
            const shortAdd = addedFragment.length > 55 ? addedFragment.substring(0, 55) + '...' : addedFragment;
            actionHTML = `<span class="text-success fw-bold">+ Added:</span> <span style="background:rgba(16, 185, 129, 0.15); padding:2px 6px; border-radius:4px; font-weight:600;">"${shortAdd}"</span>`;
        } else if (deletedFragment) {
            // Text delete hua
            const shortDel = deletedFragment.length > 55 ? deletedFragment.substring(0, 55) + '...' : deletedFragment;
            actionHTML = `<span class="text-danger fw-bold">- Deleted:</span> <del style="color:var(--text-muted); background:rgba(239, 68, 68, 0.15); padding:2px 6px; border-radius:4px;">"${shortDel}"</del>`;
        } else {
            return;
        }

        this.logActivity(sender, actionHTML);
    }

    logActivity(sender, actionMarkup) {
        if (!this.activityContainer) return;

        if (this.activityContainer.children.length > 25) {
            this.activityContainer.removeChild(this.activityContainer.lastChild);
        }

        const colorTheme = this.getDeviceTheme(sender);
        const item = document.createElement('div');
        item.className = 'activity-item';
        item.style.borderLeft = `4px solid ${colorTheme.border}`;

        item.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-1">
        <span class="activity-user-tag" style="color:${colorTheme.text}; font-weight:700;">${sender}</span>
        <span class="small text-muted">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
      </div>
      <div style="font-size:0.86rem; color:var(--text-main); line-height:1.4;">${actionMarkup}</div>
    `;

        this.activityContainer.prepend(item);
    }

    renderBubble(msg, isMe) {
        const bubble = document.createElement('div');
        const colorTheme = this.getDeviceTheme(msg.sender);

        // Display Name priority: Agar user public hai to uska name, warna device ID
        const displayName = (msg.isPublic && msg.displayName) ? msg.displayName : msg.sender;

        if (isMe) {
            bubble.className = 'chat-msg msg-outgoing';
            bubble.innerHTML = `
                <div class="chat-sender-tag text-end">You (${displayName}) • ${msg.time}</div>
                <div class="chat-text-content">${msg.text}</div>
            `;
        } else {
            bubble.className = 'chat-msg msg-incoming';
            bubble.style.backgroundColor = colorTheme.bg;
            bubble.style.borderColor = colorTheme.border;
            bubble.style.borderLeft = `5px solid ${colorTheme.border}`;

            // Avatar Handling: Public hai aur photo hai to image, warna initial letters
            let avatarHtml = '';
            if (msg.isPublic && msg.avatarUrl) {
                avatarHtml = `<img src="${msg.avatarUrl}" width="22" height="22" class="rounded-circle border" style="object-fit:cover;" />`;
            } else {
                const cleanId = msg.sender.replace(/[^A-Za-z0-9]/g, '');
                const avatarLetters = cleanId.length >= 2 ? cleanId.slice(-2).toUpperCase() : cleanId;
                avatarHtml = `<span class="device-mini-avatar" style="background: ${colorTheme.border}; color: #ffffff;">${avatarLetters}</span>`;
            }

            bubble.innerHTML = `
                <div class="d-flex align-items-center gap-2 mb-1">
                    ${avatarHtml}
                    <span class="chat-sender-tag mb-0" style="color: ${colorTheme.text}; font-weight: 700;">
                        ${displayName}
                    </span>
                    <span class="chat-time-tag ms-auto">${msg.time}</span>
                </div>
                <div class="chat-text-content" style="color: var(--text-main);">${msg.text}</div>
            `;
        }

        this.container.appendChild(bubble);
        this.container.scrollTop = this.container.scrollHeight;
    }

    updateStatus(txt) {
        if (this.peerStatus) this.peerStatus.innerText = txt;
    }

    openPanel() {
        if (this.panel) this.panel.classList.remove('d-none');
    }
}