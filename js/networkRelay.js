/**
 * js/networkRelay.js
 * Background Polling, Audio Chime, Direct Chat Sync & Native OS Push Alerts
 */
export class NetworkRelay {
    constructor(deviceId, endpointUrl, onNoteReceivedCallback) {
        this.deviceId = deviceId;
        this.endpoint = endpointUrl;
        this.onNoteReceived = onNoteReceivedCallback;
        this.pollInterval = 3000; // Har 3 second me background inbox check karega

        this.initAudioChime();
        this.initServiceWorker();
        this.autoRegisterDevice();
        this.startBackgroundInboxListener();
    }

    // Pure Web Audio API tone (Bina external MP3 file ke clean sound alert)
    initAudioChime() {
        this.playChime = () => {
            try {
                const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
                osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.1); // A5
                gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start();
                osc.stop(audioCtx.currentTime + 0.35);
            } catch (e) { }
        };
    }

    async initServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                this.swReg = await navigator.serviceWorker.register('sw.js');
            } catch (e) { }
        }
    }

    async autoRegisterDevice() {
        if (!this.endpoint || this.endpoint.includes('YOUR_DEFAULT_ID_HERE')) return;
        const payload = {
            action: 'register_device',
            deviceId: this.deviceId,
            hasPush: 'Notification' in window && Notification.permission === 'granted'
        };
        try {
            await fetch(this.endpoint, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } catch (e) { }
    }

    startBackgroundInboxListener() {
        if (!this.endpoint || this.endpoint.includes('YOUR_DEFAULT_ID_HERE')) return;

        setInterval(async () => {
            try {
                const res = await fetch(`${this.endpoint}?check_inbox=true&deviceId=${this.deviceId}`);
                const data = await res.json();

                if (data && data.messages && data.messages.length > 0) {
                    data.messages.forEach((msg) => {
                        this.playChime(); // Audio Sound Alert bajega
                        this.triggerNativeNotification(msg); // Desktop/OS native notification

                        // 1. DIRECT 1-on-1 REAL-TIME CHAT MESSAGE DISPATCH
                        if (msg.type === 'DIRECT_CHAT' && window.activeDirectMessenger) {
                            window.activeDirectMessenger.handleIncomingPacket(msg.payload);
                        }
                        // 2. INCOMING FRIEND REQUEST
                        else if (msg.type === 'FRIEND_REQUEST' && window.activeDirectMessenger) {
                            window.activeDirectMessenger.handleIncomingFriendRequest({
                                from: msg.from,
                                name: msg.payload?.name || msg.from,
                                avatarUrl: msg.payload?.avatarUrl
                            });
                        }
                        // 3. FRIEND REQUEST ACCEPTED NOTIFICATION (Sender profile update)
                        else if (msg.type === 'FRIEND_ACCEPTED' && window.activeDirectMessenger) {
                            window.activeDirectMessenger.addAcceptedFriendLocally({
                                deviceId: msg.from,
                                name: msg.payload?.name || msg.from,
                                avatarUrl: msg.payload?.avatarUrl || 'https://cdn-icons-png.flaticon.com/512/847/847969.png'
                            });
                        }
                        // 4. INCOMING COLLABORATIVE NOTE DISPATCH
                        else if (msg.type === 'NOTE_SHARE' && this.onNoteReceived) {
                            this.onNoteReceived(msg);
                        }
                    });
                }
            } catch (e) { }
        }, this.pollInterval);
    }

    triggerNativeNotification(msg) {
        let title = 'Notes & Diary Alert';
        let body = 'You have a new update';
        let targetUrl = window.location.href;

        if (msg.type === 'DIRECT_CHAT') {
            const senderName = msg.payload?.sender || msg.from;
            title = `💬 Message from ${senderName}`;
            body = msg.payload?.text || 'Sent you a direct message.';
        } else if (msg.type === 'NOTE_SHARE') {
            title = `📝 Note Received from ${msg.from}`;
            body = `Title: "${msg.payload?.title || 'Shared Note'}". Tap to view note.`;
            targetUrl = msg.payload?.url || targetUrl;
        } else if (msg.type === 'FRIEND_REQUEST') {
            title = `👥 Friend Request from ${msg.from}`;
            body = `Device ${msg.from} wants to connect with you on Notes & Diary.`;
        } else if (msg.type === 'FRIEND_ACCEPTED') {
            title = `✅ Friend Request Accepted`;
            body = `${msg.payload?.name || msg.from} accepted your friend request!`;
        }

        // 1. Service Worker Background Push
        if (this.swReg && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
                type: 'SHOW_NOTIFICATION',
                payload: { title, body, url: targetUrl }
            });
        } else if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, {
                body: body,
                icon: 'https://cdn-icons-png.flaticon.com/512/1827/1827349.png'
            });
        }
    }
}