(() => {
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.getElementById('menu');
  const header = document.querySelector('.site-header');
  const dock = document.querySelector('.dock');
  const hero = document.getElementById('inicio');
  const contact = document.getElementById('contato');
  const words = document.querySelector('[data-words]');
  const cards = [...document.querySelectorAll('[data-stack] .stack-card')];
  const unitsSection = document.getElementById('unidades');

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp01 = (n) => Math.min(1, Math.max(0, n));

  // ---------- Menu mobile ----------
  let menuScrollY = 0;
  const setMenu = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.querySelector('.sr-only').textContent = open ? 'Fechar menu' : 'Abrir menu';
    nav.classList.toggle('is-open', open);
    if (open) menuScrollY = window.scrollY;
  };
  toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('click', (e) => { if (!header.contains(e.target)) setMenu(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('is-open')) { setMenu(false); toggle.focus(); }
  });
  window.matchMedia('(min-width: 860px)').addEventListener('change', () => setMenu(false));
  // fecha o menu se a pessoa rolar a página com ele aberto
  window.addEventListener('scroll', () => {
    if (nav.classList.contains('is-open') && Math.abs(window.scrollY - menuScrollY) > 60) setMenu(false);
  }, { passive: true });

  // ---------- Entrada suave ----------
  const revealEls = document.querySelectorAll('[data-reveal]');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealEls.forEach((el) => el.classList.add('is-in'));
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    revealEls.forEach((el) => io.observe(el));
  }

  // ---------- Texto palavra por palavra ----------
  let wordSpans = [];
  if (words && !reduceMotion) {
    words.querySelectorAll('p').forEach((p) => {
      p.innerHTML = p.textContent.trim().split(/\s+/).map((w) => `<span class="w">${w}</span>`).join(' ');
    });
    wordSpans = [...words.querySelectorAll('.w')];
  }

  // ---------- Leitura da rolagem (agrupada em um frame) ----------
  let lit = -1;
  const coverage = cards.map(() => -1);
  let queued = false;
  let heroH = hero.offsetHeight, heroP = -1;

  const update = () => {
    queued = false;
    const vh = window.innerHeight;

    // Parallax do hero: --hp vai de 0 (topo) a 1 (hero fora da tela); as camadas usam em velocidades diferentes
    if (!reduceMotion) {
      const hp = Math.round(clamp01(window.scrollY / heroH) * 1000) / 1000;
      if (hp !== heroP) { hero.style.setProperty('--hp', hp); heroP = hp; }
    }

    // Cartões empilhados: quanto cada cartão seguinte já cobriu o anterior
    if (cards.length && !reduceMotion) {
      const cov = cards.map((card) => {
        const top = card.getBoundingClientRect().top;
        const stickTop = parseFloat(getComputedStyle(card).top) || 0;
        return clamp01((vh - top) / Math.max(1, vh - stickTop));
      });
      cards.forEach((card, i) => {
        let c = 0;
        for (let j = i + 1; j < cards.length; j++) c += cov[j];
        c = Math.round(c * 1000) / 1000;
        if (c !== coverage[i]) { card.style.setProperty('--c', c); coverage[i] = c; }
      });
    }

    // Texto do Sobre
    if (wordSpans.length) {
      const r = words.getBoundingClientRect();
      const n = Math.round(clamp01((vh * 0.8 - r.top) / (r.height + vh * 0.25)) * wordSpans.length);
      if (n !== lit) { wordSpans.forEach((s, i) => s.classList.toggle('on', i < n)); lit = n; }
    }

    // Barra flutuante: após o hero, até o contato
    const pastHero = hero.getBoundingClientRect().bottom < vh * 0.4;
    const atContact = contact.getBoundingClientRect().top < vh;
    const u = unitsSection && unitsSection.getBoundingClientRect();
    const atUnits = u && u.top < vh * 0.6 && u.bottom > vh * 0.4;   // a seção tem seus próprios botões
    dock.classList.toggle('is-visible', pastHero && !atContact && !atUnits);
  };

  const onScroll = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => { heroH = hero.offsetHeight; onScroll(); }, { passive: true });
  window.addEventListener('load', () => { heroH = hero.offsetHeight; update(); });
  update();

  // ---------- Contagem do número de unidades no hero ----------
  const countEl = document.querySelector('[data-count]');
  if (countEl && !reduceMotion) {
    const total = parseInt(countEl.dataset.count, 10);
    const start = performance.now() + 350;
    const tick = (now) => {
      const t = clamp01((now - start) / 1300);
      countEl.textContent = String(Math.round(total * (1 - Math.pow(1 - t, 3))));
      if (t < 1) requestAnimationFrame(tick);
    };
    countEl.textContent = '0';
    requestAnimationFrame(tick);
  }

  // ---------- Globo 3D (canvas + d3-geo) ----------
  // Desenha só quando algo muda; o pulso do marcador ativo roda apenas com o globo visível.
  const createGlobe = (canvas, cities) => {
    const d3 = window.d3;
    if (!canvas || !d3 || !d3.geoOrthographic) return null;
    const ctx = canvas.getContext('2d');
    const projection = d3.geoOrthographic().clipAngle(90).precision(0.6);
    const path = d3.geoPath(projection, ctx);
    const graticule = d3.geoGraticule10();
    const view = { lng: -47, lat: -17, zoom: 1 };
    let data = null, active = null, w = 0, h = 0, dpr = 1, visible = false, tween = null, raf = 0, dragging = null;

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = r.width; h = r.height;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      draw();
    };

    const draw = (now = performance.now()) => {
      if (!w || !h) return;
      const radius = Math.min(w, h) * 0.4 * view.zoom;
      const center = [view.lng, view.lat];
      projection.scale(radius).translate([w / 2, h * 0.44]).rotate([-view.lng, -view.lat]);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // oceano com brilho na borda
      const g = ctx.createRadialGradient(w / 2 - radius * 0.3, h * 0.44 - radius * 0.35, radius * 0.1, w / 2, h * 0.44, radius);
      g.addColorStop(0, '#0b5530'); g.addColorStop(1, '#012a14');
      ctx.beginPath(); path({ type: 'Sphere' }); ctx.fillStyle = g; ctx.fill();
      ctx.save(); ctx.shadowColor = 'rgba(111, 207, 151, .55)'; ctx.shadowBlur = 24;
      ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(127, 174, 147, .45)'; ctx.stroke(); ctx.restore();

      ctx.beginPath(); path(graticule); ctx.lineWidth = 0.6; ctx.strokeStyle = 'rgba(255, 255, 255, .05)'; ctx.stroke();

      if (data) {
        // Brasil em destaque
        ctx.beginPath(); path({ type: 'MultiPolygon', coordinates: data.brazil }); ctx.fillStyle = 'rgba(0, 103, 56, .45)'; ctx.fill();

        // pontos dos continentes (um único preenchimento)
        const size = Math.max(1, Math.min(2.4, 1.1 * view.zoom));
        ctx.beginPath();
        for (let i = 0; i < data.dots.length; i += 2) {
          const p = [data.dots[i], data.dots[i + 1]];
          if (d3.geoDistance(p, center) > 1.52) continue;
          const [x, y] = projection(p);
          ctx.rect(x - size / 2, y - size / 2, size, size);
        }
        ctx.fillStyle = 'rgba(156, 199, 174, .45)'; ctx.fill();

        // costas e fronteiras com brilho
        ctx.beginPath(); path({ type: 'MultiLineString', coordinates: data.borders });
        ctx.save(); ctx.shadowColor = 'rgba(61, 220, 132, .7)'; ctx.shadowBlur = 8;
        ctx.lineWidth = 0.9; ctx.strokeStyle = 'rgba(134, 239, 172, .7)'; ctx.stroke(); ctx.restore();

        ctx.beginPath(); path({ type: 'MultiPolygon', coordinates: data.brazil });
        ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(255, 255, 255, .85)'; ctx.stroke();
      }

      // marcadores (cidades)
      cities.forEach((c) => {
        if (d3.geoDistance([c.lng, c.lat], center) > 1.5) return;
        const [x, y] = projection([c.lng, c.lat]);
        const on = active === c;
        if (on && !reduceMotion) {
          const t = (now % 1800) / 1800;
          ctx.beginPath(); ctx.arc(x, y, 6 + t * 18, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(255, 255, 255, ' + (0.6 * (1 - t)).toFixed(3) + ')'; ctx.lineWidth = 2; ctx.stroke();
        }
        ctx.beginPath(); ctx.arc(x, y, on ? 6 : 4, 0, Math.PI * 2);
        ctx.fillStyle = on ? '#ffffff' : 'rgba(255, 255, 255, .8)'; ctx.fill();
        if (on) { ctx.lineWidth = 3; ctx.strokeStyle = '#1fa35a'; ctx.stroke(); }
      });

      // rótulo da cidade ativa
      if (active && d3.geoDistance([active.lng, active.lat], center) < 1.5) {
        const [x, y] = projection([active.lng, active.lat]);
        const label = active.name + ' · ' + active.count + (active.count > 1 ? ' unidades' : ' unidade');
        ctx.font = '600 13px Inter, system-ui, sans-serif';
        const pw = ctx.measureText(label).width + 24, ph = 28;
        const lx = Math.min(w - pw - 8, Math.max(8, x - pw / 2)), ly = y - 22 - ph;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(lx, ly, pw, ph, 14); else ctx.rect(lx, ly, pw, ph);
        ctx.fillStyle = '#ffffff'; ctx.fill();
        ctx.fillStyle = '#0d1a12'; ctx.textBaseline = 'middle'; ctx.fillText(label, lx + 12, ly + ph / 2 + 0.5);
      }
    };

    const loop = (now) => {
      raf = 0;
      if (tween) {
        const t = Math.min(1, (now - tween.start) / tween.duration);
        const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        const [lng, lat] = tween.path(e);
        view.lng = lng; view.lat = lat;
        // zoom geométrico (natural para aproximar); ao viajar longe, afasta no meio do caminho
        const zg = Math.exp(Math.log(tween.z0) + (Math.log(tween.z1) - Math.log(tween.z0)) * e);
        view.zoom = zg * (1 - Math.sin(Math.PI * e) * tween.dip);
        if (t === 1) { const done = tween.onDone; tween = null; if (done) done(); }
      }
      draw(now);
      if (tween || (visible && active && !reduceMotion)) raf = requestAnimationFrame(loop);
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };

    const flyTo = (lng, lat, zoom, opts = {}) => {
      if (reduceMotion) {
        view.lng = lng; view.lat = lat; view.zoom = zoom; tween = null; kick();
        if (opts.onDone) opts.onDone();
        return;
      }
      const dist = d3.geoDistance([view.lng, view.lat], [lng, lat]);
      tween = {
        start: performance.now(), duration: opts.duration || 900 + dist * 900,
        path: d3.geoInterpolate([view.lng, view.lat], [lng, lat]),
        z0: view.zoom, z1: zoom, dip: Math.min(0.75, dist * 1.6 * Math.max(1, view.zoom / 2)), onDone: opts.onDone,
      };
      kick();
    };

    // arrastar para girar (no toque só na horizontal, para não travar a rolagem da página)
    canvas.addEventListener('pointerdown', (e) => {
      dragging = { x: e.clientX, y: e.clientY, lng: view.lng, lat: view.lat, touch: e.pointerType === 'touch' };
      tween = null; canvas.setPointerCapture(e.pointerId); canvas.classList.add('is-dragging');
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const k = 0.35 / view.zoom;
      view.lng = dragging.lng - (e.clientX - dragging.x) * k;
      if (!dragging.touch) view.lat = Math.max(-75, Math.min(75, dragging.lat + (e.clientY - dragging.y) * k));
      kick();
    });
    const endDrag = () => { dragging = null; canvas.classList.remove('is-dragging'); };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);

    new ResizeObserver(resize).observe(canvas);
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !data) {
        fetch('assets/globo.json').then((r) => r.json()).then((d) => { data = d; kick(); }).catch(() => {});
      }
      if (visible) kick();
    }, { rootMargin: '300px 0px' }).observe(canvas);

    return {
      flyTo,
      setActive(city, zoom = 1.7, opts) { active = city; if (city) flyTo(city.lng, city.lat, zoom, opts); else kick(); },
      // mergulho até a cidade (zoom profundo) antes de mostrar o mapa de ruas
      dive(city, onDone) {
        active = city;
        const dist = d3.geoDistance([view.lng, view.lat], [city.lng, city.lat]);
        flyTo(city.lng, city.lat, 22, { duration: 1500 + dist * 1000, onDone });
        if (tween && view.zoom > 3) tween.dip = Math.max(tween.dip, 0.9);   // já perto: afasta e mergulha de novo
      },
    };
  };

  // ---------- Unidades: abas por estado + mapa ----------
  const unitsBox = document.querySelector('[data-units]');
  if (unitsBox) {
    const tabs = [...unitsBox.querySelectorAll('.units-tab')];
    const mapBox = unitsBox.querySelector('.units-map');
    const cardName = unitsBox.querySelector('[data-card-name]');
    const cardAddr = unitsBox.querySelector('[data-card-addr]');
    const cardRoute = unitsBox.querySelector('[data-card-route]');
    const cardWaze = unitsBox.querySelector('[data-card-waze]');
    const cardMaps = unitsBox.querySelector('[data-card-maps]');
    const cardContact = unitsBox.querySelector('[data-card-contact]');
    const cardReserve = unitsBox.querySelector('[data-card-reserve]');
    const street = unitsBox.querySelector('.units-street');
    const backBtn = unitsBox.querySelector('.units-back');
    let diveId = 0;
    const cardLogo = unitsBox.querySelector('[data-card-logo]');
    const setLogo = (unit) => {
      const img = cardLogo.querySelector('img');
      cardLogo.hidden = !unit.dataset.logo;
      cardLogo.classList.toggle('is-dark', 'logoDark' in unit.dataset);
      if (unit.dataset.logo) img.src = unit.dataset.logo; else img.removeAttribute('src');
      img.alt = unit.dataset.logoAlt || '';
    };

    // Cidades (nível de cidade) a partir das unidades, para os marcadores do globo
    const units = [...unitsBox.querySelectorAll('.unit')];
    // Celular: listas longas mostram 5 unidades e um botão para ver todas
    unitsBox.querySelectorAll('.units-list').forEach((list) => {
      const count = list.querySelectorAll('.unit').length;
      if (count <= 6) return;
      list.classList.add('is-collapsible');
      const li = document.createElement('li');
      li.className = 'units-more-item';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-light btn-lg btn-block';
      btn.textContent = `Ver todas as ${count} unidades`;
      btn.addEventListener('click', () => {
        list.classList.add('is-expanded');
        const next = list.children[5] && list.children[5].querySelector('.unit');
        if (next) next.focus({ preventScroll: true });
      });
      li.appendChild(btn);
      list.appendChild(li);
    });
    backBtn.addEventListener('click', () => {
      diveId++;
      mapBox.classList.remove('is-street');
      backBtn.hidden = true;
      const cur = units.find((u) => u.classList.contains('is-active'));
      if (globe && cur) globe.setActive(cityOf(cur), 1.7);
    });
    const cityMap = new Map();
    units.forEach((u) => {
      const name = u.dataset.city;
      if (!name) return;
      if (!cityMap.has(name)) cityMap.set(name, { name, lat: +u.dataset.lat, lng: +u.dataset.lng, count: 0 });
      cityMap.get(name).count++;
    });
    const cityOf = (u) => cityMap.get(u.dataset.city);
    const globe = createGlobe(unitsBox.querySelector('[data-globe]'), [...cityMap.values()]);

    const selectTab = (tab, focus) => {
      tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
      });
      if (focus) tab.focus();
    };
    tabs.forEach((tab, i) => {
      tab.tabIndex = tab.getAttribute('aria-selected') === 'true' ? 0 : -1;
      tab.addEventListener('click', () => {
        selectTab(tab);
        const first = document.getElementById(tab.getAttribute('aria-controls')).querySelector('.unit');
        if (first) show(first);
      });
      tab.addEventListener('keydown', (e) => {
        const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
        if (!step) return;
        e.preventDefault();
        selectTab(tabs[(i + step + tabs.length) % tabs.length], true);
      });
    });

    const show = (unit) => {
      const addr = unit.dataset.address;
      const q = encodeURIComponent(unit.dataset.query || addr);   // nome do lugar quando o endereço é genérico
      units.forEach((u) => { u.classList.toggle('is-active', u === unit); u.removeAttribute('aria-current'); });
      unit.setAttribute('aria-current', 'true');
      cardName.textContent = unit.dataset.name;
      cardAddr.textContent = addr;
      cardRoute.href = `https://www.google.com/maps/dir/?api=1&destination=${q}`;
      cardWaze.href = `https://waze.com/ul?q=${q}&navigate=yes`;
      if (cardMaps) cardMaps.href = `https://www.google.com/maps/search/?api=1&query=${q}`;
      setLogo(unit);
      if (cardContact) cardContact.hidden = unit.dataset.contact !== 'df';   // atendimento próprio de Brasília
      if (cardReserve) cardReserve.hidden = !unit.dataset.reserve;           // reserva antecipada (Casa Vereda)
      if (!globe) return;
      // zoom do globo até a cidade e, ao chegar, o mapa de ruas do endereço
      const id = ++diveId;
      mapBox.classList.remove('is-street');
      backBtn.hidden = true;
      // o mapa de ruas só aparece quando o mergulho termina E o mapa já carregou
      let arrived = false, loaded = false;
      const reveal = () => {
        if (id !== diveId || !arrived || !loaded) return;
        mapBox.classList.add('is-street');
        backBtn.hidden = false;
      };
      street.onload = () => { loaded = true; setTimeout(reveal, 250); };   // pequena folga para os blocos do mapa pintarem
      street.src = `https://www.google.com/maps?q=${q}&z=17&output=embed`;
      globe.dive(cityOf(unit), () => { arrived = true; reveal(); });
    };
    units.forEach((unit) => {
      unit.addEventListener('click', (e) => {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // abre o Google Maps em nova aba
        e.preventDefault();
        show(unit);
        if (window.innerWidth < 900) mapBox.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      });
    });
    if (units[0]) { units[0].classList.add('is-active'); units[0].setAttribute('aria-current', 'true'); setLogo(units[0]); if (globe) globe.setActive(cityOf(units[0]), 1.15); }
  }

  // ---------- Galeria em carrossel com parallax ----------
  // Faixa infinita movida por transform: arrastar com inércia, deslize lento automático,
  // acompanha a rolagem da página; a foto dentro de cada moldura corre em outra velocidade.
  const pgallery = document.querySelector('[data-pgallery]');
  if (pgallery && !reduceMotion) {
    const track = pgallery.querySelector('.pg-track');
    const originals = [...track.children];
    originals.forEach((el) => {
      const clone = el.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      clone.querySelector('img').alt = '';
      track.appendChild(clone);
    });
    pgallery.classList.add('is-enhanced');
    pgallery.scrollLeft = 0;

    const items = [...track.children];
    let setWidth = 0, boxW = 0, geo = [];
    const measure = () => {
      setWidth = items[originals.length].offsetLeft - items[0].offsetLeft;
      boxW = pgallery.clientWidth;
      geo = items.map((el) => ({ el, img: el.firstElementChild, left: el.offsetLeft, w: el.offsetWidth }));
    };

    let x = 0, vel = 0, dragging = null, hovering = false, visible = false, raf = 0, last = 0;
    let lastScrollY = window.scrollY;
    const AUTO = 22;                     // px/s de deslize automático
    const canHover = window.matchMedia('(hover: hover)').matches;
    let centerEl = null;
    const render = () => {
      x = ((x % setWidth) + setWidth) % setWidth;
      track.style.transform = `translate3d(${-x}px, 0, 0)`;
      let best = null, bestD = Infinity;
      for (const g of geo) {
        const center = g.left - x + g.w / 2;
        const d = Math.abs(center - boxW / 2);
        if (d < bestD) { bestD = d; best = g.el; }
        if (center < -g.w || center > boxW + g.w) continue;          // fora da tela
        const shift = Math.max(-0.028, Math.min(0.028, ((center - boxW / 2) / boxW) * -0.06)) * g.w;   // dentro da sobra de 3%
        g.img.style.setProperty('--px', `${shift.toFixed(1)}px`);
      }
      // no toque (sem mouse), a foto mais próxima do centro fica colorida
      if (!canHover && best !== centerEl) {
        if (centerEl) centerEl.classList.remove('is-center');
        if (best) best.classList.add('is-center');
        centerEl = best;
      }
    };
    const tick = (now) => {
      raf = 0;
      const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
      if (!dragging) {
        x += vel * dt;
        vel *= Math.pow(0.04, dt);                                   // inércia
        if (!hovering) x += AUTO * dt;
      }
      render();
      if (visible) raf = requestAnimationFrame(tick);
    };
    const start = () => { if (!raf) { last = 0; raf = requestAnimationFrame(tick); } };

    pgallery.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      dragging = { x: e.clientX, y: e.clientY, startX: x, t: performance.now(), lastX: e.clientX, axis: null };
      vel = 0;
    });
    pgallery.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - dragging.x, dy = e.clientY - dragging.y;
      if (!dragging.axis) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        dragging.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        if (dragging.axis === 'y') { dragging = null; return; }       // deixa a página rolar
        try { pgallery.setPointerCapture(e.pointerId); } catch (_) { /* ponteiro já liberado */ }
        pgallery.classList.add('is-dragging');
      }
      const now = performance.now();
      vel = ((dragging.lastX - e.clientX) / Math.max(1, now - dragging.t)) * 1000;
      dragging.lastX = e.clientX; dragging.t = now;
      x = dragging.startX - dx;
    });
    const endDrag = () => { dragging = null; pgallery.classList.remove('is-dragging'); };
    pgallery.addEventListener('pointerup', endDrag);
    pgallery.addEventListener('pointercancel', endDrag);
    pgallery.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') hovering = true; });
    pgallery.addEventListener('pointerleave', () => { hovering = false; });
    // trackpad / roda na horizontal
    pgallery.addEventListener('wheel', (e) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) { e.preventDefault(); x += e.deltaX; vel = 0; }
    }, { passive: false });
    // teclado
    pgallery.addEventListener('keydown', (e) => {
      const dir = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (!dir) return;
      e.preventDefault(); vel += dir * 1400;
    });
    // rolagem da página empurra a faixa
    window.addEventListener('scroll', () => {
      const dy = window.scrollY - lastScrollY; lastScrollY = window.scrollY;
      if (visible) x += dy * 0.35;
    }, { passive: true });

    new ResizeObserver(() => { measure(); render(); }).observe(pgallery);
    new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) start(); }).observe(pgallery);
    window.addEventListener('load', () => { measure(); render(); });
    measure(); render();
  }

  // ---------- Mensalistas: atendimento por região ----------
  const regionSwitch = document.querySelector('[data-region-switch]');
  if (regionSwitch) {
    const regTabs = [...regionSwitch.querySelectorAll('[role="tab"]')];
    const selectRegion = (tab, focus) => {
      regTabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
      });
      if (focus) tab.focus();
    };
    regTabs.forEach((tab, i) => {
      tab.addEventListener('click', () => selectRegion(tab));
      tab.addEventListener('keydown', (e) => {
        const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
        if (!step) return;
        e.preventDefault();
        selectRegion(regTabs[(i + step + regTabs.length) % regTabs.length], true);
      });
    });
    selectRegion(regTabs[0]);
  }

  // ---------- Vídeo de fundo do hero ----------
  // Horizontal ou vertical conforme a orientação; não baixa com economia de dados, 2G ou "reduzir movimento".
  const heroVideo = document.querySelector('[data-hero-video]');
  if (heroVideo) {
    const conn = navigator.connection || {};
    const skipVideo = reduceMotion || conn.saveData || /(^|-)2g$/.test(conn.effectiveType || '');
    if (!skipVideo) {
      const portrait = window.matchMedia('(orientation: portrait)');
      heroVideo.muted = true;
      const tryPlay = () => heroVideo.play().catch(() => {});
      const loadVideo = () => {
        const src = heroVideo.dataset[portrait.matches ? 'srcPortrait' : 'srcLandscape'];
        if (heroVideo.getAttribute('src') !== src) {
          heroVideo.classList.remove('is-playing');
          heroVideo.src = src;
        }
        tryPlay();
      };
      heroVideo.addEventListener('playing', () => heroVideo.classList.add('is-playing'));
      portrait.addEventListener('change', loadVideo);
      // começa depois da primeira pintura, para não disputar com o texto e a imagem do hero
      requestAnimationFrame(() => setTimeout(loadVideo, 0));
      new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) tryPlay(); else heroVideo.pause();
      }).observe(hero);
    }
  }

  // ---------- Janelas (reserva antecipada) ----------
  // Sem suporte a <dialog>, o link segue direto para a página de reserva.
  document.querySelectorAll('[data-modal-open]').forEach((opener) => {
    const modal = document.getElementById(opener.dataset.modalOpen);
    if (!modal || typeof modal.showModal !== 'function') return;
    opener.addEventListener('click', (e) => {
      e.preventDefault();
      modal.showModal();
      modal.returnFocusTo = opener;
    });
  });
  document.querySelectorAll('dialog.modal').forEach((modal) => {
    modal.querySelectorAll('[data-modal-close]').forEach((b) => b.addEventListener('click', () => modal.close()));
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.close(); });   // clique fora do cartão
    modal.addEventListener('close', () => { if (modal.returnFocusTo) modal.returnFocusTo.focus(); });
  });

  // ---------- Ano no rodapé ----------
  const year = document.querySelector('[data-year]');
  if (year) year.textContent = new Date().getFullYear();
})();
