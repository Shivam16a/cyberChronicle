/**
 * js/directMessenger.js
 * True Real-Time 1-on-1 Direct Messenger with De-duplication & Accurate Delivery
 */
export class DirectMessenger {
    constructor(myDeviceId, cloudEndpoint, onOpenNoteRoom) {
        this.myDeviceId = myDeviceId;
        this.endpoint = cloudEndpoint;
        this.onOpenNoteRoom = onOpenNoteRoom;

        this.drawer = document.getElementById('direct-messenger-drawer');
        this.listView = document.getElementById('messenger-list-view');
        this.chatView = document.getElementById('messenger-chat-view');

        this.btnOpen = document.getElementById('btn-open-friends');
        this.btnClose = document.getElementById('btn-close-messenger');
        this.btnBack = document.getElementById('btn-back-to-friends-list');

        this.tabAllFriends = document.getElementById('tab-nav-all-friends');
        this.tabSearchFriends = document.getElementById('tab-nav-search-friends');
        this.paneAllFriends = document.getElementById('pane-all-friends');
        this.paneSearchFriends = document.getElementById('pane-search-friends');

        this.searchInput = document.getElementById('messenger-search-input');
        this.searchBtn = document.getElementById('btn-search-user-action');
        this.searchResultBox = document.getElementById('search-user-result');

        this.acceptedListEl = document.getElementById('accepted-friends-list');
        this.pendingListEl = document.getElementById('pending-requests-list');
        this.pendingSection = document.getElementById('pending-requests-section');

        this.chatContainer = document.getElementById('direct-chat-messages-container');
        this.chatForm = document.getElementById('direct-chat-form');
        this.chatInput = document.getElementById('direct-msg-input');

        this.activeFriend = null;
        this.replyingTo = null;

        this.rxPicker = document.getElementById('message-reaction-picker');
        this.selectedMsgElement = null;

        // Active P2P Connections Map
        this.activePeerConns = {};

        // DUPLICATE MESSAGE PREVENTION ENGINE
        this.processedMsgIds = new Set();

        this.initEvents();
        this.loadFriendsData();
        this.initRealtimePeerListener();
    }

    initEvents() {
        if (this.btnOpen) {
            this.btnOpen.addEventListener('click', () => {
                this.drawer.classList.remove('d-none');
                this.showListView();
                this.loadFriendsData();
            });
        }

        if (this.btnClose) {
            this.btnClose.addEventListener('click', () => this.drawer.classList.add('d-none'));
        }

        if (this.btnBack) {
            this.btnBack.addEventListener('click', () => {
                this.showListView();
                this.loadFriendsData();
            });
        }

        if (this.tabAllFriends) {
            this.tabAllFriends.addEventListener('click', () => {
                this.tabAllFriends.classList.add('active');
                this.tabSearchFriends.classList.remove('active');
                this.paneAllFriends.classList.remove('d-none');
                this.paneSearchFriends.classList.add('d-none');
                this.loadFriendsData();
            });
        }

        if (this.tabSearchFriends) {
            this.tabSearchFriends.addEventListener('click', () => {
                this.tabSearchFriends.classList.add('active');
                this.tabAllFriends.classList.remove('active');
                this.paneSearchFriends.classList.remove('d-none');
                this.paneAllFriends.classList.add('d-none');
                this.searchResultBox.classList.add('d-none');
                this.searchInput.value = '';
                this.searchInput.focus();
            });
        }

        if (this.searchBtn) {
            this.searchBtn.addEventListener('click', () => this.searchOrAddUser());
        }

        if (this.chatForm) {
            this.chatForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.sendDirectMessage();
            });
        }

        document.getElementById('btn-cancel-reply')?.addEventListener('click', () => {
            this.replyingTo = null;
            document.getElementById('reply-preview-bar').classList.add('d-none');
        });

        document.getElementById('btn-send-active-note-direct')?.addEventListener('click', () => {
            if (!this.activeFriend) return;
            const title = document.getElementById('note-title')?.value || 'Shared Note';
            const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
            const noteUrl = `${window.location.origin}${window.location.pathname}#room=${roomCode}`;

            this.sendDirectMessage(`📄 Shared Note: "${title}"\nTap to join live collaboration: ${noteUrl}`, {
                type: 'NOTE_CARD',
                title: title,
                roomCode: roomCode,
                url: noteUrl
            });
        });

        document.querySelectorAll('.rx-emoji').forEach(el => {
            el.addEventListener('click', () => {
                const emoji = el.getAttribute('data-emoji');
                if (this.selectedMsgElement) {
                    this.applyReaction(this.selectedMsgElement.getAttribute('data-msg-id'), emoji);
                    this.rxPicker.classList.add('d-none');
                }
            });
        });

        document.getElementById('btn-quote-this-msg')?.addEventListener('click', () => {
            if (this.selectedMsgElement) {
                const text = this.selectedMsgElement.querySelector('.chat-text-content')?.innerText || '';
                const user = this.selectedMsgElement.getAttribute('data-sender') || '';
                this.setReplyTarget(user, text);
                this.rxPicker.classList.add('d-none');
            }
        });

        document.addEventListener('click', (e) => {
            if (!this.rxPicker.contains(e.target) && !e.target.closest('.chat-msg')) {
                this.rxPicker.classList.add('d-none');
            }
        });
    }

    showListView() {
        this.listView.classList.remove('d-none');
        this.chatView.classList.add('d-none');
        this.activeFriend = null;
    }

    showChatView(friend) {
        this.activeFriend = friend;
        this.listView.classList.add('d-none');
        this.chatView.classList.remove('d-none');

        document.getElementById('chat-active-name').innerText = friend.name || friend.deviceId;
        document.getElementById('chat-active-sub').innerText = friend.deviceId;
        const avatarImg = document.getElementById('chat-active-avatar');
        if (avatarImg) avatarImg.src = friend.avatarUrl || 'https://cdn-icons-png.flaticon.com/512/847/847969.png';

        this.clearUnread(friend.deviceId);
        this.loadDirectChatHistory();
        this.connectToPeer(friend.deviceId);
    }

    initRealtimePeerListener() {
        const cleanId = this.myDeviceId.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
        const myPeerId = 'cyber-dm-' + cleanId;

        try {
            this.dmPeer = new Peer(myPeerId, { debug: 1 });

            this.dmPeer.on('open', (id) => {
                console.log('[DM Peer Online]:', id);
            });

            this.dmPeer.on('connection', (conn) => {
                this.setupIncomingConnection(conn);
            });

            this.dmPeer.on('error', (err) => {
                console.warn('[DM Peer Status]:', err.type);
            });
        } catch (e) {
            console.error('[DM Peer Init Error]:', e);
        }

        this.p2pBroadcast = new BroadcastChannel('DIRECT_P2P_MESH_' + this.myDeviceId);
        this.p2pBroadcast.onmessage = (e) => this.handleIncomingPacket(e.data);
    }

    connectToPeer(targetDeviceId) {
        if (!this.dmPeer || this.dmPeer.destroyed) return;
        const cleanTarget = targetDeviceId.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
        const targetPeerId = 'cyber-dm-' + cleanTarget;

        if (!this.activePeerConns[targetDeviceId] || !this.activePeerConns[targetDeviceId].open) {
            try {
                const conn = this.dmPeer.connect(targetPeerId, { reliable: true });
                this.setupIncomingConnection(conn, targetDeviceId);
            } catch (e) { }
        }
    }

    setupIncomingConnection(conn, knownDeviceId = null) {
        conn.on('open', () => {
            const peerDevId = knownDeviceId || conn.metadata?.fromDevice || conn.peer.replace('cyber-dm-', '').toUpperCase();
            this.activePeerConns[peerDevId] = conn;
        });

        conn.on('data', (packet) => {
            this.handleIncomingPacket(packet);
        });

        conn.on('close', () => {
            if (knownDeviceId) delete this.activePeerConns[knownDeviceId];
        });
    }

    // ============================================================
    // DE-DUPLICATION ENGINE: IGNORES REPEATED PACKETS
    // ============================================================
    handleIncomingPacket(data) {
        if (!data || data.from === this.myDeviceId) return;

        // Check 1: Agar message ID already process ho chuki hai to turant drop karein
        if (data.id) {
            if (this.processedMsgIds.has(data.id)) {
                return; // Duplicate blocked!
            }
            this.processedMsgIds.add(data.id);
        }

        if (data.type === 'DIRECT_CHAT') {
            // Check 2: Storage me pehle se exist karta hai ya nahi
            const isNew = this.storeMessage(data.from, data);
            if (!isNew) return; // Duplicate blocked!

            // Check 3: Screen par already render hai ya nahi
            if (this.activeFriend && this.activeFriend.deviceId === data.from) {
                this.renderDirectBubble(data, false);
            } else {
                this.incrementUnread(data.from);
                this.loadFriendsData();
            }
        } else if (data.type === 'FRIEND_REQUEST_P2P') {
            this.handleIncomingFriendRequest(data);
        } else if (data.type === 'FRIEND_ACCEPTED_P2P') {
            this.addAcceptedFriendLocally({
                deviceId: data.from,
                name: data.name || data.from,
                avatarUrl: data.avatarUrl || 'https://cdn-icons-png.flaticon.com/512/847/847969.png'
            });
        } else if (data.type === 'REACTION') {
            this.renderReactionOnScreen(data.msgId, data.emoji);
        }
    }

    // ============================================================
    // SEND MESSAGE (Unique ID with Milliseconds + Random Salt)
    // ============================================================
    sendDirectMessage(customText = null, attachment = null) {
        const text = customText || this.chatInput.value.trim();
        if (!text || !this.activeFriend) return;

        // Guaranteed Unique ID
        const msgId = 'dmsg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
        const packet = {
            id: msgId,
            type: 'DIRECT_CHAT',
            from: this.myDeviceId,
            to: this.activeFriend.deviceId,
            text: text,
            attachment: attachment,
            replyTo: this.replyingTo,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        // Mark as processed locally
        this.processedMsgIds.add(msgId);

        // 1. Local Storage me save aur screen par render
        this.storeMessage(this.activeFriend.deviceId, packet);
        this.renderDirectBubble(packet, true);

        // 2. WebRTC P2P DataConnection
        const conn = this.activePeerConns[this.activeFriend.deviceId];
        if (conn && conn.open) {
            try { conn.send(packet); } catch (e) { }
        } else {
            this.connectToPeer(this.activeFriend.deviceId);
            setTimeout(() => {
                const retryConn = this.activePeerConns[this.activeFriend.deviceId];
                if (retryConn && retryConn.open) {
                    try { retryConn.send(packet); } catch (e) { }
                }
            }, 400);
        }

        // 3. Local BroadcastChannel
        try {
            const targetChannel = new BroadcastChannel('DIRECT_P2P_MESH_' + this.activeFriend.deviceId);
            targetChannel.postMessage(packet);
        } catch (e) { }

        // 4. Cloud Inbox Dispatch
        if (this.endpoint && !this.endpoint.includes('YOUR_DEFAULT_ID_HERE')) {
            fetch(this.endpoint, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'send_to_friend',
                    fromDevice: this.myDeviceId,
                    toDevice: this.activeFriend.deviceId,
                    type: 'DIRECT_CHAT',
                    note: packet
                })
            }).catch(() => { });
        }

        if (!customText) this.chatInput.value = '';
        this.replyingTo = null;
        document.getElementById('reply-preview-bar').classList.add('d-none');
    }

    // ============================================================
    // SEARCH & FRIENDS HANDLING
    // ============================================================
    async searchOrAddUser() {
        const query = this.searchInput.value.trim();
        if (!query) return;

        if (query.toUpperCase() === this.myDeviceId.toUpperCase()) {
            alert('Aap khud ko friend request nahi bhej sakte.');
            return;
        }

        this.searchResultBox.classList.remove('d-none');
        this.searchResultBox.innerHTML = `<span class="spinner-border spinner-border-sm text-info"></span> Searching directory...`;

        try {
            const res = await fetch(`${this.endpoint}?search_user=true&q=${encodeURIComponent(query)}`);
            const data = await res.json().catch(() => ({}));

            if (!data || data.notFound) {
                this.searchResultBox.innerHTML = `
          <div class="p-2 text-danger small border border-danger rounded" style="background:rgba(239,68,68,0.1);">
            User nahi mila ya profile Private hai. Kripya exact Device ID daalein.
          </div>
        `;
                return;
            }

            const targetId = String(data.deviceId).trim();
            const targetName = data.name || targetId;
            const avatar = data.avatarUrl || 'https://cdn-icons-png.flaticon.com/512/847/847969.png';

            const storedFriends = this.getStoredFriends();
            const alreadyFriend = storedFriends.some(f => String(f.deviceId).trim().toUpperCase() === targetId.toUpperCase());

            let actionBtnHtml = '';
            if (alreadyFriend) {
                actionBtnHtml = `<span class="already-friends-tag"><i class="bi bi-check-circle-fill"></i> Friends</span>`;
            } else {
                actionBtnHtml = `<button class="cyber-btn btn-sm" id="btn-confirm-send-req"><i class="bi bi-person-plus-fill"></i> Send Request</button>`;
            }

            this.searchResultBox.innerHTML = `
        <div class="p-2 rounded border border-secondary d-flex justify-content-between align-items-center" style="background:rgba(125,125,125,0.08);">
          <div class="d-flex align-items-center gap-2">
            <img src="${avatar}" width="34" height="34" class="rounded-circle border border-info" style="object-fit:cover;" />
            <div>
              <strong style="color:var(--neon-accent); font-size:0.95rem;">${targetName}</strong>
              <br/><small class="text-muted font-monospace">${targetId}</small>
            </div>
          </div>
          ${actionBtnHtml}
        </div>
      `;

            if (!alreadyFriend) {
                document.getElementById('btn-confirm-send-req').onclick = () => {
                    this.dispatchFriendRequest(targetId, targetName, avatar);
                };
            }

        } catch (e) {
            this.searchResultBox.innerHTML = `<div class="p-2 text-warning small">Network error. Check connection.</div>`;
        }
    }

    async dispatchFriendRequest(targetId, targetName, avatar) {
        const profile = window.activeProfileManager
            ? window.activeProfileManager.getChatIdentity()
            : { displayName: this.myDeviceId, avatarUrl: "" };

        const reqPacket = {
            action: "friend_action",
            subAction: "send",
            fromDevice: this.myDeviceId,
            fromName: profile.displayName || this.myDeviceId,
            fromAvatar: profile.avatarUrl || "",
            toDevice: targetId
        };

        if (this.endpoint && !this.endpoint.includes('YOUR_DEFAULT_ID_HERE')) {
            await fetch(this.endpoint, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(reqPacket)
            });
        }

        try {
            const targetChannel = new BroadcastChannel('DIRECT_P2P_MESH_' + targetId);
            targetChannel.postMessage({
                type: 'FRIEND_REQUEST_P2P',
                from: this.myDeviceId,
                name: profile.displayName,
                avatarUrl: profile.avatarUrl
            });
        } catch (e) { }

        this.searchResultBox.classList.add('d-none');
        this.searchInput.value = '';
        alert(`Friend Request successfully sent to ${targetName}!`);
    }

    handleIncomingFriendRequest(req) {
        let pending = JSON.parse(localStorage.getItem('PENDING_FRIEND_REQUESTS') || '[]');
        if (!pending.some(p => String(p.deviceId).trim().toUpperCase() === String(req.from).trim().toUpperCase())) {
            pending.push({
                deviceId: req.from,
                name: req.name || req.from,
                avatarUrl: req.avatarUrl || 'https://cdn-icons-png.flaticon.com/512/847/847969.png'
            });
            localStorage.setItem('PENDING_FRIEND_REQUESTS', JSON.stringify(pending));
        }
        this.loadFriendsData();
    }

    acceptFriendRequest(friend) {
        let pending = JSON.parse(localStorage.getItem('PENDING_FRIEND_REQUESTS') || '[]');
        pending = pending.filter(p => String(p.deviceId).trim().toUpperCase() !== String(friend.deviceId).trim().toUpperCase());
        localStorage.setItem('PENDING_FRIEND_REQUESTS', JSON.stringify(pending));

        this.addAcceptedFriendLocally(friend);

        const profile = window.activeProfileManager ? window.activeProfileManager.getChatIdentity() : { displayName: this.myDeviceId, avatarUrl: "" };
        try {
            const senderChannel = new BroadcastChannel('DIRECT_P2P_MESH_' + friend.deviceId);
            senderChannel.postMessage({
                type: 'FRIEND_ACCEPTED_P2P',
                from: this.myDeviceId,
                name: profile.displayName,
                avatarUrl: profile.avatarUrl
            });
        } catch (e) { }

        if (this.endpoint && !this.endpoint.includes('YOUR_DEFAULT_ID_HERE')) {
            fetch(this.endpoint, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: "friend_action",
                    subAction: "accept",
                    fromDevice: this.myDeviceId,
                    fromName: profile.displayName,
                    fromAvatar: profile.avatarUrl,
                    toDevice: friend.deviceId
                })
            }).catch(() => { });
        }

        this.loadFriendsData();
        alert(`Connected with ${friend.name}! Dono devices ab 1-on-1 chat kar sakte hain.`);
    }

    addAcceptedFriendLocally(friend) {
        let friends = this.getStoredFriends();
        if (!friends.some(f => String(f.deviceId).trim().toUpperCase() === String(friend.deviceId).trim().toUpperCase())) {
            friends.push(friend);
            localStorage.setItem('SAVED_FRIENDS_PROFILES', JSON.stringify(friends));
        }
        this.loadFriendsData();
    }

    getStoredFriends() {
        return JSON.parse(localStorage.getItem('SAVED_FRIENDS_PROFILES') || '[]');
    }

    getUnreadCount(friendId) {
        const unreadMap = JSON.parse(localStorage.getItem('UNREAD_MAP') || '{}');
        return unreadMap[friendId] || 0;
    }

    incrementUnread(friendId) {
        const unreadMap = JSON.parse(localStorage.getItem('UNREAD_MAP') || '{}');
        unreadMap[friendId] = (unreadMap[friendId] || 0) + 1;
        localStorage.setItem('UNREAD_MAP', JSON.stringify(unreadMap));
    }

    clearUnread(friendId) {
        const unreadMap = JSON.parse(localStorage.getItem('UNREAD_MAP') || '{}');
        if (unreadMap[friendId]) {
            delete unreadMap[friendId];
            localStorage.setItem('UNREAD_MAP', JSON.stringify(unreadMap));
        }
    }

    loadFriendsData() {
        const pending = JSON.parse(localStorage.getItem('PENDING_FRIEND_REQUESTS') || '[]');
        if (pending.length > 0) {
            this.pendingSection.classList.remove('d-none');
            this.pendingListEl.innerHTML = '';
            pending.forEach(p => {
                const li = document.createElement('li');
                li.className = 'p-2 rounded mb-2 border border-warning d-flex justify-content-between align-items-center';
                li.style.background = 'rgba(245, 158, 11, 0.08)';
                li.innerHTML = `
          <div class="d-flex align-items-center gap-2">
            <img src="${p.avatarUrl}" width="30" height="30" class="rounded-circle border" />
            <div><strong class="d-block" style="font-size:0.85rem;">${p.name}</strong><small class="text-muted font-monospace">${p.deviceId}</small></div>
          </div>
          <button class="cyber-btn btn-sm btn-accept-req" style="background:var(--neon-accent); color:#000;"><i class="bi bi-check-lg"></i> Accept</button>
        `;
                li.querySelector('.btn-accept-req').onclick = () => this.acceptFriendRequest(p);
                this.pendingListEl.appendChild(li);
            });
        } else {
            this.pendingSection.classList.add('d-none');
        }

        const friends = this.getStoredFriends();
        this.acceptedListEl.innerHTML = '';

        if (friends.length === 0) {
            this.acceptedListEl.innerHTML = `<li class="text-muted small px-2 py-4 text-center">No connected friends yet.<br/>Go to "Add Friends" tab to connect!</li>`;
            return;
        }

        friends.forEach(f => {
            const unreadCount = this.getUnreadCount(f.deviceId);
            const unreadBadgeHtml = unreadCount > 0 ? `<span class="unread-msg-badge">${unreadCount}</span>` : '';

            const li = document.createElement('li');
            li.className = 'friend-list-item d-flex align-items-center justify-content-between';
            li.innerHTML = `
        <div class="d-flex align-items-center gap-2 overflow-hidden">
          <img src="${f.avatarUrl || 'https://cdn-icons-png.flaticon.com/512/847/847969.png'}" width="38" height="38" class="rounded-circle border border-info" style="object-fit:cover;" />
          <div class="overflow-hidden">
            <strong class="d-block text-truncate" style="font-size:0.95rem; color:var(--text-main);">${f.name || f.deviceId}</strong>
            <small class="text-muted font-monospace" style="font-size:0.75rem;">${f.deviceId}</small>
          </div>
        </div>
        <div class="d-flex align-items-center gap-2">
          ${unreadBadgeHtml}
          <i class="bi bi-chat-dots-fill text-primary fs-5"></i>
        </div>
      `;
            li.onclick = () => this.showChatView(f);
            this.acceptedListEl.appendChild(li);
        });
    }

    setReplyTarget(sender, snippet) {
        this.replyingTo = { sender, snippet: snippet.substring(0, 40) };
        const bar = document.getElementById('reply-preview-bar');
        bar.classList.remove('d-none');
        document.getElementById('reply-to-user').innerText = `Replying to ${sender}`;
        document.getElementById('reply-to-snippet').innerText = this.replyingTo.snippet;
        this.chatInput.focus();
    }

    applyReaction(msgId, emoji) {
        this.renderReactionOnScreen(msgId, emoji);
        if (this.activeFriend) {
            const packet = { type: 'REACTION', msgId, emoji, from: this.myDeviceId };
            const conn = this.activePeerConns[this.activeFriend.deviceId];
            if (conn && conn.open) {
                try { conn.send(packet); } catch (e) { }
            }
            try {
                const targetChannel = new BroadcastChannel('DIRECT_P2P_MESH_' + this.activeFriend.deviceId);
                targetChannel.postMessage(packet);
            } catch (e) { }
        }
    }

    renderReactionOnScreen(msgId, emoji) {
        const msgEl = document.querySelector(`[data-msg-id="${msgId}"]`);
        if (msgEl) {
            let row = msgEl.querySelector('.reactions-badge-row');
            if (!row) {
                row = document.createElement('div');
                row.className = 'reactions-badge-row';
                msgEl.appendChild(row);
            }
            row.innerHTML = `<span class="rx-badge">${emoji}</span>`;
        }
    }

    // ============================================================
    // SAFE STORAGE WITH DUPLICATE FILTER
    // ============================================================
    storeMessage(friendId, packet) {
        const key = 'CHAT_HISTORY_' + friendId;
        let history = JSON.parse(localStorage.getItem(key) || '[]');

        // Agar same message ID pehle se save hai, to dobara add mat karo
        if (packet.id && history.some(m => m.id === packet.id)) {
            return false; // Not a new message
        }

        history.push(packet);
        if (history.length > 80) history.shift();
        localStorage.setItem(key, JSON.stringify(history));
        return true; // Successfully added new message
    }

    loadDirectChatHistory() {
        this.chatContainer.innerHTML = '';
        const key = 'CHAT_HISTORY_' + this.activeFriend.deviceId;
        const history = JSON.parse(localStorage.getItem(key) || '[]');
        history.forEach(msg => {
            // Also remember loaded IDs in memory
            if (msg.id) this.processedMsgIds.add(msg.id);
            this.renderDirectBubble(msg, msg.from === this.myDeviceId);
        });
    }

    // ============================================================
    // SAFE RENDER WITH DOM DUPLICATION CHECK
    // ============================================================
    renderDirectBubble(msg, isMe) {
        // Agar same message DOM me already render hai, to dobara mat dalo
        if (msg.id && this.chatContainer.querySelector(`[data-msg-id="${msg.id}"]`)) {
            return; // Already rendered!
        }

        const bubble = document.createElement('div');
        bubble.className = `chat-msg ${isMe ? 'msg-outgoing' : 'msg-incoming'}`;
        if (msg.id) bubble.setAttribute('data-msg-id', msg.id);
        bubble.setAttribute('data-sender', isMe ? 'You' : (this.activeFriend ? (this.activeFriend.name || this.activeFriend.deviceId) : msg.from));

        let replyHtml = '';
        if (msg.replyTo) {
            replyHtml = `
        <div class="quoted-bubble">
          <strong class="d-block" style="font-size:0.7rem; color:var(--neon-accent);">${msg.replyTo.sender}</strong>
          <span class="text-truncate d-block">${msg.replyTo.snippet}</span>
        </div>
      `;
        }

        bubble.innerHTML = `
      ${replyHtml}
      <div class="chat-text-content">${msg.text}</div>
      <div class="chat-time-tag text-end mt-1">${msg.time}</div>
    `;

        bubble.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showReactionMenu(bubble, e.clientX, e.clientY);
        });

        bubble.addEventListener('click', (e) => {
            if (window.innerWidth <= 768) {
                this.showReactionMenu(bubble, e.clientX, e.clientY);
            }
        });

        this.chatContainer.appendChild(bubble);
        this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
    }

    showReactionMenu(bubbleEl, x, y) {
        this.selectedMsgElement = bubbleEl;
        this.rxPicker.style.top = `${Math.max(10, y - 48)}px`;
        this.rxPicker.style.left = `${Math.min(x, window.innerWidth - 260)}px`;
        this.rxPicker.classList.remove('d-none');
    }
}