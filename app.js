/* ==========================================================================
   JM SERVICIOS DE LIMPIEZA — Interacciones y animaciones
   JavaScript vanilla, sin dependencias. Cada módulo es independiente y se
   desactiva solo si su markup no existe o si el usuario pide menos movimiento.
   --------------------------------------------------------------------------
   01  Utilidades y ticker compartido
   02  Loader
   03  Texto dividido y reveal al hacer scroll
   04  Header, progreso, scrollspy y menú móvil
   05  Hero: spotlight, profundidad y fade
   06  Burbujas (canvas) y burbujas CSS
   07  Comparador antes / después y casos
   08  Contadores
   09  Marquee reactivo al scroll
   10  Proceso (línea y dial)
   11  Historias (manchas que se borran)
   12  Videos
   13  Acordeón FAQ
   14  Formulario → WhatsApp, horarios
   15  Efectos: tilt, spotlight, imán, cursor
   16  Flotante de WhatsApp y arranque
   ========================================================================== */
(() => {
    'use strict';

    /* ───────────── 01 · UTILIDADES ───────────── */
    const $ = (sel, ctx = document) => ctx.querySelector(sel);
    const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    const lerp = (a, b, t) => a + (b - a) * t;
    const TAU = Math.PI * 2;

    const root = document.documentElement;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const WA_NUMBER = '525632853590';

    /** Un único bucle rAF compartido por todos los módulos animados. */
    const ticker = (() => {
        const fns = new Set();
        let raf = 0;
        let last = 0;
        const loop = (t) => {
            const dt = Math.min(64, t - last || 16);
            last = t;
            fns.forEach((fn) => fn(t, dt));
            raf = fns.size ? requestAnimationFrame(loop) : 0;
        };
        const api = {
            add(fn) {
                fns.add(fn);
                if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); }
                return () => api.remove(fn);
            },
            remove(fn) { fns.delete(fn); },
        };
        return api;
    })();

    /** Estado de scroll compartido (posición y velocidad suavizada). */
    const scrollState = { y: window.scrollY, dy: 0, vel: 0 };
    const scrollHandlers = new Set();
    (() => {
        let prev = window.scrollY;
        let queued = false;
        window.addEventListener('scroll', () => {
            if (queued) return;
            queued = true;
            requestAnimationFrame(() => {
                queued = false;
                const y = window.scrollY;
                scrollState.dy += y - prev;
                prev = y;
                scrollState.y = y;
                scrollHandlers.forEach((fn) => fn(scrollState));
            });
        }, { passive: true });
        ticker.add(() => {
            scrollState.vel = lerp(scrollState.vel, scrollState.dy, .2);
            scrollState.dy *= .78;
        });
    })();
    const onScroll = (fn) => { scrollHandlers.add(fn); fn(scrollState); };

    /** Observa un elemento una sola vez cuando entra al viewport. */
    const once = (els, cb, opts = {}) => {
        const io = new IntersectionObserver((entries) => {
            entries.forEach((e) => {
                if (e.isIntersecting) { io.unobserve(e.target); cb(e.target, e); }
            });
        }, { threshold: .2, ...opts });
        els.forEach((el) => io.observe(el));
        return io;
    };

    /** Enlace de WhatsApp con mensaje prellenado. */
    const waLink = (text) => `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text)}`;

    /* ───────────── 02 · LOADER ───────────── */
    function initLoader() {
        const loader = $('#loader');
        const finish = () => {
            root.classList.add('is-ready');
            document.dispatchEvent(new CustomEvent('jm:ready'));
        };
        if (!loader) { root.classList.remove('is-loading'); finish(); return; }

        const pctEl = $('[data-loader-pct]', loader);
        const txtEl = $('[data-loader-text]', loader);
        const messages = [
            [0, 'Preparando tu limpieza profunda'],
            [34, 'Cargando servicios y resultados'],
            [68, 'Puliendo los últimos detalles'],
            [94, '¡Todo listo!'],
        ];
        const minTime = reduceMotion ? 250 : 2300;
        const t0 = performance.now();
        let ready = false;
        let progress = 0;
        let lastMsg = -1;
        let ended = false;

        const loaded = new Promise((res) => (document.readyState === 'complete' ? res() : window.addEventListener('load', res, { once: true })));
        const fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
        const cap = new Promise((res) => setTimeout(res, 4500)); // nunca bloqueamos más de 4.5 s
        Promise.race([Promise.all([loaded, fonts]), cap]).then(() => { ready = true; });

        const end = () => {
            if (ended) return;
            ended = true;
            loader.classList.add('is-done');
            window.setTimeout(finish, 280);
            window.setTimeout(() => {
                loader.remove();
                root.classList.remove('is-loading');
            }, reduceMotion ? 50 : 1250);
        };

        const stop = ticker.add((now) => {
            const elapsed = now - t0;
            const timeT = clamp(elapsed / minTime, 0, 1);
            const eased = 1 - Math.pow(1 - timeT, 2.2);
            const target = ready ? eased : Math.min(eased, .9);
            progress = lerp(progress, target * 100, .16);
            const shown = Math.min(100, Math.round(progress));
            loader.style.setProperty('--lp', progress.toFixed(2));
            pctEl.textContent = `${shown}%`;
            for (let i = messages.length - 1; i >= 0; i--) {
                if (shown >= messages[i][0]) {
                    if (lastMsg !== i) { lastMsg = i; txtEl.textContent = messages[i][1]; }
                    break;
                }
            }
            if (ready && elapsed >= minTime && progress > 99.4) {
                loader.style.setProperty('--lp', 100);
                pctEl.textContent = '100%';
                stop();
                window.setTimeout(end, 220);
            }
        });
    }

    /* ───────────── 03 · TEXTO DIVIDIDO Y REVEAL ───────────── */
    function splitText(el) {
        if (el.classList.contains('is-split')) return;
        el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
        let idx = 0;
        const walk = (node) => {
            Array.from(node.childNodes).forEach((n) => {
                if (n.nodeType === Node.TEXT_NODE) {
                    const frag = document.createDocumentFragment();
                    n.textContent.split(/(\s+)/).forEach((part) => {
                        if (!part) return;
                        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
                        const w = document.createElement('span');
                        w.className = 'w';
                        w.setAttribute('aria-hidden', 'true');
                        const wi = document.createElement('span');
                        wi.className = 'wi';
                        wi.style.setProperty('--wi', idx++);
                        wi.textContent = part;
                        w.appendChild(wi);
                        frag.appendChild(w);
                    });
                    n.replaceWith(frag);
                } else if (n.nodeType === Node.ELEMENT_NODE && n.tagName !== 'BR') {
                    walk(n);
                }
            });
        };
        walk(el);
        el.classList.add('is-split');
    }

    function initReveal() {
        const heroTitle = $('.hero__title');
        if (heroTitle) {
            splitText(heroTitle);
            document.addEventListener('jm:ready', () => heroTitle.classList.add('is-in'), { once: true });
        }
        const targets = $$('[data-reveal], [data-split]');
        targets.forEach((el) => { if (el.hasAttribute('data-split')) splitText(el); });
        if (reduceMotion) { targets.forEach((el) => el.classList.add('is-in')); return; }

        /* Las tarjetas de carruseles horizontales se revelan junto con su contenedor
           (si no, las que asoman por el borde quedarían invisibles hasta deslizarlas). */
        const carousel = '[data-stories], [data-reels]';
        const free = targets.filter((el) => !el.closest(carousel));
        const hosts = $$(carousel);
        once(free, (el) => el.classList.add('is-in'), { threshold: .14, rootMargin: '0px 0px -7% 0px' });
        once(hosts, (host) => $$('[data-reveal]', host).forEach((el) => el.classList.add('is-in')), { threshold: .12, rootMargin: '0px 0px -7% 0px' });
    }

    /* ───────────── 04 · HEADER, PROGRESO, SCROLLSPY, MENÚ ───────────── */
    function initHeader() {
        const header = $('.site-header');
        const bar = $('.progress span');
        const nav = $('.nav');
        const links = $$('.nav__link');
        const menu = $('#menu');
        const burger = $('#burger');
        if (!header) return;

        /* Scroll: estado, ocultar al bajar, progreso */
        let lastY = window.scrollY;
        onScroll((s) => {
            const y = s.y;
            const max = document.documentElement.scrollHeight - window.innerHeight;
            if (bar) bar.style.setProperty('--p', max > 0 ? clamp(y / max, 0, 1).toFixed(4) : 0);
            header.classList.toggle('is-scrolled', y > 24);
            const delta = y - lastY;
            if (!document.body.classList.contains('menu-open')) {
                if (y > 520 && delta > 6) header.classList.add('is-hidden');
                else if (delta < -6 || y < 520) header.classList.remove('is-hidden');
            }
            lastY = y;
        });
        header.addEventListener('focusin', () => header.classList.remove('is-hidden'));

        /* Pastilla deslizante de la navegación */
        const groups = {
            '#servicios': ['#servicios'],
            '#resultados': ['#resultados', '#en-accion'],
            '#proceso': ['#proceso'],
            '#precios': ['#precios'],
            '#faq': ['#faq'],
            '#contacto': ['#contacto'],
        };
        let activeLink = null;
        const movePill = (link) => {
            if (!nav || !link) { nav && nav.style.setProperty('--o', 0); return; }
            nav.style.setProperty('--x', `${link.offsetLeft}px`);
            nav.style.setProperty('--w', `${link.offsetWidth}px`);
            nav.style.setProperty('--o', 1);
        };
        links.forEach((l) => {
            l.addEventListener('pointerenter', () => movePill(l));
            l.addEventListener('focus', () => movePill(l));
        });
        if (nav) nav.addEventListener('pointerleave', () => movePill(activeLink));

        /* Scrollspy */
        let zones = [];
        const measure = () => {
            zones = links.map((link) => {
                const ids = groups[link.getAttribute('href')] || [];
                const els = ids.map((id) => $(id)).filter(Boolean);
                return { link, els };
            });
        };
        const spy = () => {
            const mid = window.scrollY + window.innerHeight * .4;
            let found = null;
            zones.forEach(({ link, els }) => {
                els.forEach((el) => {
                    const top = el.offsetTop;
                    if (mid >= top && mid < top + el.offsetHeight) found = link;
                });
            });
            if (found !== activeLink) {
                activeLink = found;
                links.forEach((l) => l.classList.toggle('is-active', l === found));
                movePill(found);
            }
        };
        measure();
        onScroll(spy);
        window.addEventListener('resize', () => { measure(); spy(); }, { passive: true });
        window.addEventListener('load', () => { measure(); spy(); });

        /* Menú móvil */
        if (!menu || !burger) return;
        const setMenu = (open) => {
            menu.classList.toggle('is-open', open);
            menu.inert = !open;
            document.body.classList.toggle('menu-open', open);
            burger.setAttribute('aria-expanded', String(open));
            burger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
            if (open) {
                header.classList.remove('is-hidden');
                window.setTimeout(() => { const first = $('.menu__link', menu); if (first) first.focus({ preventScroll: true }); }, 450);
            }
        };
        burger.addEventListener('click', () => setMenu(!menu.classList.contains('is-open')));
        $$('a', menu).forEach((a) => a.addEventListener('click', () => setMenu(false)));
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && menu.classList.contains('is-open')) { setMenu(false); burger.focus(); }
        });
        window.matchMedia('(min-width: 1024px)').addEventListener('change', (e) => { if (e.matches) setMenu(false); });
    }

    /* ───────────── 05 · HERO ───────────── */
    function initHero() {
        const hero = $('.hero');
        if (!hero) return;
        const spot = $('.hero__spot', hero);
        const bg = $('.hero__bg', hero);
        const inner = $('.hero__inner', hero);
        const depthEls = $$('[data-depth]', hero);
        const mouse = { x: 0, y: 0, tx: 0, ty: 0 };

        if (finePointer && !reduceMotion) {
            hero.addEventListener('pointermove', (e) => {
                if (e.pointerType !== 'mouse') return;
                const r = hero.getBoundingClientRect();
                mouse.tx = ((e.clientX - r.left) / r.width - .5) * 2;
                mouse.ty = ((e.clientY - r.top) / r.height - .5) * 2;
                if (spot) {
                    spot.style.setProperty('--mx', `${e.clientX - r.left}px`);
                    spot.style.setProperty('--my', `${e.clientY - r.top}px`);
                }
            }, { passive: true });
            hero.addEventListener('pointerleave', () => { mouse.tx = 0; mouse.ty = 0; });
            ticker.add(() => {
                mouse.x = lerp(mouse.x, mouse.tx, .06);
                mouse.y = lerp(mouse.y, mouse.ty, .06);
                depthEls.forEach((el) => {
                    const d = parseFloat(el.dataset.depth) || 10;
                    el.style.translate = `${(mouse.x * d).toFixed(2)}px ${(mouse.y * d).toFixed(2)}px`;
                });
            });
        }

        /* Al bajar (solo escritorio): el hero se desvanece y el fondo se mueve más lento.
           En móvil el hero es una columna larga, así que no se toca. */
        if (!reduceMotion) {
            const desktop = window.matchMedia('(min-width: 1024px)');
            onScroll((s) => {
                const vh = window.innerHeight;
                if (!desktop.matches) {
                    if (inner && inner.style.opacity) { inner.style.opacity = ''; inner.style.translate = ''; }
                    if (bg && bg.style.translate) bg.style.translate = '';
                    return;
                }
                if (s.y > vh * 1.2) return;
                const p = clamp(s.y / (vh * .9), 0, 1);
                if (bg) bg.style.translate = `0 ${(s.y * .22).toFixed(1)}px`;
                if (inner) {
                    inner.style.opacity = (1 - p * .85).toFixed(3);
                    inner.style.translate = `0 ${(s.y * .1).toFixed(1)}px`;
                }
            });
        }
    }

    function initRotator() {
        const el = $('[data-rotator]');
        if (!el) return;
        const words = $$('.rotator__word', el);
        let i = 0;
        const setWidth = () => {
            const active = words[i];
            if (active) el.style.setProperty('--rw', `${Math.ceil(active.getBoundingClientRect().width) + 2}px`);
        };
        setWidth();
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(setWidth);
        window.addEventListener('resize', setWidth, { passive: true });
        if (reduceMotion) return;
        window.setInterval(() => {
            if (document.hidden) return;
            const leaving = words[i];
            i = (i + 1) % words.length;
            const next = words[i];
            leaving.classList.remove('is-active');
            leaving.classList.add('is-leaving');
            leaving.setAttribute('aria-hidden', 'true');
            next.classList.add('is-active');
            next.removeAttribute('aria-hidden');
            el.style.setProperty('--rw', `${Math.ceil(next.getBoundingClientRect().width) + 2}px`);
            window.setTimeout(() => leaving.classList.remove('is-leaving'), 900);
        }, 2600);
    }

    /* ───────────── 06 · BURBUJAS ───────────── */
    function initBubbles() {
        const cv = $('#bubbles');
        const hero = $('.hero');
        if (!cv || !hero || reduceMotion) return;
        const ctx = cv.getContext('2d');
        if (!ctx) return;

        const HUES = [205, 215, 195, 185, 160, 45, 330];
        const rnd = (a, b) => a + Math.random() * (b - a);
        let w = 0;
        let h = 0;
        let dpr = 1;
        let bubbles = [];
        let pops = [];
        let visible = true;
        const mouse = { x: -999, y: -999 };

        const make = (initial) => {
            const small = w < 700;
            const r = rnd(6, 46) * (small ? .72 : 1);
            return {
                x: rnd(0, w), y: initial ? rnd(0, h) : h + r + rnd(10, 220), r,
                vy: rnd(.22, .62) * (r > 30 ? .8 : 1), vx: 0,
                wob: rnd(0, TAU), wobSpeed: rnd(.006, .016), drift: rnd(.15, .45),
                hue: HUES[Math.floor(Math.random() * HUES.length)],
            };
        };
        const resize = () => {
            const rect = hero.getBoundingClientRect();
            w = rect.width; h = rect.height;
            dpr = Math.min(window.devicePixelRatio || 1, w < 700 ? 1.5 : 2);
            cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            const n = clamp(Math.round(w / 40), 14, 34);
            while (bubbles.length < n) bubbles.push(make(true));
            bubbles.length = Math.min(bubbles.length, n);
        };

        const drawBubble = (b) => {
            const { x, y, r } = b;
            const g = ctx.createRadialGradient(x - r * .25, y - r * .3, r * .1, x, y, r);
            g.addColorStop(0, `hsla(${b.hue}, 90%, 85%, .10)`);
            g.addColorStop(.65, `hsla(${b.hue}, 90%, 70%, .10)`);
            g.addColorStop(.9, `hsla(${b.hue + 28}, 95%, 62%, .26)`);
            g.addColorStop(1, `hsla(${b.hue - 40}, 95%, 66%, .55)`);
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
            ctx.lineWidth = 1.1; ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.stroke();
            ctx.beginPath(); ctx.arc(x, y, r * .8, .1 * Math.PI, .62 * Math.PI);
            ctx.lineWidth = Math.max(1, r * .08); ctx.strokeStyle = `hsla(${b.hue + 70}, 95%, 60%, .38)`; ctx.stroke();
            ctx.beginPath(); ctx.arc(x, y, r * .8, 1.1 * Math.PI, 1.55 * Math.PI);
            ctx.strokeStyle = `hsla(${b.hue - 60}, 95%, 62%, .26)`; ctx.stroke();
            ctx.beginPath(); ctx.ellipse(x - r * .38, y - r * .42, r * .24, r * .12, -.6, 0, TAU);
            ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.fill();
            ctx.beginPath(); ctx.arc(x + r * .4, y + r * .42, Math.max(1, r * .07), 0, TAU);
            ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fill();
        };

        const pop = (b) => {
            const parts = Array.from({ length: 9 }, (_, i) => {
                const a = (i / 9) * TAU + rnd(-.2, .2);
                return { x: b.x, y: b.y, vx: Math.cos(a) * rnd(1.4, 3), vy: Math.sin(a) * rnd(1.4, 3), life: 1, r: rnd(1.4, 3.2) };
            });
            pops.push({ x: b.x, y: b.y, r: b.r, hue: b.hue, t: 0, parts });
        };

        const step = (_t, dt) => {
            if (!visible || document.hidden) return;
            const k = dt / 16.67;
            ctx.clearRect(0, 0, w, h);
            bubbles.forEach((b, i) => {
                b.wob += b.wobSpeed * k;
                b.x += Math.sin(b.wob) * b.drift * k + b.vx * k;
                b.y -= b.vy * k;
                b.vx *= Math.pow(.94, k);
                const dx = b.x - mouse.x;
                const dy = b.y - mouse.y;
                const dist = Math.hypot(dx, dy);
                const reach = b.r + 120;
                if (dist < reach && dist > .1) {
                    const f = (1 - dist / reach) * .9 * k;
                    b.vx += (dx / dist) * f;
                    b.y += (dy / dist) * f * 1.6;
                }
                if (b.y < -b.r * 2) bubbles[i] = make(false);
                if (b.x < -b.r * 2) b.x = w + b.r; else if (b.x > w + b.r * 2) b.x = -b.r;
                drawBubble(b);
            });
            pops = pops.filter((p) => p.t < 1);
            pops.forEach((p) => {
                p.t += .035 * k;
                const e = 1 - Math.pow(1 - p.t, 3);
                ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1 + e * .6), 0, TAU);
                ctx.lineWidth = 2 * (1 - p.t); ctx.strokeStyle = `hsla(${p.hue}, 95%, 62%, ${.7 * (1 - p.t)})`; ctx.stroke();
                p.parts.forEach((q) => {
                    q.x += q.vx * k; q.y += q.vy * k; q.vy += .05 * k;
                    ctx.beginPath(); ctx.arc(q.x, q.y, q.r * (1 - p.t), 0, TAU);
                    ctx.fillStyle = `hsla(${p.hue}, 95%, 70%, ${.9 * (1 - p.t)})`; ctx.fill();
                });
            });
        };

        hero.addEventListener('pointermove', (e) => {
            const r = hero.getBoundingClientRect();
            mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
        }, { passive: true });
        hero.addEventListener('pointerleave', () => { mouse.x = -999; mouse.y = -999; });
        hero.addEventListener('pointerdown', (e) => {
            if (e.target.closest('a, button, input, .compare, .chip, .seal')) return;
            const r = hero.getBoundingClientRect();
            const px = e.clientX - r.left;
            const py = e.clientY - r.top;
            let hit = -1;
            let best = Infinity;
            bubbles.forEach((b, i) => {
                const d = Math.hypot(b.x - px, b.y - py);
                if (d < b.r + 10 && d < best) { best = d; hit = i; }
            });
            if (hit > -1) { pop(bubbles[hit]); bubbles[hit] = make(false); }
        });

        resize();
        new ResizeObserver(resize).observe(hero);
        new IntersectionObserver((entries) => { visible = entries[0].isIntersecting; }, { threshold: 0 }).observe(hero);
        ticker.add(step);
    }

    /** Burbujas CSS (CTA final). */
    function initCtaBubbles() {
        const host = $('[data-cta-bubbles]');
        if (!host || reduceMotion) return;
        const n = window.innerWidth < 700 ? 9 : 16;
        for (let i = 0; i < n; i++) {
            const b = document.createElement('i');
            b.className = 'cb';
            b.style.setProperty('--x', `${Math.round(Math.random() * 96)}%`);
            b.style.setProperty('--s', `${Math.round(14 + Math.random() * 54)}px`);
            b.style.setProperty('--t', `${(7 + Math.random() * 9).toFixed(1)}s`);
            b.style.setProperty('--dl', `${(-Math.random() * 14).toFixed(1)}s`);
            host.appendChild(b);
        }
    }

    /* ───────────── 07 · COMPARADOR ANTES / DESPUÉS ───────────── */
    class Compare {
        constructor(el) {
            this.el = el;
            this.stage = $('.compare__stage', el);
            this.handle = $('.compare__handle', el);
            this.pos = 50;
            this.target = 50;
            this.dragging = false;
            this.auto = el.hasAttribute('data-autoplay') && !reduceMotion;
            this.visible = false;
            this.t0 = 0;
            this.bind();
            this.render();
            ticker.add((t) => this.tick(t));
        }

        render() {
            const p = clamp(this.pos, 0, 100);
            this.el.style.setProperty('--pos', `${p.toFixed(2)}%`);
            this.handle.setAttribute('aria-valuenow', Math.round(p));
            const edge = p < 12 ? 'left' : p > 88 ? 'right' : '';
            if (this.el.dataset.edge !== edge) this.el.dataset.edge = edge;
        }

        goTo(v, instant = false) {
            this.target = clamp(v, 0, 100);
            if (instant) { this.pos = this.target; this.render(); }
        }

        stopAuto() { this.auto = false; }

        tick(t) {
            if (!this.visible && !this.dragging) return;
            if (this.auto) {
                if (!this.t0) this.t0 = t;
                const s = (t - this.t0) / 1700;
                this.target = 50 + Math.sin(s) * 38;
                this.pos = lerp(this.pos, this.target, .12);
                this.render();
                return;
            }
            if (Math.abs(this.pos - this.target) > .03) {
                this.pos = lerp(this.pos, this.target, this.dragging ? .45 : .14);
                this.render();
            }
        }

        fromEvent(e) {
            const r = this.stage.getBoundingClientRect();
            return ((e.clientX - r.left) / r.width) * 100;
        }

        bind() {
            const end = () => {
                this.dragging = false;
                this.el.classList.remove('is-dragging');
            };
            this.stage.addEventListener('pointerdown', (e) => {
                if (e.pointerType === 'mouse' && e.button !== 0) return;
                this.dragging = true;
                this.stopAuto();
                this.el.classList.add('is-dragging');
                try { this.stage.setPointerCapture(e.pointerId); } catch (_) { /* noop */ }
                this.target = clamp(this.fromEvent(e), 0, 100);
            });
            this.stage.addEventListener('pointermove', (e) => {
                if (this.dragging) this.target = clamp(this.fromEvent(e), 0, 100);
            });
            this.stage.addEventListener('pointerup', end);
            this.stage.addEventListener('pointercancel', end);
            this.stage.addEventListener('lostpointercapture', end);
            this.handle.addEventListener('keydown', (e) => {
                const step = e.shiftKey ? 10 : 3;
                let v = null;
                if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') v = this.target - step;
                else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') v = this.target + step;
                else if (e.key === 'Home') v = 0;
                else if (e.key === 'End') v = 100;
                if (v === null) return;
                e.preventDefault();
                this.stopAuto();
                this.goTo(v);
            });
            new IntersectionObserver((entries) => { this.visible = entries[0].isIntersecting; }, { threshold: .25 }).observe(this.el);
            if (!this.auto) return;
            this.pos = this.target = 50;
        }
    }

    function initCompares() {
        $$('.compare--hero').forEach((el) => { new Compare(el); });

        const rootEl = $('[data-cases]');
        if (!rootEl) return;
        const cmpEl = $('#cases-compare', rootEl);
        const cmp = new Compare(cmpEl);
        const imgBefore = $('.compare__img--before', cmpEl);
        const imgAfter = $('.compare__img--after', cmpEl);
        const viewport = $('.cases__viewport', rootEl);
        const thumbs = $$('[data-case]', rootEl);
        const nameEl = $('[data-cases-name]', rootEl);
        const typeEl = $('[data-cases-type]', rootEl);
        const idxEl = $('[data-cases-index]', rootEl);
        const totalEl = $('[data-cases-total]', rootEl);
        const strip = $('.cases__thumbs', rootEl);
        const cache = new Map();
        let index = 0;
        let token = 0;
        const pad = (n) => String(n).padStart(2, '0');
        if (totalEl) totalEl.textContent = pad(thumbs.length);

        const preload = (src) => {
            if (cache.has(src)) return cache.get(src);
            const p = new Promise((res) => { const im = new Image(); im.onload = res; im.onerror = res; im.src = src; });
            cache.set(src, p);
            return p;
        };
        const setBackdrop = (src) => viewport.style.setProperty('--bg-img', `url("${src}")`);
        setBackdrop(imgAfter.getAttribute('src'));

        const show = (i, first = false) => {
            index = (i + thumbs.length) % thumbs.length;
            const t = thumbs[index];
            const d = t.dataset;
            const my = ++token;
            thumbs.forEach((b, k) => { b.classList.toggle('is-active', k === index); b.setAttribute('aria-pressed', String(k === index)); });
            nameEl.textContent = d.name; typeEl.textContent = d.type; idxEl.textContent = pad(index + 1);
            rootEl.dataset.orient = parseFloat(d.ar) >= 1 ? 'landscape' : 'portrait';
            if (strip && strip.scrollWidth > strip.clientWidth + 4 && strip.clientWidth > 0 && window.innerWidth < 1024) {
                strip.scrollTo({ left: t.offsetLeft - strip.clientWidth / 2 + t.offsetWidth / 2, behavior: 'smooth' });
            }
            if (first) return;
            cmpEl.classList.add('is-switching');
            Promise.all([preload(d.before), preload(d.after), new Promise((r) => setTimeout(r, 260))]).then(() => {
                if (my !== token) return;
                imgBefore.src = d.before; imgBefore.alt = d.altBefore;
                imgAfter.src = d.after; imgAfter.alt = d.altAfter;
                cmpEl.style.setProperty('--ar', d.ar);
                setBackdrop(d.after);
                cmp.stopAuto();
                cmp.goTo(96, true);
                cmpEl.classList.remove('is-switching');
                window.setTimeout(() => cmp.goTo(50), 220);
            });
        };
        thumbs.forEach((b, i) => {
            b.setAttribute('aria-pressed', String(i === 0));
            b.addEventListener('click', () => show(i));
        });
        $('[data-cases-prev]', rootEl).addEventListener('click', () => show(index - 1));
        $('[data-cases-next]', rootEl).addEventListener('click', () => show(index + 1));
        show(0, true);
        once([rootEl], () => thumbs.slice(1, 3).forEach((b) => { preload(b.dataset.before); preload(b.dataset.after); }), { threshold: .05, rootMargin: '300px' });
    }

    /* ───────────── 08 · CONTADORES ───────────── */
    function initCounters() {
        const els = $$('[data-count]');
        const fmt = new Intl.NumberFormat('es-MX');
        const run = (el) => {
            const target = parseFloat(el.dataset.count);
            const from = target === 0 ? 40 : 0;
            if (reduceMotion) { el.textContent = fmt.format(target); return; }
            const dur = 1700;
            const t0 = performance.now();
            const frame = (now) => {
                const p = clamp((now - t0) / dur, 0, 1);
                const e = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
                el.textContent = fmt.format(Math.round(lerp(from, target, e)));
                if (p < 1) requestAnimationFrame(frame);
            };
            requestAnimationFrame(frame);
        };
        if (reduceMotion) return; // se quedan los valores finales del HTML
        els.forEach((el) => { el.textContent = el.dataset.count === '0' ? '40' : '0'; });
        once(els, run, { threshold: .6 });
    }

    /* ───────────── 09 · MARQUEE ───────────── */
    function initMarquee() {
        const rows = $$('[data-marquee]');
        if (!rows.length) return;
        rows.forEach((row) => {
            const track = $('.marquee__track', row);
            const dir = parseFloat(row.dataset.marquee) || 1;
            const base = track.innerHTML;
            const build = () => {
                track.innerHTML = base;
                const baseW = track.scrollWidth;
                let guard = 0;
                while (track.scrollWidth < row.clientWidth * 2 + baseW && guard++ < 8) track.insertAdjacentHTML('beforeend', base);
                return baseW;
            };
            let baseW = build();
            let x = dir > 0 ? 0 : -baseW;
            let visible = false;
            new IntersectionObserver((e) => { visible = e[0].isIntersecting; }, { threshold: 0 }).observe(row);
            let rt;
            window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { baseW = build(); }, 200); }, { passive: true });
            if (reduceMotion) return;
            ticker.add((_t, dt) => {
                if (!visible) return;
                const boost = clamp(Math.abs(scrollState.vel), 0, 70) * .32;
                const move = (46 * dt) / 1000 + boost;
                x -= dir * move;
                if (x <= -baseW) x += baseW;
                if (x > 0) x -= baseW;
                track.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`;
            });
        });
    }

    /* ───────────── 10 · PROCESO ───────────── */
    function initProcess() {
        const list = $('[data-steps]');
        if (!list) return;
        const steps = $$('[data-step]', list);
        const dial = $('.process__dial');
        const num = $('[data-process-num]');
        let activeIdx = -1;
        onScroll(() => {
            const vh = window.innerHeight;
            const mid = vh * .5;
            const rects = steps.map((s) => s.getBoundingClientRect());
            if (rects[0].top > vh || rects[rects.length - 1].bottom < 0) return;
            const c = rects.map((r) => r.top + 28);
            const p = clamp((mid - c[0]) / (c[c.length - 1] - c[0]), 0, 1);
            list.style.setProperty('--sp', p.toFixed(4));
            let idx = 0;
            let best = Infinity;
            rects.forEach((r, i) => {
                const d = Math.abs(r.top + r.height / 2 - mid);
                if (d < best) { best = d; idx = i; }
            });
            if (rects[0].top > mid) idx = 0;
            if (idx !== activeIdx) {
                activeIdx = idx;
                steps.forEach((s, i) => {
                    s.classList.toggle('is-active', i === idx);
                    s.classList.toggle('is-past', i < idx);
                });
                if (num) num.textContent = String(idx + 1).padStart(2, '0');
                if (dial) dial.style.setProperty('--dp', ((idx + 1) / steps.length) * 100);
            }
        });
    }

    /* ───────────── 11 · HISTORIAS ───────────── */
    function initStories() {
        const wrap = $('[data-stories]');
        if (!wrap) return;
        const track = $('[data-stories-track]', wrap);
        const cards = $$('[data-story]', wrap);
        const bar = $('[data-stories-bar]');
        const timers = new WeakMap();

        const play = (card, delay = 0) => {
            if (reduceMotion) return;
            window.clearTimeout(timers.get(card));
            card.classList.remove('is-clean', 'is-dirty');
            void card.offsetWidth;
            const start = window.setTimeout(() => {
                card.classList.add('is-dirty');
                timers.set(card, window.setTimeout(() => {
                    card.classList.remove('is-dirty');
                    card.classList.add('is-clean');
                }, 1500));
            }, delay);
            timers.set(card, start);
        };
        once(cards, (card) => play(card, (cards.indexOf(card) % 3) * 220), { threshold: .6 });
        cards.forEach((card) => {
            const again = () => { if (!card.classList.contains('is-dirty')) play(card, 40); };
            card.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') again(); });
            card.addEventListener('click', again);
            card.addEventListener('focus', again);
        });

        /* Barra de progreso del carrusel */
        const updateBar = () => {
            if (!bar) return;
            const max = track.scrollWidth - track.clientWidth;
            const vis = track.scrollWidth ? (track.clientWidth / track.scrollWidth) * 100 : 100;
            const ratio = max > 0 ? track.scrollLeft / max : 0;
            bar.style.width = `${vis}%`;
            bar.style.setProperty('--bx', `${((ratio * (100 - vis)) / vis) * 100}%`);
        };
        track.addEventListener('scroll', updateBar, { passive: true });
        window.addEventListener('resize', updateBar, { passive: true });
        updateBar();

        /* Arrastrar con mouse */
        if (!finePointer) return;
        let down = false;
        let startX = 0;
        let startLeft = 0;
        let moved = 0;
        track.addEventListener('pointerdown', (e) => {
            if (e.pointerType !== 'mouse' || e.button !== 0) return;
            down = true; moved = 0; startX = e.clientX; startLeft = track.scrollLeft;
        });
        window.addEventListener('pointermove', (e) => {
            if (!down) return;
            const dx = e.clientX - startX;
            moved = Math.max(moved, Math.abs(dx));
            if (moved > 4) { track.classList.add('is-grabbing'); track.scrollLeft = startLeft - dx; }
        });
        window.addEventListener('pointerup', () => {
            if (!down) return;
            down = false;
            track.classList.remove('is-grabbing');
        });
        track.addEventListener('click', (e) => { if (moved > 5) { e.stopPropagation(); e.preventDefault(); } }, true);
    }

    /* ───────────── 12 · VIDEOS ───────────── */
    function initReels() {
        const reels = $$('.reel');
        if (!reels.length) return;
        reels.forEach((reel) => {
            const video = $('video', reel);
            const btn = $('.reel__toggle', reel);
            const sync = () => reel.classList.toggle('is-playing', !video.paused && !video.ended);
            video.addEventListener('play', sync);
            video.addEventListener('pause', sync);
            const start = () => {
                if (reduceMotion || video.dataset.userPaused) return;
                const p = video.play();
                if (p && p.catch) p.catch(() => {});
            };
            btn.addEventListener('click', () => {
                if (video.paused) { delete video.dataset.userPaused; const p = video.play(); if (p && p.catch) p.catch(() => {}); }
                else { video.dataset.userPaused = '1'; video.pause(); }
            });
            new IntersectionObserver((entries) => {
                entries.forEach((e) => {
                    if (e.isIntersecting && e.intersectionRatio >= .55) start();
                    else video.pause();
                });
            }, { threshold: [0, .55, 1] }).observe(reel);
        });
    }

    /* ───────────── 13 · ACORDEÓN ───────────── */
    function initAccordion() {
        const items = $$('.acc');
        items.forEach((item) => {
            const btn = $('.acc__btn', item);
            const panel = $('.acc__panel', item);
            panel.inert = true;
            btn.addEventListener('click', () => {
                const open = btn.getAttribute('aria-expanded') !== 'true';
                items.forEach((o) => {
                    const b = $('.acc__btn', o);
                    const p = $('.acc__panel', o);
                    const isThis = o === item;
                    b.setAttribute('aria-expanded', String(isThis && open));
                    o.classList.toggle('is-open', isThis && open);
                    p.inert = !(isThis && open);
                });
            });
        });
        if (items[0]) { // la primera pregunta abierta por defecto
            $('.acc__btn', items[0]).setAttribute('aria-expanded', 'true');
            items[0].classList.add('is-open');
            $('.acc__panel', items[0]).inert = false;
        }
    }

    /* ───────────── 14 · FORMULARIO Y HORARIOS ───────────── */
    function initForm() {
        const form = $('#quote-form');
        if (!form) return;
        const ok = $('[data-form-ok]', form);
        const link = $('[data-form-link]', form);
        const fields = {
            nombre: form.elements.nombre, servicio: form.elements.servicio, zona: form.elements.zona,
            telefono: form.elements.telefono, mensaje: form.elements.mensaje,
        };
        const rules = {
            nombre: (v) => (v.trim().length >= 2 ? '' : 'Escribe tu nombre para saber cómo llamarte.'),
            servicio: (v) => (v ? '' : 'Elige el servicio que te interesa.'),
            zona: (v) => (v.trim().length >= 2 ? '' : 'Dinos tu alcaldía o municipio.'),
            telefono: (v) => { const d = v.replace(/\D/g, ''); return !v.trim() || (d.length >= 8 && d.length <= 15) ? '' : 'Revisa tu teléfono (8 a 15 dígitos).'; },
        };
        const check = (name) => {
            const input = fields[name];
            const wrap = input.closest('.field');
            const msg = rules[name] ? rules[name](input.value) : '';
            wrap.classList.toggle('is-invalid', Boolean(msg));
            input.setAttribute('aria-invalid', msg ? 'true' : 'false');
            const err = $('.field__err', wrap);
            if (err) err.textContent = msg;
            return !msg;
        };
        let touched = false;
        Object.keys(rules).forEach((name) => {
            fields[name].addEventListener('blur', () => { if (fields[name].value || touched) check(name); });
            fields[name].addEventListener('input', () => { if (touched) check(name); });
            fields[name].addEventListener('change', () => { if (touched) check(name); });
        });

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            touched = true;
            const valid = Object.keys(rules).map(check).every(Boolean);
            if (!valid) {
                const bad = $('.field.is-invalid input, .field.is-invalid select', form);
                if (bad) bad.focus();
                return;
            }
            const lines = [
                `Hola, soy ${fields.nombre.value.trim()}. Quiero cotizar: ${fields.servicio.value}.`,
                `Zona: ${fields.zona.value.trim()}`,
            ];
            if (fields.telefono.value.trim()) lines.push(`Teléfono: ${fields.telefono.value.trim()}`);
            if (fields.mensaje.value.trim()) lines.push(`Detalles: ${fields.mensaje.value.trim()}`);
            lines.push('(Mensaje enviado desde la página web)');
            const url = waLink(lines.join('\n'));
            link.href = url;
            ok.hidden = false;
            window.open(url, '_blank', 'noopener');
        });
        $('[data-form-reset]', form).addEventListener('click', () => {
            form.reset();
            touched = false;
            $$('.field', form).forEach((f) => f.classList.remove('is-invalid'));
            $$('.field__err', form).forEach((n) => { n.textContent = ''; });
            ok.hidden = true;
            fields.nombre.focus();
        });
    }

    function initHours() {
        const box = $('[data-hours]');
        const year = $('[data-year]');
        if (year) year.textContent = new Date().getFullYear();
        if (!box) return;
        const status = $('[data-hours-status]', box);
        const label = $('b', status);
        const compute = () => {
            let day = 0;
            let mins = 0;
            try {
                const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Mexico_City', weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(new Date());
                const get = (t) => parts.find((p) => p.type === t).value;
                day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
                mins = (parseInt(get('hour'), 10) % 24) * 60 + parseInt(get('minute'), 10);
            } catch (_) {
                const d = new Date(); day = d.getDay(); mins = d.getHours() * 60 + d.getMinutes();
            }
            const weekend = day === 0 || day === 6;
            const closeAt = weekend ? 14 * 60 : 17 * 60;
            const open = mins >= 9 * 60 && mins < closeAt;
            $$('li[data-days]', box).forEach((li) => li.classList.toggle('is-today', li.dataset.days.split(',').map(Number).includes(day)));
            status.classList.toggle('is-open', open);
            status.classList.toggle('is-closed', !open);
            label.textContent = open
                ? `Servicio abierto · hasta las ${weekend ? '2:00' : '5:00'} p. m.`
                : 'Fuera de horario · escríbenos, atendemos 24 h';
        };
        compute();
        window.setInterval(compute, 60000);
    }

    /* ───────────── 15 · EFECTOS ───────────── */
    function initEffects() {
        /* Spotlight en tarjetas */
        $$('[data-spot]').forEach((el) => {
            el.addEventListener('pointermove', (e) => {
                const r = el.getBoundingClientRect();
                el.style.setProperty('--sx', `${e.clientX - r.left}px`);
                el.style.setProperty('--sy', `${e.clientY - r.top}px`);
            }, { passive: true });
        });
        if (!finePointer || reduceMotion) return;

        /* Tilt 3D */
        $$('[data-tilt]').forEach((el) => {
            const max = el.classList.contains('stage') ? 6 : el.classList.contains('swatch') ? 9 : 4.5;
            let raf = 0;
            el.addEventListener('pointermove', (e) => {
                if (e.pointerType !== 'mouse') return;
                const r = el.getBoundingClientRect();
                const px = (e.clientX - r.left) / r.width - .5;
                const py = (e.clientY - r.top) / r.height - .5;
                cancelAnimationFrame(raf);
                raf = requestAnimationFrame(() => {
                    el.style.setProperty('--ry', `${(px * max * 2).toFixed(2)}deg`);
                    el.style.setProperty('--rx', `${(-py * max * 2).toFixed(2)}deg`);
                });
            });
            el.addEventListener('pointerleave', () => {
                cancelAnimationFrame(raf);
                el.style.setProperty('--rx', '0deg');
                el.style.setProperty('--ry', '0deg');
            });
        });

        /* Botones magnéticos */
        $$('[data-magnetic]').forEach((el) => {
            const pull = 0.28;
            el.addEventListener('pointermove', (e) => {
                if (e.pointerType !== 'mouse') return;
                const r = el.getBoundingClientRect();
                const x = (e.clientX - (r.left + r.width / 2)) * pull;
                const y = (e.clientY - (r.top + r.height / 2)) * pull;
                el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
            });
            el.addEventListener('pointerleave', () => { el.style.transform = ''; });
        });

        /* Cursor suave */
        const cursor = $('.cursor');
        if (!cursor) return;
        let x = 0;
        let y = 0;
        let tx = 0;
        let ty = 0;
        let shown = false;
        window.addEventListener('pointermove', (e) => {
            if (e.pointerType !== 'mouse') return;
            tx = e.clientX; ty = e.clientY;
            if (!shown) { x = tx; y = ty; shown = true; cursor.classList.add('is-visible'); }
            const t = e.target;
            cursor.classList.toggle('is-hover', Boolean(t.closest && t.closest('a, button, [role="slider"], label, select, input, textarea, .thumb')));
            cursor.classList.toggle('is-drag', Boolean(t.closest && t.closest('.compare__stage, .stories__track')));
        }, { passive: true });
        document.addEventListener('mouseleave', () => { shown = false; cursor.classList.remove('is-visible'); });
        ticker.add(() => {
            x = lerp(x, tx, .2); y = lerp(y, ty, .2);
            cursor.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
        });
    }

    /* ───────────── 16 · FLOTANTE WHATSAPP ───────────── */
    function initWaFloat() {
        const box = $('[data-wa-float]');
        if (!box) return;
        const close = $('[data-wa-close]', box);
        let seen = false;
        try { seen = sessionStorage.getItem('jm-wa-tip') === '1'; } catch (_) { /* noop */ }
        const hide = () => {
            box.classList.remove('is-tip');
            try { sessionStorage.setItem('jm-wa-tip', '1'); } catch (_) { /* noop */ }
        };
        close.addEventListener('click', hide);
        if (seen) return;
        document.addEventListener('jm:ready', () => {
            window.setTimeout(() => {
                box.classList.add('is-tip');
                window.setTimeout(hide, 9000);
            }, 5000);
        }, { once: true });
    }

    /* ───────────── ARRANQUE ───────────── */
    const modules = [
        initReveal, initHeader, initHero, initRotator, initBubbles, initCtaBubbles, initCompares, initCounters,
        initMarquee, initProcess, initStories, initReels, initAccordion, initForm, initHours, initEffects, initWaFloat,
    ];
    const boot = () => {
        modules.forEach((fn) => {
            try { fn(); } catch (err) { console.error(`[JM] módulo "${fn.name}" falló:`, err); }
        });
        initLoader();
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
