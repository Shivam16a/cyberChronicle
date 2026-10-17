export class MediaRecorderEngine {
    static async recordAudio(durationMs = 4000) {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Audio unsupported');
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const rec = new MediaRecorder(stream);
        const chunks = [];

        return new Promise((resolve) => {
            rec.ondataavailable = (e) => chunks.push(e.data);
            rec.onstop = () => {
                const blob = new Blob(chunks, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.readAsDataURL(blob);
            };
            rec.start();
            setTimeout(() => {
                rec.stop();
                stream.getTracks().forEach((t) => t.stop());
            }, durationMs);
        });
    }

    static async recordVideo(durationMs = 3500) {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Video unsupported');
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        const rec = new MediaRecorder(stream);
        const chunks = [];

        return new Promise((resolve) => {
            rec.ondataavailable = (e) => chunks.push(e.data);
            rec.onstop = () => {
                const blob = new Blob(chunks, { type: 'video/webm' });
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.readAsDataURL(blob);
            };
            rec.start();
            setTimeout(() => {
                rec.stop();
                stream.getTracks().forEach((t) => t.stop());
            }, durationMs);
        });
    }
}