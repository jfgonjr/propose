/* ==========================================================================
   Central de projetos da válvula de 10 mm — interface e simuladores
   Sem dependências. O visualizador 3D (viewer.js) lê window.Purga.angle
   para girar o disco junto com o simulador ativo.
   ========================================================================== */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const nf = (n, d = 0) => n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
  const norm = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sem armazenamento: segue sem persistir */ } }
  };

  window.Purga = { angle: 0 };

  /* ------------------------------------------------------------------
     Interface geral
     ------------------------------------------------------------------ */
  const menuBtn = $('#menuBtn'), mobileNav = $('#mobileNav');
  if (menuBtn && mobileNav) {
    menuBtn.addEventListener('click', () => {
      const open = mobileNav.classList.toggle('hidden') === false;
      menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    $$('a', mobileNav).forEach((a) => a.addEventListener('click', () => {
      mobileNav.classList.add('hidden'); menuBtn.setAttribute('aria-expanded', 'false');
    }));
  }

  // Link atual na navegação
  (() => {
    const links = $$('header .nav-link');
    const secs = ['inicio', 'projetos', 'plataforma', 'simuladores', 'stl'].map((id) => document.getElementById(id)).filter(Boolean);
    if (!('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((es) => {
      es.forEach((e) => {
        if (!e.isIntersecting) return;
        links.forEach((l) => l.classList.toggle('is-current', l.getAttribute('href') === '#' + e.target.id));
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    secs.forEach((s) => io.observe(s));
  })();

  // Busca e filtros de projetos
  (() => {
    const cards = $$('#cards > article');
    const count = $('#contador'), empty = $('#vazio'), input = $('#busca');
    const btns = $$('[data-filter]');
    let f = 'all', q = '';
    const run = () => {
      let n = 0;
      cards.forEach((c) => {
        const hay = norm(c.dataset.name + ' ' + c.textContent);
        const ok = (f === 'all' || c.dataset.cat.split(' ').includes(f)) && (!q || hay.includes(q));
        c.classList.toggle('hidden', !ok);
        if (ok) n++;
      });
      count.textContent = n + (n === 1 ? ' projeto' : ' projetos');
      empty.classList.toggle('hidden', n !== 0);
    };
    btns.forEach((b) => b.addEventListener('click', () => {
      f = b.dataset.filter;
      btns.forEach((x) => { const on = x === b; x.classList.toggle('is-active', on); x.setAttribute('aria-pressed', on ? 'true' : 'false'); });
      run();
    }));
    input.addEventListener('input', () => { q = norm(input.value.trim()); run(); });
  })();

  // Sliders: saída formatada ao lado do rótulo
  $$('input.range').forEach((r) => {
    const out = document.getElementById(r.id + '-o');
    const show = () => {
      const v = +r.value;
      if (!out) return;
      if (r.dataset.fmt === 'hour') {
        const h = Math.floor(v), m = Math.round((v - h) * 60);
        out.textContent = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
      } else out.textContent = nf(v, +r.dataset.dec || 0) + (r.dataset.unit || '');
    };
    r.addEventListener('input', show); show();
  });
  $$('[data-set]').forEach((b) => b.addEventListener('click', () => {
    const [id, val] = b.dataset.set.split(':');
    const r = document.getElementById(id);
    if (r) { r.value = val; r.dispatchEvent(new Event('input', { bubbles: true })); }
  }));

  /* ------------------------------------------------------------------
     Peças comuns dos simuladores
     ------------------------------------------------------------------ */
  const RATE = 36; // °/s do atuador (motor N20 + redução)

  class Valve {
    constructor(a) { this.a = a; this.t = a; }
    step(dt) {
      const d = RATE * dt;
      if (this.a < this.t) this.a = Math.min(this.t, this.a + d);
      else if (this.a > this.t) this.a = Math.max(this.t, this.a - d);
    }
  }

  const statEls = {};
  function stat(key, text, tone) {
    const e = statEls[key] || (statEls[key] = $('[data-s="' + key + '"]'));
    if (!e) return;
    const v = e.querySelector('.v');
    if (v.textContent !== text) v.textContent = text;
    if ((e.dataset.tone || '') !== (tone || '')) { if (tone) e.dataset.tone = tone; else delete e.dataset.tone; }
  }

  function say(id, text) { const e = document.getElementById(id); if (e) e.textContent = text; }

  /* Esquema da válvula (SVG): disco a 0° bloqueia o canal, a 90° fica alinhado ao fluxo */
  function buildScope(host) {
    const k = 'sc-' + host.dataset.scope, fluid = host.dataset.fluid || '#00E5FF', leak = host.dataset.leak === '1';
    host.innerHTML =
      '<div class="relative overflow-hidden rounded border border-edge bg-[#0B0C10]">' +
        '<div class="flex items-end justify-between gap-3 px-4 pb-1 pt-3"><div><div class="tele-label">Ângulo</div><div class="font-mono text-3xl font-bold leading-none text-accent" style="text-shadow:0 0 16px rgba(255,220,0,.4)"><span id="' + k + '-ang">000</span>°</div></div><div class="text-right"><div class="tele-label">Posição</div><div id="' + k + '-pos" class="font-mono text-sm font-bold text-white">—</div></div></div>' +
        '<svg viewBox="0 28 400 144" class="block h-auto w-full" role="img" aria-label="Esquema da válvula com o ângulo do disco em tempo real">' +
          '<defs><pattern id="h-' + k + '" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="#2E3340"/></pattern></defs>' +
          '<rect x="6" y="82" width="388" height="36" fill="url(#h-' + k + ')" opacity=".45"/>' +
          '<rect x="6" y="82" width="388" height="36" fill="#0B0C10" opacity=".7" stroke="#3A4052"/>' +
          '<circle cx="200" cy="100" r="58" fill="#14161D" stroke="#3A4052" stroke-width="2"/>' +
          '<circle cx="200" cy="100" r="50" fill="none" stroke="#2E3340" stroke-dasharray="3 5"/>' +
          '<line id="' + k + '-fl" x1="14" y1="100" x2="136" y2="100" stroke="' + fluid + '" stroke-width="2.5" class="flow-line" opacity=".8"/>' +
          '<line id="' + k + '-fr" x1="264" y1="100" x2="386" y2="100" stroke="' + fluid + '" stroke-width="2.5" class="flow-line" opacity="0"/>' +
          '<g id="' + k + '-disc"><rect x="196" y="42" width="8" height="116" rx="1" fill="#FFDC00"/><rect x="196" y="42" width="8" height="116" rx="1" fill="none" stroke="#fff" stroke-opacity=".35"/></g>' +
          '<circle cx="200" cy="100" r="9" fill="#090A0C" stroke="#FFDC00" stroke-width="2"/>' +
          (leak ? '<g id="' + k + '-leak" opacity="0" class="blink" fill="#FF334B"><circle cx="96" cy="132" r="3.5"/><circle cx="104" cy="148" r="3"/><circle cx="94" cy="162" r="2.5"/><path d="M96 118v6" stroke="#FF334B" stroke-width="2"/></g>' : '') +
          '<g font-family="JetBrains Mono, monospace" font-weight="600" font-size="9.5"><text x="16" y="72" fill="#00E5FF">Ø10 mm</text><text x="326" y="72" fill="#00E5FF">Ø10 mm</text><text x="16" y="146" fill="#8B91A1">ENTRADA</text><text x="340" y="146" fill="#8B91A1">SAÍDA</text></g>' +
        '</svg>' +
        '<div class="h-1 bg-edge" aria-hidden="true"><div id="' + k + '-bar" class="h-full bg-accent transition-[width] duration-100" style="width:0"></div></div>' +
      '</div>';
    const g = (s) => document.getElementById(k + s);
    const els = { disc: g('-disc'), ang: g('-ang'), pos: g('-pos'), bar: g('-bar'), fr: g('-fr'), fl: g('-fl'), leak: g('-leak') };
    return (a, o = {}) => {
      els.disc.setAttribute('transform', 'rotate(' + a.toFixed(1) + ' 200 100)');
      els.ang.textContent = String(Math.round(a)).padStart(3, '0');
      els.pos.textContent = a < 1 ? 'FECHADA' : a > 89 ? 'ABERTA' : 'EM MOVIMENTO';
      els.bar.style.width = (a / 90 * 100) + '%';
      const f = Math.sin(a * Math.PI / 180);
      els.fr.setAttribute('opacity', (f * 0.9).toFixed(2));
      els.fl.setAttribute('opacity', o.noFlow ? '0.15' : '0.8');
      if (els.leak) els.leak.setAttribute('opacity', o.leak ? '1' : '0');
    };
  }

  /* Botão de "segurar para confirmar" (mouse, toque e teclado) */
  function holdButton({ btn, bar, ms, ok, done, fail }) {
    let t0 = 0, raf = 0, active = false;
    const reset = () => { active = false; cancelAnimationFrame(raf); bar.style.width = '0'; };
    const loop = () => {
      if (!active) return;
      if (ok && !ok()) { reset(); fail && fail(); return; }
      const p = (performance.now() - t0) / ms;
      bar.style.width = clamp(p * 100, 0, 100) + '%';
      if (p >= 1) { reset(); done(); return; }
      raf = requestAnimationFrame(loop);
    };
    const start = () => {
      if (active) return;
      if (ok && !ok()) { fail && fail(); return; }
      active = true; t0 = performance.now(); raf = requestAnimationFrame(loop);
    };
    btn.addEventListener('pointerdown', (e) => { e.preventDefault(); start(); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => btn.addEventListener(ev, reset));
    btn.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); start(); } });
    btn.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') reset(); });
    btn.addEventListener('blur', reset);
  }

  const sims = {};

  /* ------------------------------------------------------------------
     ÁGUA — vazamento por diferença de vazão
     ------------------------------------------------------------------ */
  sims.agua = (() => {
    const draw = buildScope($('[data-scope="agua"]'));
    const q1 = $('#agua-q1'), q2 = $('#agua-q2'), lim = $('#agua-lim'), mode = $('#agua-mode'), speed = $('#agua-speed');
    const LK = 'valvula10.agua.locked';
    const v = new Valve(90);
    const s = { state: 'ok', leakT: 0, preT: 0, locked: store.get(LK) === '1' };
    if (s.locked) { s.state = 'closed'; v.a = v.t = 0; }

    const diff = () => +q1.value - +q2.value;
    const leaking = () => diff() > +lim.value + 1e-9;
    const close = () => { s.state = 'closed'; s.locked = true; v.t = 0; store.set(LK, '1'); };

    $('#agua-leak').addEventListener('click', () => { q2.value = Math.max(0, +q1.value - 4); q2.dispatchEvent(new Event('input')); say('agua-msg', 'Saída reduzida em 4 L/min.'); });
    $('#agua-fix').addEventListener('click', () => { q2.value = q1.value; q2.dispatchEvent(new Event('input')); say('agua-msg', 'Vazamento consertado: saída igual à entrada.'); });
    holdButton({
      btn: $('#agua-rearm'), bar: $('#agua-hold'), ms: 3000,
      ok: () => s.state === 'closed' && !leaking(),
      fail: () => say('agua-msg', s.state !== 'closed' ? 'A válvula não está travada.' : 'Rearme negado: o vazamento ainda está ativo.'),
      done: () => { s.state = 'ok'; s.locked = false; s.leakT = 0; v.t = 90; store.set(LK, '0'); say('agua-msg', 'Válvula rearmada e liberada.'); }
    });

    function tick(dt) {
      const d = dt * +speed.value;
      if (s.state === 'ok') {
        if (leaking()) {
          s.leakT += d;
          if (s.leakT >= 2) {
            if (mode.value === 'now') close();
            else { s.state = 'pre'; s.preT = 60; }
          }
        } else s.leakT = 0;
      } else if (s.state === 'pre') {
        if (!leaking()) { s.state = 'ok'; s.leakT = 0; }
        else { s.preT -= d; if (s.preT <= 0) close(); }
      }
      v.step(d);
    }

    function render() {
      const lk = leaking(), closed = s.state === 'closed';
      const valve = closed ? (v.a > 0.5 ? 'FECHANDO' : 'FECHADA') : (v.a < 89.5 ? 'ABRINDO' : 'ABERTA');
      stat('agua.valve', valve, closed ? 'bad' : s.state === 'pre' ? 'warn' : 'ok');
      stat('agua.pre', s.state === 'pre' ? Math.ceil(s.preT) + ' s' : s.state === 'ok' && s.leakT > 0 ? 'CONFIRMANDO ' + nf(s.leakT, 1) + '/2 s' : closed ? 'ESGOTADO' : '—', s.state === 'pre' ? 'warn' : s.leakT > 0 ? 'warn' : '');
      stat('agua.diff', nf(diff(), 1) + ' L/min', lk ? 'bad' : 'ok');
      stat('agua.eeprom', s.locked ? 'TRAVADO' : 'LIVRE', s.locked ? 'bad' : 'ok');
      stat('agua.s1', closed ? '0,0 L/min' : nf(+q1.value, 1) + ' L/min', 'info');
      stat('agua.s2', closed ? '0,0 L/min' : nf(+q2.value, 1) + ' L/min', 'info');
      stat('agua.led', s.state === 'ok' ? 'VERDE · buzzer off' : s.state === 'pre' ? 'VERMELHO piscando · buzzer on' : 'VERMELHO fixo · buzzer off', s.state === 'ok' ? 'ok' : 'bad');
      draw(v.a, { leak: lk && !closed, noFlow: closed });
    }
    return { v, tick, render };
  })();

  /* ------------------------------------------------------------------
     CO₂ — damper proporcional com fail-safe
     ------------------------------------------------------------------ */
  sims.co2 = (() => {
    const draw = buildScope($('[data-scope="co2"]'));
    const ppm = $('#co2-ppm'), tmp = $('#co2-t'), rh = $('#co2-rh'), vol = $('#co2-vol'), qmax = $('#co2-qmax'), prof = $('#co2-prof'), failBtn = $('#co2-fail');
    const v = new Valve(0);
    const s = { target: 0, fan: false, failed: false, failT: 0 };

    failBtn.addEventListener('click', () => {
      s.failed = !s.failed; s.failT = 0;
      failBtn.setAttribute('aria-pressed', s.failed ? 'true' : 'false');
      failBtn.textContent = s.failed ? 'Restaurar sensor' : 'Falha do sensor';
      failBtn.classList.toggle('btn-danger', !s.failed);
      failBtn.classList.toggle('btn-ghost', s.failed);
    });

    const angleFor = (p) => Math.min(90, Math.floor(clamp((p - 600) / 600 * 90, 0, 90) / 15) * 15);

    // Curva ângulo × CO₂ (estática) e marcador
    const chart = $('#co2-chart');
    const X = (p) => 22 + (p - 400) / 1600 * 270, Y = (a) => 92 - a / 90 * 80;
    let d = '';
    for (let p = 400; p <= 2000; p += 10) d += (d ? 'L' : 'M') + X(p).toFixed(1) + ' ' + Y(angleFor(p)).toFixed(1);
    chart.innerHTML =
      '<g stroke="#2E3340" stroke-width="1"><line x1="22" y1="92" x2="292" y2="92"/><line x1="22" y1="12" x2="22" y2="92"/>' +
      [0, 30, 60, 90].map((a) => '<line x1="22" y1="' + Y(a) + '" x2="292" y2="' + Y(a) + '" stroke-dasharray="2 4" opacity=".6"/>').join('') + '</g>' +
      '<g stroke="#FFDC00" stroke-opacity=".35" stroke-dasharray="3 3"><line x1="' + X(600) + '" y1="12" x2="' + X(600) + '" y2="92"/><line x1="' + X(1200) + '" y1="12" x2="' + X(1200) + '" y2="92"/></g>' +
      '<path d="' + d + '" fill="none" stroke="#00E5FF" stroke-width="2"/>' +
      '<g font-family="JetBrains Mono, monospace" font-size="8" font-weight="600" fill="#8B91A1"><text x="2" y="95">0°</text><text x="2" y="66">30°</text><text x="2" y="39">60°</text><text x="2" y="15">90°</text>' +
      '<text x="' + X(600) + '" y="106" text-anchor="middle">600</text><text x="' + X(1200) + '" y="106" text-anchor="middle">1200</text><text x="22" y="106">400</text><text x="292" y="106" text-anchor="end">2000 ppm</text></g>' +
      '<circle id="co2-dot" r="4.5" fill="#FFDC00" stroke="#090A0C" stroke-width="2"/>';
    const dot = $('#co2-dot');

    function tick(dt) {
      const p = +ppm.value;
      if (!s.failed) {
        s.failT = 0;
        const raw = clamp((p - 600) / 600 * 90, 0, 90);
        const up = Math.min(90, Math.floor(raw / 15) * 15);          // sobe ao cruzar o degrau
        const dn = Math.min(90, Math.floor((raw + 7.5) / 15) * 15);   // desce só 50 ppm (7,5°) abaixo
        if (up > s.target) s.target = up; else if (dn < s.target) s.target = dn;
        if (p > 1200) s.fan = true; else if (p < 1150) s.fan = false;
      } else {
        s.failT += dt;
        if (s.failT >= 10) { s.target = 45; s.fan = false; }
      }
      v.t = s.target;
      v.step(dt);
    }

    function render() {
      const p = +ppm.value, T = +tmp.value, H = +rh.value;
      const free = 1 - Math.cos(v.a * Math.PI / 180);
      const q = +qmax.value * free * (s.fan ? 1 : 0.10);
      const ach = q / +vol.value;
      const svp = 0.6108 * Math.exp(17.27 * T / (T + 237.3));
      const vpd = svp * (1 - H / 100);
      const [lo, hi, name] = prof.value.split(',');
      const st = vpd < +lo ? 'ABAIXO' : vpd > +hi ? 'ACIMA' : 'DENTRO';

      stat('co2.ppm', nf(p) + ' ppm', p > 1200 ? 'bad' : p > 600 ? 'warn' : 'ok');
      stat('co2.ang', s.target + '°' + (s.failed && s.failT >= 10 ? ' · FAIL-SAFE' : ''), s.failed && s.failT >= 10 ? 'warn' : 'info');
      stat('co2.q', nf(q, 1) + ' m³/h', 'info');
      stat('co2.fan', s.fan ? 'LIGADO' : 'DESLIGADO', s.fan ? 'info' : '');
      stat('co2.ach', nf(ach, 1) + ' /h', '');
      stat('co2.sensor', s.failed ? (s.failT < 10 ? 'FALHA ' + Math.ceil(10 - s.failT) + ' s' : 'ISOLADO') : 'OK', s.failed ? 'bad' : 'ok');
      stat('co2.vpd', nf(vpd, 2) + ' kPa', st === 'DENTRO' ? 'ok' : 'warn');
      stat('co2.vpdr', name + ' · ' + st, st === 'DENTRO' ? 'ok' : 'warn');
      draw(v.a);
      dot.setAttribute('cx', X(clamp(p, 400, 2000)).toFixed(1));
      dot.setAttribute('cy', Y(v.a).toFixed(1));
    }
    return { v, tick, render };
  })();

  /* ------------------------------------------------------------------
     GÁS — corte imediato por presença ou emergência
     ------------------------------------------------------------------ */
  sims.gas = (() => {
    const draw = buildScope($('[data-scope="gas"]'));
    const LK = 'valvula10.gas.locked';
    const v = new Valve(90);
    const s = { locked: store.get(LK) === '1', hold: false, pir: 0, dec: '—' };
    if (s.locked) { v.a = v.t = 0; s.dec = 'BLOQUEIO SALVO'; }
    const presence = () => s.hold || s.pir > 0;
    const msg = (t) => say('gas-msg', t);

    const cut = (why) => { s.locked = true; v.t = 0; s.dec = '0 s · ' + why; store.set(LK, '1'); msg('Corte imediato: ' + why + '.'); };

    $('#gas-pir').addEventListener('click', () => { s.pir = 1.5; msg('Movimento detectado (pulso de 1,5 s).'); });
    $('#gas-emerg').addEventListener('click', () => { if (!s.locked) cut('EMERGÊNCIA'); else msg('Já está fechada e bloqueada.'); });
    const pBtn = $('#gas-presence');
    pBtn.addEventListener('click', () => {
      s.hold = !s.hold;
      pBtn.setAttribute('aria-pressed', s.hold ? 'true' : 'false');
      pBtn.classList.toggle('is-active', s.hold);
      msg(s.hold ? 'Presença contínua ligada.' : 'Presença contínua desligada.');
    });
    $('#gas-open').addEventListener('click', () => {
      if (presence()) msg('Reabertura negada: há presença.');
      else if (s.locked) msg('Válvula bloqueada. Segure “Rearmar” por 3 s sem presença.');
      else msg('A válvula já está aberta.');
    });
    holdButton({
      btn: $('#gas-rearm'), bar: $('#gas-hold'), ms: 3000,
      ok: () => s.locked && !presence(),
      fail: () => msg(!s.locked ? 'Nada para rearmar.' : 'Rearme negado: há presença.'),
      done: () => { s.locked = false; v.t = 90; s.dec = '—'; store.set(LK, '0'); msg('Rearmado. Válvula reaberta.'); }
    });

    function tick(dt) {
      if (s.pir > 0) s.pir = Math.max(0, s.pir - dt);
      if (!s.locked && presence()) cut('PRESENÇA');
      v.step(dt);
    }
    function render() {
      const pr = presence();
      stat('gas.valve', s.locked ? (v.a > 0.5 ? 'FECHANDO' : 'FECHADA') : (v.a < 89.5 ? 'ABRINDO' : 'ABERTA'), s.locked ? 'bad' : 'ok');
      stat('gas.dec', s.dec, s.locked ? 'bad' : '');
      stat('gas.pres', pr ? 'DETECTADA' : 'LIVRE', pr ? 'bad' : 'ok');
      stat('gas.eeprom', s.locked ? 'BLOQUEADO' : 'LIVRE', s.locked ? 'bad' : 'ok');
      stat('gas.led', s.locked ? 'VERMELHO aceso · verde apagado' : 'VERDE aceso · vermelho apagado', s.locked ? 'bad' : 'ok');
      stat('gas.buz', s.locked ? 'ATIVO' : 'DESLIGADO', s.locked ? 'bad' : '');
      draw(v.a, { noFlow: s.locked });
    }
    return { v, tick, render };
  })();

  /* ------------------------------------------------------------------
     SOLAR — purga em pulsos contra congelamento
     ------------------------------------------------------------------ */
  sims.solar = (() => {
    const draw = buildScope($('[data-scope="solar"]'));
    const T = $('#solar-t'), thr = $('#solar-thr'), hr = $('#solar-h'), speed = $('#solar-speed');
    const v = new Valve(0);
    const GAP = 1800, PULSE = 30;
    const s = { since: GAP, purging: false, left: 0, count: 0, water: 0, hist: [], acc: 0 };
    const night = () => +hr.value >= 22 || +hr.value < 6;

    const start = () => { s.purging = true; s.left = PULSE; v.t = 90; s.count++; s.water += 2; };
    $('#solar-manual').addEventListener('click', () => { if (!s.purging) start(); });
    $('#solar-reset').addEventListener('click', () => { Object.assign(s, { since: GAP, purging: false, left: 0, count: 0, water: 0, hist: [] }); v.a = v.t = 0; });

    const chart = $('#solar-chart');
    function drawChart() {
      const n = s.hist.length, W = 300, H = 80;
      let pts = '';
      s.hist.forEach((a, i) => { pts += (i ? 'L' : 'M') + ((i + (480 - n)) / 480 * (W - 24) + 22).toFixed(1) + ' ' + (H - 10 - a / 90 * (H - 22)).toFixed(1); });
      chart.innerHTML =
        '<g stroke="#2E3340"><line x1="22" y1="70" x2="298" y2="70"/><line x1="22" y1="8" x2="22" y2="70"/></g>' +
        '<g stroke="#2E3340" stroke-dasharray="2 4" opacity=".6"><line x1="22" y1="39" x2="298" y2="39"/><line x1="22" y1="14" x2="298" y2="14"/></g>' +
        '<g font-family="JetBrains Mono, monospace" font-size="8" font-weight="600" fill="#8B91A1"><text x="2" y="73">0°</text><text x="2" y="42">45°</text><text x="2" y="17">90°</text><text x="298" y="79" text-anchor="end">agora</text><text x="22" y="79">−120 s</text></g>' +
        (pts ? '<path d="' + pts + '" fill="none" stroke="#FFDC00" stroke-width="2" stroke-linejoin="round"/>' : '');
    }

    function tick(dt) {
      const d = dt * +speed.value;
      s.since += d;
      if (s.purging) {
        s.left -= d;
        if (s.left <= 0) { s.purging = false; s.left = 0; v.t = 0; s.since = 0; }
      } else if (night() && +T.value < +thr.value && s.since >= GAP) start();
      v.step(d);
      s.acc += dt;
      if (s.acc >= 0.25) { s.acc = 0; s.hist.push(v.a); if (s.hist.length > 480) s.hist.shift(); drawChart(); }
    }

    function render() {
      const t = +T.value, nt = night();
      let next;
      if (s.purging) next = '—';
      else if (!nt) next = 'FORA DA JANELA';
      else if (t >= +thr.value) next = 'SEM RISCO';
      else if (s.since >= GAP) next = 'AGORA';
      else { const r = Math.ceil((GAP - s.since)); next = String(Math.floor(r / 60)).padStart(2, '0') + ':' + String(r % 60).padStart(2, '0'); }
      stat('solar.valve', s.purging ? (v.a < 89.5 ? 'ABRINDO' : 'ABERTA · PURGANDO') : (v.a > 0.5 ? 'FECHANDO' : 'FECHADA'), s.purging ? 'warn' : 'ok');
      stat('solar.purge', nf(Math.ceil(s.left)) + ' s', s.purging ? 'warn' : '');
      stat('solar.next', next, next === 'AGORA' ? 'warn' : '');
      stat('solar.win', nt ? 'ATIVA' : 'INATIVA', nt ? 'ok' : '');
      stat('solar.temp', nf(t, 1) + ' °C', t <= 0 ? 'bad' : t < +thr.value ? 'warn' : 'ok');
      stat('solar.count', String(s.count), '');
      stat('solar.water', '≈ ' + nf(s.water, 1) + ' L', 'info');
      draw(v.a, { noFlow: !s.purging && v.a < 1 });
    }
    drawChart();
    return { v, tick, render };
  })();

  /* ------------------------------------------------------------------
     Abas e laço principal
     ------------------------------------------------------------------ */
  const tabs = $$('[data-tab]'), panels = $$('[data-panel]');
  let active = 'agua';
  function activate(name, focus) {
    if (!sims[name]) return;
    active = name;
    tabs.forEach((t) => {
      const on = t.dataset.tab === name;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      if (on && focus) t.focus();
    });
    panels.forEach((p) => { const on = p.dataset.panel === name; p.classList.toggle('hidden', !on); p.hidden = !on; });
    sims[name].render();
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => activate(t.dataset.tab));
    t.addEventListener('keydown', (e) => {
      let j = -1;
      if (e.key === 'ArrowRight') j = (i + 1) % tabs.length;
      else if (e.key === 'ArrowLeft') j = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === 'Home') j = 0;
      else if (e.key === 'End') j = tabs.length - 1;
      if (j >= 0) { e.preventDefault(); activate(tabs[j].dataset.tab, true); }
    });
  });
  $$('[data-sim]').forEach((a) => a.addEventListener('click', () => activate(a.dataset.sim)));

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now;
    Object.values(sims).forEach((m) => m.tick(dt));   // todos continuam rodando em segundo plano
    sims[active].render();
    window.Purga.angle = sims[active].v.a;
    requestAnimationFrame(loop);
  }
  activate('agua');
  requestAnimationFrame(loop);
})();
