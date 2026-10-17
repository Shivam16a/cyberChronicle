export class ThemeManager {
    constructor() {
        this.canvas = document.getElementById('fx-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.theme = localStorage.getItem('CYBER_THEME') || 'default';
        this.enabled = this.theme !== 'default'; // Disabled by default for clean look

        this.initCanvas();
        this.setTheme(this.theme);
        this.animate();
    }

    setTheme(name) {
        this.theme = name;
        localStorage.setItem('CYBER_THEME', name);
        document.body.className = `theme-${name}`;
        document.documentElement.setAttribute('data-theme', name);

        // Disable particles for default clean theme
        if (name === 'default') {
            this.enabled = false;
            document.getElementById('toggle-particles').checked = false;
        }

        const selector = document.getElementById('theme-selector');
        if (selector) selector.value = name;
    }

    initCanvas() {
        const resize = () => {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
        };
        resize();
        window.addEventListener('resize', resize);

        window.addEventListener('mousemove', (e) => {
            if (!this.enabled) return;
            let char = '•';
            let col = '#2563eb';

            if (this.theme === 'cyber') {
                char = Math.random() > 0.5 ? '1' : '0';
                col = '#00f3ff';
            } else if (this.theme === 'space') {
                char = Math.random() > 0.4 ? '✦' : '•';
                col = '#c084fc';
            } else if (this.theme === 'doctor') {
                char = '+';
                col = '#0ea5e9';
            } else if (this.theme === 'asteroid') {
                char = Math.random() > 0.5 ? '█' : '>';
                col = '#ffb000';
            } else if (this.theme === 'farmer') {
                char = '☘';
                col = '#84cc16';
            }

            this.particles.push({
                x: e.clientX,
                y: e.clientY,
                vx: (Math.random() - 0.5) * 2,
                vy: (Math.random() - 0.5) * 2 - 1,
                alpha: 1,
                char,
                col
            });
        });
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.alpha -= 0.025;

            this.ctx.fillStyle = p.col;
            this.ctx.globalAlpha = Math.max(0, p.alpha);
            this.ctx.font = '13px monospace';
            this.ctx.fillText(p.char, p.x, p.y);

            if (p.alpha <= 0) {
                this.particles.splice(i, 1);
                i--;
            }
        }
        this.ctx.globalAlpha = 1;
        requestAnimationFrame(() => this.animate());
    }
}