// Reference mock for louislawson.co.uk, direction C3 'Trace'. Mock-only: not production code.
// In the real build, sections render at build time; only the trace, wheel, nav keys and inspect mode need JavaScript.

// Sections, garage wheel, number-key nav and inspect mode.
(() => {
  const M = window.MOCK;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const arrow = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6"/></svg>';
  const ext = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8"/></svg>';
  const statusLabel = { 'in-service': 'in service', commissioning: 'commissioning', complete: 'complete', archived: 'archived' };

  /* ---------------- ASCII wheel: tyre, rim, five spokes, hub ---------------- */
  const RAMP = ' .,:;-=+*#%@';
  function wheelSamples() {
    const pts = []; // [x,y,z,nx,ny,nz]
    const torus = (R, r, du, dv) => {
      for (let t = 0; t < Math.PI * 2; t += du) for (let p = 0; p < Math.PI * 2; p += dv) {
        const ct = Math.cos(t), st = Math.sin(t), cp = Math.cos(p), sp = Math.sin(p);
        pts.push([(R + r * ct) * cp, (R + r * ct) * sp, r * st * 1.35, ct * cp, ct * sp, st]);
      }
    };
    torus(1.0, 0.3, 0.12, 0.02);   // tyre (slightly squared section)
    torus(0.66, 0.045, 0.5, 0.025); // rim lip
    for (let k = 0; k < 5; k++) {   // spokes
      const a = (k / 5) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      for (let t = 0.16; t < 0.66; t += 0.012) for (let w = -0.05; w <= 0.05; w += 0.025) {
        pts.push([t * ca - w * sa, t * sa + w * ca, 0.04, 0, 0, 1]);
        pts.push([t * ca - w * sa, t * sa + w * ca, -0.04, 0, 0, -1]);
      }
    }
    for (let r = 0; r < 0.16; r += 0.02) for (let p = 0; p < Math.PI * 2; p += 0.15) { // hub
      pts.push([r * Math.cos(p), r * Math.sin(p), 0.09, 0, 0, 1]);
      pts.push([r * Math.cos(p), r * Math.sin(p), -0.09, 0, 0, -1]);
    }
    return pts;
  }

  function asciiWheel(pre) {
    const pts = wheelSamples();
    const W = 64, H = 30;
    const L = [0.35, -0.55, -0.75]; const ln = Math.hypot(...L); L[0] /= ln; L[1] /= ln; L[2] /= ln;
    function frame(roll, yaw) {
      const out = new Array(W * H).fill(' '), zb = new Float32Array(W * H);
      const cr = Math.cos(roll), sr = Math.sin(roll), cy = Math.cos(yaw), sy = Math.sin(yaw);
      const tilt = -0.32, ct = Math.cos(tilt), stl = Math.sin(tilt);
      for (const [x0, y0, z0, nx0, ny0, nz0] of pts) {
        // roll about the axle (z), yaw about vertical (y), small tilt about x
        let x = x0 * cr - y0 * sr, y = x0 * sr + y0 * cr, z = z0;
        let nx = nx0 * cr - ny0 * sr, ny = nx0 * sr + ny0 * cr, nz = nz0;
        let x2 = x * cy + z * sy, z2 = -x * sy + z * cy;
        let nx2 = nx * cy + nz * sy, nz2 = -nx * sy + nz * cy;
        const y3 = y * ct - z2 * stl, z3 = y * stl + z2 * ct;
        const ny3 = ny * ct - nz2 * stl, nz3 = ny * stl + nz2 * ct;
        const ooz = 1 / (z3 + 4.2);
        const xp = Math.floor(W / 2 + 92 * x2 * ooz);  // ~28 columns per unit radius
        const yp = Math.floor(H / 2 - 44 * y3 * ooz);  // half that vertically: glyphs are ~2:1
        if (xp < 0 || xp >= W || yp < 0 || yp >= H) continue;
        const i = xp + yp * W;
        if (ooz > zb[i]) {
          zb[i] = ooz;
          const lum = Math.max(0, nx2 * L[0] + ny3 * L[1] + nz3 * L[2]);
          out[i] = RAMP[1 + Math.min(RAMP.length - 2, Math.floor(lum * (RAMP.length - 1)))];
        }
      }
      let s = '';
      for (let r = 0; r < H; r++) s += out.slice(r * W, r * W + W).join('') + '\n';
      return s;
    }
    let t = 0, running = false, visible = true, last = 0;
    const draw = () => { pre.textContent = frame(t * 0.05, Math.sin(t * 0.012) * 0.9); };
    const loop = (now) => {
      if (!running) return;
      if (now - last > 33) { t++; draw(); last = now; }
      requestAnimationFrame(loop);
    };
    const start = () => { if (reduced || running || !visible || document.hidden) return; running = true; requestAnimationFrame(loop); };
    const stop = () => { running = false; };
    t = 18; draw();
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : stop(); }).observe(pre);
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
    start();
  }

  // A static dithered field standing in for an event photo rendered as text.
  function asciiPlaceholder(seed, label) {
    const W = 72, H = 26, chars = ' .:-=+*#';
    let s = '';
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const nx = x / W - 0.5, ny = (y / H - 0.55) * 1.4;
        const ground = y > H * 0.72 ? 0.35 : 0;
        const body = Math.exp(-((nx * 1.6) ** 2 + (ny * 2.4 - 0.1) ** 2) * 6) * 0.9;
        const w1 = Math.exp(-(((nx + 0.24) * 9) ** 2 + ((ny - 0.32) * 9) ** 2)) * 1.2;
        const w2 = Math.exp(-(((nx - 0.24) * 9) ** 2 + ((ny - 0.32) * 9) ** 2)) * 1.2;
        const n = Math.sin((x + seed * 7) * 12.9898 + y * 78.233) * 43758.5453; const noise = (n - Math.floor(n)) * 0.18;
        const v = Math.min(0.999, Math.max(0, ground + body + w1 + w2 + noise - 0.08));
        s += chars[Math.floor(v * chars.length)];
      }
      s += '\n';
    }
    return s;
  }

  /* ---------------- sections ---------------- */
  function renderRuns() {
    const box = document.querySelector('[data-runs]');
    if (!box) return;
    const ph = document.body.hasAttribute('data-ph');
    const list = window.mockRuns();
    const n = document.querySelector('[data-run-count]');
    if (n) n.textContent = `(${String(list.length).padStart(2, '0')})`;
    const strips = list.length <= 3;
    box.className = `runs ${strips ? 'runs--strip' : 'runs--row'}`;
    box.innerHTML = list.map((r) => {
      const anon = r.code !== 'R04';
      const P = (real, fake) => window.mockPh(ph && anon, real, fake);
      const st = `<span class="status status--${r.status}">${statusLabel[r.status]}</span>`;
      const hit = `<a class="hit" href="project.html"><span class="vh">Read the run sheet: ${r.title}</span></a>`;
      if (strips) {
        return `<article class="run">
          <div class="run__line"><span class="run__code">${r.code}</span><h3 class="run__title">${P(r.title, 'Your project title')}</h3><span class="leader" aria-hidden="true"></span>${r.featured ? '<span class="tag">featured</span>' : ''}${st}</div>
          <p class="run__meta">${P(r.desc, 'Anonymised organisation')} · ${P(r.period, 'Dates')}</p>
          <div class="run__sheet">
            <div><h4>setup</h4><p>${P(r.setup, 'What was there before')}</p></div>
            <div><h4>change</h4><p>${P(r.change, 'What you built or changed')}</p></div>
            <div class="res"><h4>result</h4><p>${P(r.result, 'The measured outcome')}</p></div>
          </div>
          <span class="run__more">read the run sheet ${arrow}</span>${hit}</article>`;
      }
      return `<article class="run"><span class="run__code">${r.code}</span><h3 class="run__title">${P(r.title, 'Your project title')} ${r.featured ? '<span class="tag">featured</span>' : ''}</h3><span class="headline">${P(r.headline, 'Short result')}</span>${st}<span class="arr hv">${arrow}</span>${hit}</article>`;
    }).join('');
  }

  function renderSkills() {
    const box = document.querySelector('[data-skills]');
    if (!box) return;
    const ph = document.body.hasAttribute('data-ph');
    box.innerHTML = M.skills.map((s) => `<div class="skill"><h3>${s.name}</h3>${s.runs.length ? `<p class="seen">seen in${s.runs.map((r) => `<a href="#projects">${r}</a>`).join('')}</p>` : ''}<p class="ctx">${s.ph ? window.mockPh(ph, s.context, s.ph) : s.context}</p><p class="tools">${s.tools.join(' / ')}</p></div>`).join('');
    const ex = document.querySelector('[data-explore]');
    if (ex) ex.innerHTML = M.exploring.map((e) => `<li>${e}</li>`).join('');
  }

  function renderCerts() {
    const box = document.querySelector('[data-certs]');
    if (box) box.innerHTML = M.certs.map((c) => `<div class="cert"><span class="t">${c.title}</span><span class="g iss">${c.issuer}</span><span class="g dt">${c.date}</span>${c.verify ? `<a href="#certifications">verify ${ext}</a>` : '<span></span>'}</div>`).join('');
  }

  function renderGarage() {
    const box = document.querySelector('[data-garage]');
    if (!box) return;
    box.innerHTML = M.garage.map((g, i) => `<figure class="gcard"><pre aria-hidden="true">${asciiPlaceholder(i + 1)}</pre><figcaption><h3>${g.name.toLowerCase()}</h3><p>${g.note}</p><small>event photo → rendered as text, full colour on hover</small></figcaption></figure>`).join('');
  }

  /* ---------------- nav, keys, inspect ---------------- */
  function nav() {
    const navEl = document.querySelector('.nav');
    const menu = navEl && navEl.querySelector('.nav__menu');
    menu && menu.addEventListener('click', () => menu.setAttribute('aria-expanded', String(navEl.toggleAttribute('data-open'))));
    const links = [...document.querySelectorAll('.nav__links a[href^="#"]')];
    links.forEach((a) => a.addEventListener('click', () => navEl.removeAttribute('data-open')));
    const secs = links.map((a) => document.querySelector(a.getAttribute('href')));
    const update = () => {
      let cur = -1; secs.forEach((s, i) => { if (s && s.getBoundingClientRect().top < innerHeight * 0.35) cur = i; });
      links.forEach((a, i) => a.setAttribute('aria-current', String(i === cur)));
    };
    addEventListener('scroll', update, { passive: true }); update();

    const btn = document.querySelector('.inspect-btn');
    const toggle = () => { const on = document.body.classList.toggle('inspect'); btn && btn.setAttribute('aria-pressed', String(on)); };
    btn && btn.addEventListener('click', toggle);
    addEventListener('keydown', (e) => {
      if (e.target.closest('input, textarea, [contenteditable]') || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'i') toggle();
      const n = Number(e.key);
      if (n >= 1 && n <= links.length) { links[n - 1].click(); location.hash = links[n - 1].getAttribute('href'); }
    });
  }

  const renderAll = () => { renderRuns(); renderSkills(); };
  window.mockControls(renderAll);
  renderAll(); renderCerts(); renderGarage(); nav();
  const pre = document.querySelector('[data-wheel]');
  if (pre) asciiWheel(pre);
})();

// Trace: read this page view's real timings from the browser and replay the path.
(() => {
  const fig = document.querySelector('[data-trace]');
  if (!fig) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const nav = performance.getEntriesByType('navigation')[0];
  const host = location.hostname || 'this page';
  const ms = (v) => (v == null || !isFinite(v) ? null : Math.max(0, Math.round(v)));
  const kb = (b) => (b ? `${Math.max(1, Math.round(b / 1024))} KB` : null);

  const t = nav ? {
    dns: ms(nav.domainLookupEnd - nav.domainLookupStart),
    connect: ms(nav.connectEnd - nav.connectStart),
    tls: nav.secureConnectionStart > 0 ? ms(nav.connectEnd - nav.secureConnectionStart) : null,
    ttfb: ms(nav.responseStart - nav.requestStart),
    download: ms(nav.responseEnd - nav.responseStart),
    size: kb(nav.transferSize || nav.encodedBodySize),
    dcl: ms(nav.domContentLoadedEventEnd),
  } : {};

  const hops = [
    { cls: 'you', name: 'you', what: 'your browser asked for this page', ms: null },
    { cls: '', name: 'dns', what: `DNS lookup for ${host}`, ms: t.dns, measured: true },
    { cls: '', name: 'connect', what: t.tls != null ? `TCP and TLS handshake (TLS ${t.tls} ms)` : 'TCP connection', ms: t.connect, measured: true },
    { cls: '', name: 'edge', what: 'first byte from the nearest edge server', ms: t.ttfb, measured: true },
    { cls: 'page', name: 'this page', what: `static HTML${t.size ? `, ${t.size}` : ''} · built by GitHub Actions #128 from 3f9c2e1`, ms: t.download, measured: true },
    { cls: '', name: 'painted', what: 'largest element drawn on your screen', ms: null, lcp: true, measured: true },
  ];

  const list = fig.querySelector('ol');
  const total = fig.querySelector('[data-total]');
  const render = (lcp) => {
    const vals = hops.map((h) => (h.lcp ? lcp : h.ms)).filter((v) => v != null);
    const max = Math.max(1, ...vals);
    list.innerHTML = hops.map((h, i) => {
      const v = h.lcp ? lcp : h.ms;
      const shown = v == null ? (h.cls === 'you' ? '' : '…') : `${v} ms`;
      return `<li class="hop ${h.cls ? `hop--${h.cls}` : ''}" style="--d:${i * 170}ms">
        <span class="hop__node" aria-hidden="true"></span>
        <span class="hop__name">${h.name}</span>
        <span class="hop__ms ${v != null && h.measured ? 'is-measured' : ''}">${shown}</span>
        <span class="hop__what">${h.what}</span>
        ${h.cls === 'you' ? '' : `<span class="hop__bar" aria-hidden="true"><i style="--pct:${v == null ? 0 : Math.max(2, (v / max) * 100)}%"></i></span>`}
      </li>`;
    }).join('');
    if (total) total.textContent = lcp != null ? `${lcp} ms to paint` : t.dcl != null ? `${t.dcl} ms to ready` : '';
  };

  const replay = () => {
    if (reduced) return;
    fig.classList.add('is-replaying');
    void fig.offsetWidth;
    setTimeout(() => fig.classList.remove('is-replaying'), 40);
  };

  let lcp = null;
  render(lcp);
  replay();
  try {
    new PerformanceObserver((entries) => {
      const last = entries.getEntries().pop();
      if (last) { lcp = ms(last.startTime); render(lcp); }
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  } catch {}
  const btn = fig.querySelector('.replay');
  btn && btn.addEventListener('click', () => { render(lcp); replay(); });
})();
