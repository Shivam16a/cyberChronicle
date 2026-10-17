export class ReminderSystem {
    static async request() {
        if ('Notification' in window && Notification.permission !== 'granted') {
            await Notification.requestPermission();
        }
    }

    static schedule(label, seconds) {
        this.request();
        setTimeout(() => {
            if ('Notification' in window && Notification.permission === 'granted') {
                new Notification(`⏰ CHRONO ALARM: ${label}`, {
                    body: 'Scheduled time reached in your Personal Diary.',
                    icon: 'https://cdn-icons-png.flaticon.com/512/1827/1827349.png'
                });
            } else {
                alert(`⏰ ALARM REMINDER:\n${label}`);
            }
        }, seconds * 1000);
    }
}