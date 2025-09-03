// Intro typing effect, then show crawl, then reveal site
(function() {
    const root = document.documentElement;
    const body = document.body;
    const intro = document.getElementById('intro');
    const introText = document.getElementById('intro-text');
    const crawlContainer = document.getElementById('crawl-container');
    const crawlFlashLayer = document.querySelector('.crawl-flash-layer');
    const skipBtn = null;
    const site = document.getElementById('site');
    const interlude = document.getElementById('interlude');
    const roarAudio = document.getElementById('roar-audio');
    const interludeCanvas = document.getElementById('fx');
    const bg3d = document.getElementById('bg3d');
    const yearSpan = document.getElementById('year');
    if (yearSpan) yearSpan.textContent = String(new Date().getFullYear());
    const prefersReducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

    let introDone = false;
    let crawlShown = false;
    let interludeShown = false;
    let flashTimer = 0;

    function beginTyping() {
        const text = 'SHINZILLA';
        introText.textContent = text;
        // CSS typed effect by expanding width
        const duration = 1600; // ms
        const steps = text.length;
        introText.style.animation = `typing ${duration}ms steps(${steps}) 200ms forwards, caret 900ms steps(1) infinite`;
        const onTypingEnd = () => {
            introText.removeEventListener('animationend', onTypingEnd);
            setTimeout(() => {
                introDone = true;
                showCrawl();
            }, 400);
        };
        introText.addEventListener('animationend', onTypingEnd);
    }

    function showCrawl() {
        if (crawlShown) return;
        crawlShown = true;
        body.classList.add('hide-intro');
        body.classList.add('show-crawl');
        if (!prefersReducedMotion) {
            startCrawlImageFlashes();
        }

        // After crawl animation ends, show interlude
        const crawlEl = document.querySelector('.crawl');
        if (crawlEl) {
            // If animations are disabled or not present, go straight to interlude
            const cs0 = getComputedStyle(crawlEl);
            const hasAnim = cs0.animationName && cs0.animationName !== 'none';
            if (prefersReducedMotion || !hasAnim) {
                crawlContainer.classList.add('shock');
                showInterlude();
                return;
            }
            const onCrawlEnd = () => {
                crawlEl.removeEventListener('animationend', onCrawlEnd);
                // cinematic flash + shake, then INSTANT interlude
                crawlContainer.classList.add('shock');
                showInterlude();
            };
            crawlEl.addEventListener('animationend', onCrawlEnd);

            // Start prelude slightly BEFORE the crawl technically ends to avoid dead time
            const cs = getComputedStyle(crawlEl);
            const parseFirstTimeSec = (val) => {
                if (!val) return 0;
                const first = String(val).split(',')[0].trim();
                const m = first.match(/([\d.]+)s/);
                return m ? parseFloat(m[1]) : parseFloat(first) || 0;
            };
            const durSec = parseFirstTimeSec(cs.animationDuration) || 32;
            const delaySec = parseFirstTimeSec(cs.animationDelay) || 0.6;
            const leadMs = 1600; // overlap before end to prevent black gap
            const totalMs = (durSec + delaySec) * 1000;
            const fireIn = Math.max(0, totalMs - leadMs);
            setTimeout(() => {
                if (!interludeShown) {
                    crawlContainer.classList.add('shock');
                    showInterlude();
                }
            }, fireIn);

            // Anchor to the true animation start for reliability across browsers
            const onCrawlStart = () => {
                crawlEl.removeEventListener('animationstart', onCrawlStart);
                const startBasedMs = Math.max(0, (durSec * 1000) - leadMs);
                setTimeout(() => {
                    if (!interludeShown) {
                        crawlContainer.classList.add('shock');
                        showInterlude();
                    }
                }, startBasedMs);
            };
            crawlEl.addEventListener('animationstart', onCrawlStart, { once: true });

            // Hard safety: ensure we never wait forever (network hiccups, reduced motion, etc.)
            setTimeout(() => {
                if (!interludeShown) {
                    crawlContainer.classList.add('shock');
                    showInterlude();
                }
            }, Math.max(1000, totalMs + 1000));

            // Visual completion detector: when last paragraph is off-screen, trigger immediately
            const lastParagraph = crawlEl.querySelector('p:last-of-type');
            const wrapper = document.querySelector('.crawl-wrapper');
            if (lastParagraph && wrapper) {
                const checkOffscreen = () => {
                    if (interludeShown) return;
                    const rect = lastParagraph.getBoundingClientRect();
                    const wrapRect = wrapper.getBoundingClientRect();
                    // If the last paragraph has fully moved above the top of the wrapper viewport
                    if (rect.bottom <= wrapRect.top + 10) {
                        crawlContainer.classList.add('shock');
                        showInterlude();
                        return;
                    }
                    requestAnimationFrame(checkOffscreen);
                };
                // Start checking on next frame to ensure animation began
                requestAnimationFrame(checkOffscreen);
            }
        } else {
            // Fallback in unlikely case
            setTimeout(showInterlude, prefersReducedMotion ? 300 : 23000);
        }
    }

    let rafId = 0;
    let fxRunning = false;
    function showInterlude() {
        if (interludeShown) return;
        interludeShown = true;
        // Show interlude first to overlap visually, then hide crawl next frame
        body.classList.add('show-interlude');
        requestAnimationFrame(() => {
            body.classList.remove('show-crawl');
            stopCrawlImageFlashes();
        });
        playRoar();
        startCanvasFX();
        // Auto proceed: immediate after titles animate
        if (interlude) {
            const spans = interlude.querySelectorAll('.interlude-message h2 span');
            let ended = 0;
            spans.forEach((s) => {
                s.addEventListener('animationend', () => {
                    ended++;
                    if (ended === spans.length) {
                        proceedToSite();
                    }
                }, { once: true });
            });
            // Allow user to proceed earlier
            interlude.addEventListener('click', proceedToSite, { once: true });
        }
        window.addEventListener('keydown', onInterludeKey, { once: true });
    }

    function onInterludeKey(e) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            proceedToSite();
        }
    }

    function proceedToSite() {
        stopCanvasFX();
        revealSite();
    }

    function revealSite() {
        body.classList.remove('show-crawl');
        body.classList.remove('show-interlude');
        body.classList.add('show-site');
        if (site) site.removeAttribute('hidden');
        startParallaxBG();
        startEmbers();
    }

    function skipIntro() {
        revealSite();
    }

    let roarPlayed = false;
    async function playRoar() {
        if (!roarAudio) return;
        if (roarPlayed) return;
        try {
            // attempt play; browsers may block without user gesture, but it will work after first click/keypress
            await roarAudio.play();
            roarPlayed = true;
        } catch (err) {
            // fallback: try again on first interlude interaction
            const resume = async () => {
                try { await roarAudio.play(); roarPlayed = true; } catch (_) {}
            };
            interlude && interlude.addEventListener('click', resume, { once: true });
            window.addEventListener('keydown', resume, { once: true });
        }
    }

    // Copy CA button
    const copyBtn = document.getElementById('copy-ca');
    if (copyBtn) {
        copyBtn.addEventListener('click', async () => {
            const ca = copyBtn.getAttribute('data-ca') || '';
            try {
                await navigator.clipboard.writeText(ca);
                const prev = copyBtn.textContent;
                copyBtn.textContent = 'Copied!';
                setTimeout(() => { copyBtn.textContent = prev; }, 1200);
            } catch (e) {
                alert('Contract address: ' + ca);
            }
        });
    }

    // Skip intro removed

    // Kick off
    window.addEventListener('load', beginTyping);

    // Canvas FX: glowing particles with field flow
    function startCanvasFX() {
        if (!interludeCanvas || fxRunning) return;
        const ctx = interludeCanvas.getContext('2d');
        let width = interludeCanvas.width = interlude.clientWidth;
        let height = interludeCanvas.height = interlude.clientHeight;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        interludeCanvas.width = Math.floor(width * dpr);
        interludeCanvas.height = Math.floor(height * dpr);
        interludeCanvas.style.width = width + 'px';
        interludeCanvas.style.height = height + 'px';
        ctx.scale(dpr, dpr);

        const particleCount = Math.floor(Math.min(220, Math.max(120, (width * height) / 15000)));
        const particles = [];
        const TWO_PI = Math.PI * 2;
        const baseHue = 8; // reddish
        const hueVar = 40;
        for (let i = 0; i < particleCount; i++) {
            particles.push({
                x: Math.random() * width,
                y: Math.random() * height,
                r: Math.random() * 2.2 + 0.6,
                a: Math.random() * TWO_PI,
                h: baseHue + Math.random() * hueVar,
                s: 80 + Math.random() * 20,
                l: 55 + Math.random() * 30,
                v: 0.25 + Math.random() * 0.9
            });
        }

        let t = 0;
        fxRunning = true;
        function draw() {
            if (!fxRunning) return;
            t += 0.008;
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = 'rgba(2,3,8,0.22)';
            ctx.fillRect(0, 0, width, height);
            ctx.globalCompositeOperation = 'lighter';
            for (let i = 0; i < particles.length; i++) {
                const p = particles[i];
                const n = noise(p.x * 0.002, p.y * 0.002, t);
                const angle = n * Math.PI * 2;
                p.x += Math.cos(angle) * p.v;
                p.y += Math.sin(angle) * p.v;
                p.a += 0.02;
                wrap(p);
                const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 6);
                grad.addColorStop(0, `hsla(${p.h}, ${p.s}%, ${p.l}%, 0.9)`);
                grad.addColorStop(1, `hsla(${p.h + 30}, ${p.s}%, 40%, 0)`);
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r * (1 + Math.sin(p.a) * 0.25), 0, TWO_PI);
                ctx.fill();
            }
            rafId = requestAnimationFrame(draw);
        }

        function wrap(p) {
            if (p.x < -10) p.x = width + 10;
            if (p.x > width + 10) p.x = -10;
            if (p.y < -10) p.y = height + 10;
            if (p.y > height + 10) p.y = -10;
        }

        function noise(x, y, z) {
            // quick pseudo-noise with sin blends for performance
            return (Math.sin(x * 2.1 + z * 1.3) + Math.sin(y * 1.7 - z * 1.1) + Math.sin((x + y) * 0.3 + z * 0.7)) / 3 * 0.5 + 0.5;
        }

        function onResize() {
            width = interlude.clientWidth;
            height = interlude.clientHeight;
            interludeCanvas.width = Math.floor(width * dpr);
            interludeCanvas.height = Math.floor(height * dpr);
            interludeCanvas.style.width = width + 'px';
            interludeCanvas.style.height = height + 'px';
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.scale(dpr, dpr);
        }
        window.addEventListener('resize', onResize);
        draw();
    }

    function stopCanvasFX() {
        fxRunning = false;
        if (rafId) cancelAnimationFrame(rafId);
    }

    // 3D Parallax background for main site
    function startParallaxBG() {
        if (!bg3d) return;
        const ctx = bg3d.getContext('2d');
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        let width, height;
        const layers = createLayers();

        function resize() {
            width = bg3d.clientWidth;
            height = bg3d.clientHeight;
            bg3d.width = Math.floor(width * dpr);
            bg3d.height = Math.floor(height * dpr);
            ctx.setTransform(1,0,0,1,0,0);
            ctx.scale(dpr, dpr);
        }
        resize();
        window.addEventListener('resize', resize);

        let mx = 0, my = 0; // normalized mouse -1..1
        window.addEventListener('mousemove', (e) => {
            const rect = bg3d.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            const y = (e.clientY - rect.top) / rect.height;
            mx = (x - 0.5) * 2;
            my = (y - 0.5) * 2;
        });

        let t2 = 0;
        function render() {
            t2 += 0.006;
            ctx.clearRect(0, 0, width, height);
            // subtle gradient base
            const g = ctx.createLinearGradient(0, 0, 0, height);
            g.addColorStop(0, '#070b14');
            g.addColorStop(1, '#020308');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, width, height);

            for (let i=0;i<layers.length;i++) {
                const L = layers[i];
                ctx.save();
                const parallaxX = mx * L.depth * 12;
                const parallaxY = my * L.depth * 12;
                ctx.translate(parallaxX, parallaxY);
                L.draw(ctx, width, height, t2);
                ctx.restore();
            }

            requestAnimationFrame(render);
        }
        render();

        function createLayers() {
            const starsNear = makeStars(120, 1.2, 0.9);
            const starsMid = makeStars(180, 0.9, 0.6);
            const starsFar = makeStars(240, 0.6, 0.35);
            const energyRings = makeRings();
            return [
                { depth: 0.15, draw: starsFar },
                { depth: 0.3, draw: starsMid },
                { depth: 0.6, draw: energyRings },
                { depth: 0.9, draw: starsNear },
            ];
        }

        function makeStars(count, size, alpha) {
            const pts = new Array(count).fill(0).map(() => ({ x: Math.random(), y: Math.random(), s: Math.random() * size + 0.3 }));
            return function draw(ctx, w, h, t) {
                ctx.globalCompositeOperation = 'screen';
                ctx.fillStyle = `rgba(255,255,255,${alpha})`;
                for (let i=0;i<pts.length;i++) {
                    const p = pts[i];
                    const tw = Math.sin(t*2 + i) * 0.35 + 0.65;
                    ctx.globalAlpha = alpha * tw;
                    ctx.fillRect(p.x * w, p.y * h, p.s, p.s);
                }
                ctx.globalAlpha = 1;
                ctx.globalCompositeOperation = 'source-over';
            }
        }

        function makeRings() {
            return function draw(ctx, w, h, t) {
                const cx = w * 0.5, cy = h * 0.5;
                for (let i=0;i<3;i++) {
                    const r = (Math.sin(t + i) * 0.5 + 0.5) * Math.min(w, h) * (0.15 + i*0.12);
                    const grad = ctx.createRadialGradient(cx, cy, r*0.2, cx, cy, r);
                    grad.addColorStop(0, 'rgba(255,59,59,0.10)');
                    grad.addColorStop(0.6, 'rgba(255,213,74,0.06)');
                    grad.addColorStop(1, 'rgba(255,255,255,0)');
                    ctx.fillStyle = grad;
                    ctx.beginPath();
                    ctx.arc(cx, cy, r, 0, Math.PI*2);
                    ctx.fill();
                }
            }
        }
    }

    // Button tilt + shine
    const ctas = Array.from(document.querySelectorAll('.btn.cta'));
    ctas.forEach((el) => {
        el.addEventListener('pointermove', (e) => {
            const rect = el.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const px = x / rect.width;
            const py = y / rect.height;
            el.style.setProperty('--px', `${px*100}%`);
            el.style.setProperty('--py', `${py*100}%`);
            const rx = (py - 0.5) * -8;
            const ry = (px - 0.5) * 8;
            el.style.transform = `perspective(600px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-2px)`;
        });
        el.addEventListener('pointerleave', () => {
            el.style.transform = '';
            el.style.removeProperty('--px');
            el.style.removeProperty('--py');
        });
    });
})();

// Crawl image flash engine
function startCrawlImageFlashes() {
    const layer = document.querySelector('.crawl-flash-layer');
    const container = document.getElementById('crawl-container');
    if (!layer || !container) return;
    const images = collectFlashImages();
    if (!images.length) return;
    let running = true;
    const minDelay = 800;  // ms
    const maxDelay = 2200; // ms
    const flashDur = 420;  // ms; should match CSS keyframes overall

    function scheduleNext() {
        if (!running) return;
        const delay = Math.floor(minDelay + Math.random() * (maxDelay - minDelay));
        flashTimer = window.setTimeout(() => {
            if (!running) return;
            const src = images[Math.floor(Math.random() * images.length)];
            layer.style.backgroundImage = `url('${src}')`;
            layer.style.animation = 'none';
            // Force reflow to restart animation
            void layer.offsetWidth;
            layer.style.animation = `flashInOut ${flashDur}ms ease-in-out 1`;
            scheduleNext();
        }, delay);
    }

    // Attach stop handle
    startCrawlImageFlashes.stop = () => {
        running = false;
        if (flashTimer) {
            clearTimeout(flashTimer);
            flashTimer = 0;
        }
        layer.style.animation = 'none';
        layer.style.backgroundImage = '';
    };

    scheduleNext();
}

function stopCrawlImageFlashes() {
    if (typeof startCrawlImageFlashes.stop === 'function') startCrawlImageFlashes.stop();
}

function collectFlashImages() {
    // Simple static list to start; user places images under images/flashes/
    // Uses flash1.jpg .. flash10.jpg
    const base = 'images/flashes/';
    const files = Array.from({ length: 10 }, (_, i) => `flash${i + 1}.jpg`);
    const urls = files.map(f => base + f);
    // Preload
    urls.forEach((u) => { const img = new Image(); img.src = u; });
    return urls;
}


// tsParticles initialization for leaves on main page only
function startEmbers() {
    if (typeof tsParticles === 'undefined') return;
    const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

    tsParticles.load({
        id: 'bg-embers',
        options: {
            fullScreen: { enable: false },
            background: { color: 'transparent' },
            detectRetina: true,
            fpsLimit: 60,
            particles: {
                shape: { type: 'circle' },
                size: { value: { min: 3, max: 8 }, animation: { enable: true, startValue: 'min', speed: 12, minimumValue: 1 } },
                opacity: { value: { min: 0.35, max: 1 }, animation: { enable: true, startValue: 'max', minimumValue: 0, speed: 1, sync: false } },
                number: { value: 0 },
                move: {
                    enable: true,
                    speed: { min: 1.2, max: 2.8 },
                    direction: 'top',
                    angle: { offset: 0, value: 20 },
                    gravity: { enable: false },
                    drift: { min: -3, max: 3 },
                    outModes: { default: 'out', top: 'destroy' }
                },
                rotate: { value: { min: 0, max: 360 }, animation: { enable: true, speed: 12 } },
                wobble: { enable: true, distance: 8, speed: { min: 1.5, max: 3.5 } },
                color: { value: [ '#ffd155', '#ff9233', '#ff4d1a' ] },
                life: { count: 1, duration: { sync: false, value: { min: 1.2, max: 2.2 } } }
            },
            emitters: prefersReduced ? [] : [
                { position: { x: 12, y: 99 }, rate: { delay: 0.08, quantity: 18 }, size: { width: 18, height: 2 } },
                { position: { x: 30, y: 99 }, rate: { delay: 0.07, quantity: 22 }, size: { width: 22, height: 2 } },
                { position: { x: 50, y: 99 }, rate: { delay: 0.06, quantity: 28 }, size: { width: 28, height: 2 } },
                { position: { x: 70, y: 99 }, rate: { delay: 0.07, quantity: 22 }, size: { width: 22, height: 2 } },
                { position: { x: 88, y: 99 }, rate: { delay: 0.08, quantity: 18 }, size: { width: 18, height: 2 } }
            ],
            pauseOnBlur: true,
            pauseOnOutsideViewport: true
        }
    });
}

// Lightning FX during crawl
function startCrawlLightning() {
    const canvas = document.getElementById('crawl-lightning');
    const container = document.getElementById('crawl-container');
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    let running = true;
    let width, height, dpr;

    function resize() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        width = container.clientWidth;
        height = container.clientHeight;
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        ctx.setTransform(1,0,0,1,0,0);
        ctx.scale(dpr, dpr);
    }
    resize();
    window.addEventListener('resize', resize);

    let t = 0;
    function draw() {
        if (!running) return;
        t += 1/60;
        ctx.clearRect(0,0,width,height);
        // ambient red haze
        const g = ctx.createRadialGradient(width*0.5, height*0.75, 0, width*0.5, height*0.75, Math.max(width,height)*0.9);
        g.addColorStop(0, 'rgba(255,0,0,0.06)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0,0,width,height);

        // random lightning strikes (more frequent)
        if (Math.random() < 0.16) {
            const x = Math.random() < 0.5 ? width*0.2 : width*0.8;
            renderBolt(x, 0, x + (Math.random()*80-40), height*0.65);
        }
        requestAnimationFrame(draw);
    }
    draw();

    function renderBolt(x0, y0, x1, y1) {
        const segments = 18;
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(255,50,50,0.9)';
        ctx.shadowColor = 'rgba(255,0,0,0.8)';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        for (let i = 1; i <= segments; i++) {
            const p = i/segments;
            const nx = x0 + (x1 - x0) * p + (Math.random()-0.5) * 26 * (1-p);
            const ny = y0 + (y1 - y0) * p + (Math.random()-0.5) * 12;
            ctx.lineTo(nx, ny);
        }
        ctx.stroke();

        // glow overlay
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(255,120,120,0.35)';
        ctx.lineWidth = 6;
        ctx.stroke();
    }

    startCrawlLightning.stop = () => { running = false; };
}

function stopCrawlLightning() {
    if (typeof startCrawlLightning.stop === 'function') startCrawlLightning.stop();
}