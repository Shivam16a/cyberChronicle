export class CloudSyncManager {
    static getDeviceId() {
        let deviceId = localStorage.getItem('CYBER_DEVICE_UUID');
        if (!deviceId) {
            deviceId = 'NODE-' + (crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).substring(2, 10)).toUpperCase();
            localStorage.setItem('CYBER_DEVICE_UUID', deviceId);
        }
        return deviceId;
    }

    static async syncWithGoogleCloud(endpointUrl, notesList) {
        if (!endpointUrl) throw new Error('No Cloud Endpoint URL configured');
        const deviceId = this.getDeviceId();

        const payload = {
            deviceId: deviceId,
            timestamp: new Date().toISOString(),
            notesCount: notesList.length,
            notes: notesList
        };

        return fetch(endpointUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    }

    static exportDisk(notes) {
        const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(notes, null, 2));
        const a = document.createElement('a');
        a.href = dataStr;
        a.download = `Diary_${this.getDeviceId()}_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
    }
}