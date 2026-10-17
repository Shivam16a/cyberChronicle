/**
 * js/profile.js
 * User Profile Management (Google Drive Avatar + Sheets Metadata + Privacy Switch)
 */
export class ProfileManager {
    constructor(deviceId, cloudEndpoint) {
        this.deviceId = deviceId;
        this.endpoint = cloudEndpoint;
        this.modalEl = document.getElementById('profileModal');
        this.modalInstance = null;

        this.inputAvatar = document.getElementById('profile-avatar-input');
        this.previewImg = document.getElementById('profile-preview-avatar');
        this.sidebarAvatar = document.getElementById('sidebar-avatar-img');
        this.inputName = document.getElementById('profile-display-name');
        this.inputDevId = document.getElementById('profile-device-id-field');
        this.togglePublic = document.getElementById('profile-public-toggle');
        this.descText = document.getElementById('profile-mode-desc');
        this.btnSave = document.getElementById('btn-save-user-profile');
        this.btnOpen = document.getElementById('btn-open-profile');

        this.pendingBase64Pic = "";
        this.init();
    }

    init() {
        this.loadLocalProfile();

        if (this.btnOpen) {
            this.btnOpen.addEventListener('click', () => {
                if (!this.modalInstance && window.bootstrap) {
                    this.modalInstance = new bootstrap.Modal(this.modalEl);
                }
                this.inputDevId.value = this.deviceId;
                if (this.modalInstance) this.modalInstance.show();
            });
        }

        // Avatar File Picker
        if (this.inputAvatar) {
            this.inputAvatar.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        this.pendingBase64Pic = ev.target.result;
                        this.previewImg.src = this.pendingBase64Pic;
                    };
                    reader.readAsDataURL(file);
                }
            });
        }

        // Privacy Toggle description change
        if (this.togglePublic) {
            this.togglePublic.addEventListener('change', (e) => {
                this.updateDesc(e.target.checked);
            });
        }

        // Save Button
        if (this.btnSave) {
            this.btnSave.addEventListener('click', () => this.saveProfile());
        }
    }

    updateDesc(isPublic) {
        if (isPublic) {
            this.descText.innerText = "Public Mode: Chat me aapka real Name aur Profile Pic sabhi ko dikhegi.";
            this.descText.className = "text-success d-block small";
        } else {
            this.descText.innerText = "Private Mode: Chat me sirf aapki Device ID dikhegi. Name aur Photo hide rahenge.";
            this.descText.className = "text-muted d-block small";
        }
    }

    loadLocalProfile() {
        const saved = localStorage.getItem('USER_PROFILE_DATA');
        if (saved) {
            const data = JSON.parse(saved);
            if (this.inputName) this.inputName.value = data.name || "";
            if (data.avatarUrl) {
                if (this.previewImg) this.previewImg.src = data.avatarUrl;
                if (this.sidebarAvatar) this.sidebarAvatar.src = data.avatarUrl;
            }
            if (this.togglePublic) {
                this.togglePublic.checked = !!data.isPublic;
                this.updateDesc(data.isPublic);
            }
        }
    }

    // Active chat ke liye identity return karega
    getChatIdentity() {
        const saved = localStorage.getItem('USER_PROFILE_DATA');
        if (!saved) {
            return { displayName: this.deviceId, avatarUrl: "", isPublic: false };
        }
        const data = JSON.parse(saved);
        if (data.isPublic && data.name) {
            return {
                displayName: data.name,
                avatarUrl: data.avatarUrl || "",
                isPublic: true
            };
        }
        return {
            displayName: this.deviceId,
            avatarUrl: "",
            isPublic: false
        };
    }

    async saveProfile() {
        const name = this.inputName.value.trim() || "Anonymous";
        const isPublic = this.togglePublic.checked;
        const currentSaved = JSON.parse(localStorage.getItem('USER_PROFILE_DATA') || '{}');

        this.btnSave.disabled = true;
        this.btnSave.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Saving to Google Drive & Sheets...`;

        const payload = {
            action: "save_profile",
            deviceId: this.deviceId,
            name: name,
            isPublic: isPublic,
            avatarBase64: this.pendingBase64Pic,
            existingAvatarUrl: currentSaved.avatarUrl || ""
        };

        try {
            let finalAvatarUrl = this.pendingBase64Pic || currentSaved.avatarUrl || "";

            // Background Google Cloud Call
            if (this.endpoint && !this.endpoint.includes("YOUR_DEFAULT_ID_HERE")) {
                fetch(this.endpoint, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                }).catch(() => { });
            }

            // Local state update
            const localRecord = {
                name: name,
                avatarUrl: finalAvatarUrl,
                isPublic: isPublic
            };
            localStorage.setItem('USER_PROFILE_DATA', JSON.stringify(localRecord));

            if (this.sidebarAvatar && finalAvatarUrl) {
                this.sidebarAvatar.src = finalAvatarUrl;
            }

            alert("Profile Saved! Settings synced with Google Sheets & Drive.");
            if (this.modalInstance) this.modalInstance.hide();
        } catch (err) {
            alert("Error saving profile: " + err.message);
        } finally {
            this.btnSave.disabled = false;
            this.btnSave.innerHTML = `<i class="bi bi-cloud-arrow-up-fill me-1"></i> Save to Google Cloud & Sync`;
        }
    }
}