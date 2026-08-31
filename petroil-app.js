// ============================================
// BARRA DE PROGRESO LÍQUIDA + RUTA ENERGÉTICA DINÁMICA
// Un solo cálculo de scroll alimenta: la barra líquida superior (con
// "desestabilización" al reanudar el movimiento y calma tras ~1s quieto),
// la compactación del header, y el llenado progresivo de los nodos/línea
// de la ruta de navegación (ya no se queda fijo en "Innovación").
// ============================================
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const siteHeader = document.getElementById('siteHeader');
const progressFill = document.getElementById('scrollProgress');
const routeLinksAll = document.querySelectorAll('.route-link[data-section], .drawer-link[data-section]');
const fillLineH = document.getElementById('routeFillLine');
const fillLineV = document.getElementById('routeFillLineV');

// Cada "parada" de la ruta se vincula a la sección real que debe vigilarse
// para el scroll-spy (data-section), que puede ser distinta del href de
// navegación real del enlace (ej. "¿Quiénes somos?" navega a
// quienes-somos.html, pero su avance se sigue contra el resumen "#nosotros"
// que sí existe en esta página).
const desktopStops = Array.from(document.querySelectorAll('#navLinks .route-link[data-section]'))
  .map(link => ({ link, target: document.querySelector(link.dataset.section), node: link.querySelector('.route-node') }))
  .filter(item => item.target && item.node);

const mobileStops = Array.from(document.querySelectorAll('.drawer-route .drawer-link[data-section]'))
  .map(link => ({ link, target: document.querySelector(link.dataset.section), node: link.querySelector('.drawer-node') }))
  .filter(item => item.target && item.node);

let desktopCenters = [];
let mobileCenters = [];
// Límites reales de la línea (inicio/fin), leídos directamente del CSS
// (::before) para no duplicar valores "a mano": son los tramos que antes
// no se usaban —antes de "Servicios" y después de "¿Quiénes somos?"— y que
// ahora también se iluminan, igual que la barra líquida superior.
let desktopEdges = null;
let mobileEdges = null;

function measureCenters(){
  const navLinksEl = document.getElementById('navLinks');
  if(navLinksEl && desktopStops.length){
    const containerRect = navLinksEl.getBoundingClientRect();
    desktopCenters = desktopStops.map(({ node }) => {
      const r = node.getBoundingClientRect();
      return (r.left + r.width / 2) - containerRect.left;
    });
    // Centro vertical real del primer nodo: la línea se posiciona con esto
    // (variable --route-line-y) para que atraviese los círculos en vez de
    // pasar entre el texto y el nodo, sin importar el grosor elegido en
    // el CSS ni el alto que ocupe la etiqueta.
    const firstNodeRect = desktopStops[0].node.getBoundingClientRect();
    const lineY = (firstNodeRect.top + firstNodeRect.height / 2) - containerRect.top;
    navLinksEl.style.setProperty('--route-line-y', lineY + 'px');
    const lineStyle = getComputedStyle(navLinksEl, '::before');
    const left = parseFloat(lineStyle.left) || 0;
    const right = parseFloat(lineStyle.right) || 0;
    desktopEdges = { start: left, end: containerRect.width - right };
  }
  const drawerRouteEl = document.querySelector('.drawer-route');
  if(drawerRouteEl && mobileStops.length){
    const containerRect = drawerRouteEl.getBoundingClientRect();
    mobileCenters = mobileStops.map(({ node }) => {
      const r = node.getBoundingClientRect();
      return (r.top + r.height / 2) - containerRect.top;
    });
    // Mismo criterio en vertical: centro horizontal real del primer nodo.
    const firstNodeRect = mobileStops[0].node.getBoundingClientRect();
    const lineX = (firstNodeRect.left + firstNodeRect.width / 2) - containerRect.left;
    drawerRouteEl.style.setProperty('--route-line-x', lineX + 'px');
    const lineStyle = getComputedStyle(drawerRouteEl, '::before');
    const top = parseFloat(lineStyle.top) || 0;
    const bottom = parseFloat(lineStyle.bottom) || 0;
    mobileEdges = { start: top, end: containerRect.height - bottom };
  }
}

let isSettled = true;
let lastScrollY = window.scrollY;
let settleTimer = null;
let scrollTicking = false;

function getScrollPercent(){
  const h = document.documentElement;
  const max = h.scrollHeight - h.clientHeight;
  if(max <= 0) return 0;
  return Math.min(100, Math.max(0, (h.scrollTop / max) * 100));
}

// Umbrales con histéresis: se activa el modo compacto al superar
// HEADER_COMPACT_ON y solo se desactiva al bajar de HEADER_COMPACT_OFF.
// La "zona muerta" entre ambos evita que, al llegar casi arriba del todo,
// pequeñas oscilaciones del scroll (inercia táctil, rueda del mouse,
// rubber-band en iOS) crucen un único umbral una y otra vez —eso era lo
// que hacía "temblar" el navbar: cada cruce reiniciaba a la mitad las
// transiciones de padding/alto del logo/sombra.
const HEADER_COMPACT_ON = 40;
const HEADER_COMPACT_OFF = 16;
let headerCompact = false;

function updateHeaderCompaction(){
  if(!siteHeader) return;
  const y = window.scrollY;
  if(!headerCompact && y > HEADER_COMPACT_ON) headerCompact = true;
  else if(headerCompact && y < HEADER_COMPACT_OFF) headerCompact = false;
  siteHeader.classList.toggle('navbar-scrolled', headerCompact);
}

function updateLiquidBar(pct, direction){
  if(!progressFill) return;
  progressFill.style.width = pct + '%';
  progressFill.classList.toggle('is-complete', pct >= 99.5);

  if(prefersReducedMotion) return;

  // El mismo pulso "de agua en movimiento" de la barra superior se aplica
  // también a las líneas de la ruta (escritorio y móvil), para que el
  // puntero que las recorre luzca igual mientras hay scroll activo.
  const liquidEls = [progressFill, fillLineH, fillLineV].filter(Boolean);
  liquidEls.forEach(el => {
    el.classList.add('is-scrolling');
    el.classList.remove('is-settled');
  });

  // El líquido solo se "desestabiliza" en el instante en que el movimiento
  // se reanuda después de haber estado quieto (no en cada evento de scroll).
  // El "squish" de la ola queda solo en la barra superior: en la ruta, los
  // tramos saltan de nodo en nodo y ese meneo se vería como un tirón.
  if(isSettled && direction){
    isSettled = false;
    progressFill.classList.remove('wobble-up', 'wobble-down');
    void progressFill.offsetWidth; // fuerza reflow para poder reiniciar la animación
    progressFill.classList.add(direction === 'down' ? 'wobble-down' : 'wobble-up');
  }

  clearTimeout(settleTimer);
  settleTimer = setTimeout(() => {
    isSettled = true;
    progressFill.classList.remove('wobble-up', 'wobble-down');
    liquidEls.forEach(el => {
      el.classList.remove('is-scrolling');
      el.classList.add('is-settled');
    });
  }, 1000);
}

// Calcula, para una lista ordenada de paradas (ya en el mismo orden en que
// aparecen en la página), cuánto se ha llenado cada tramo entre una parada
// y la siguiente. El líquido avanza de nodo en nodo exactamente cuando el
// scroll cruza esa sección real, nunca como una proporción genérica de
// toda la página.
function computeRouteState(stops, markerY){
  return stops.map(({ target }, i) => {
    const rect = target.getBoundingClientRect();
    let state = 'upcoming';
    if(rect.bottom <= markerY) state = 'passed';
    else if(rect.top <= markerY) state = 'current';

    // Fracción de avance del tramo que va DESDE esta parada HACIA la
    // siguiente (0 = aún no se llega a esta sección, 1 = ya se alcanzó
    // por completo el inicio de la siguiente sección).
    let segmentFraction = 0;
    const next = stops[i + 1];
    if(state === 'passed'){
      segmentFraction = 1;
    } else if(state === 'current' && next){
      const nextRect = next.target.getBoundingClientRect();
      const span = nextRect.top - rect.top;
      segmentFraction = span > 0 ? Math.min(1, Math.max(0, (markerY - rect.top) / span)) : 1;
    } else if(state === 'current'){
      segmentFraction = 1; // es la última parada: al alcanzarla, quedó "llena"
    }
    return { state, segmentFraction, rect };
  });
}

function applyRouteLine(stops, states, centers, fillLine, axisProp, markerY, edges){
  if(!fillLine || !centers.length || !edges) return;
  const lastIndex = centers.length - 1;
  const scrollY = window.scrollY;
  let endPx;

  if(states[0].state === 'upcoming'){
    // ANTES de "Servicios": igual que la barra superior, el trazo ya se
    // enciende antes de llegar, en proporción al scroll real que falta
    // para alcanzar esa sección (no es un valor fijo: se recalcula con la
    // posición absoluta real de la sección, así que se adapta si cambia el
    // contenido de más arriba).
    const firstRect = states[0].rect;
    const neededScroll = (firstRect.top + scrollY) - markerY;
    const fraction = neededScroll > 0 ? Math.min(1, Math.max(0, scrollY / neededScroll)) : 1;
    endPx = edges.start + fraction * (centers[0] - edges.start);
  } else if(states[lastIndex].state === 'passed'){
    // DESPUÉS de "¿Quiénes somos?": el trazo sigue llenándose con el resto
    // del scroll de la página hasta el final, en vez de quedarse fijo en
    // el último nodo como antes.
    const lastRect = states[lastIndex].rect;
    const startScroll = (lastRect.bottom + scrollY) - markerY;
    const doc = document.documentElement;
    const maxScroll = doc.scrollHeight - doc.clientHeight;
    const fraction = maxScroll > startScroll
      ? Math.min(1, Math.max(0, (scrollY - startScroll) / (maxScroll - startScroll)))
      : 1;
    endPx = centers[lastIndex] + fraction * (edges.end - centers[lastIndex]);
  } else {
    // Tramo intermedio (comportamiento original, sin cambios): el trazo
    // avanza de nodo en nodo exactamente cuando el scroll cruza esa
    // sección real, nunca como una simple proporción de toda la página.
    let progressIndex = 0;
    for(let i = 0; i < states.length; i++){
      if(states[i].state === 'passed'){ progressIndex = i + 1; continue; }
      if(states[i].state === 'current'){ progressIndex = i + states[i].segmentFraction; break; }
      break;
    }
    const clamped = Math.min(lastIndex, Math.max(0, progressIndex));
    const lowerIdx = Math.floor(clamped);
    const upperIdx = Math.min(lastIndex, lowerIdx + 1);
    const localFraction = clamped - lowerIdx;
    endPx = centers[lowerIdx] + (centers[upperIdx] - centers[lowerIdx]) * localFraction;
  }

  const startPx = edges.start;
  if(axisProp === 'width'){
    fillLine.style.left = startPx + 'px';
    fillLine.style.width = Math.max(0, endPx - startPx) + 'px';
  } else {
    fillLine.style.top = startPx + 'px';
    fillLine.style.height = Math.max(0, endPx - startPx) + 'px';
  }

  // "Choque" contra un círculo: mientras la punta cae dentro del radio
  // visual del nodo, la gota Y el círculo se ponen verde-lima juntos (ver
  // .at-node en el CSS). Es UN solo cálculo (posición en píxeles) el que
  // manda sobre ambos elementos a la vez, para que nunca queden
  // desincronizados —antes el círculo dependía del umbral de scroll-spy
  // (current/passed) y la gota de la cercanía en píxeles, y podían
  // desfasarse por un instante durante el scroll suave del clic—.
  const NODE_HIT_TOLERANCE = 8; // px, ~radio real del círculo renderizado
  const atNodeIndex = centers.findIndex(c => Math.abs(endPx - c) <= NODE_HIT_TOLERANCE);
  fillLine.classList.toggle('at-node', atNodeIndex !== -1);
  stops.forEach(({ link }, i) => {
    link.classList.toggle('at-node', i === atNodeIndex);
  });
}

function updateRouteFill(){
  const markerY = window.innerHeight * 0.35;
  if(desktopStops.length){
    const states = computeRouteState(desktopStops, markerY);
    desktopStops.forEach(({ link }, i) => {
      link.classList.remove('passed', 'current');
      link.removeAttribute('aria-current');
      if(states[i].state === 'passed') link.classList.add('passed');
      else if(states[i].state === 'current'){ link.classList.add('current'); link.setAttribute('aria-current', 'page'); }
    });
    applyRouteLine(desktopStops, states, desktopCenters, fillLineH, 'width', markerY, desktopEdges);
  }
  if(mobileStops.length){
    const states = computeRouteState(mobileStops, markerY);
    mobileStops.forEach(({ link }, i) => {
      link.classList.remove('passed', 'current');
      link.removeAttribute('aria-current');
      if(states[i].state === 'passed') link.classList.add('passed');
      else if(states[i].state === 'current'){ link.classList.add('current'); link.setAttribute('aria-current', 'page'); }
    });
    applyRouteLine(mobileStops, states, mobileCenters, fillLineV, 'height', markerY, mobileEdges);
  }
}

function onScroll(){
  const currentY = window.scrollY;
  const direction = currentY > lastScrollY ? 'down' : currentY < lastScrollY ? 'up' : null;
  lastScrollY = currentY;

  const pct = getScrollPercent();
  updateHeaderCompaction();
  updateLiquidBar(pct, direction);
  updateRouteFill();
  scrollTicking = false;
}

window.addEventListener('scroll', () => {
  if(!scrollTicking){
    window.requestAnimationFrame(onScroll);
    scrollTicking = true;
  }
}, { passive: true });

window.addEventListener('resize', () => {
  measureCenters();
  updateRouteFill();
});

// Limpia el nombre de la animación de "desestabilización" al terminar, para
// que pueda volver a dispararse en el siguiente ciclo de movimiento.
if(progressFill){
  progressFill.addEventListener('animationend', (e) => {
    if(e.animationName === 'liquidWobbleDown' || e.animationName === 'liquidWobbleUp'){
      progressFill.classList.remove('wobble-down', 'wobble-up');
    }
  });
}

// Estado inicial (por si la página carga ya desplazada, ej. con un ancla)
measureCenters();
onScroll();

// Las fuentes y ciertos estilos pueden terminar de asentarse después de la
// carga inicial del script; se vuelve a medir para que la línea de la ruta
// quede perfectamente alineada con los nodos.
window.addEventListener('load', () => {
  measureCenters();
  updateRouteFill();
});

// Pequeño "ping" visual sobre el nodo al hacer clic en un tramo de la ruta
if(!prefersReducedMotion){
  routeLinksAll.forEach(link => {
    link.addEventListener('click', () => {
      link.classList.remove('pulse');
      void link.offsetWidth;
      link.classList.add('pulse');
      setTimeout(() => link.classList.remove('pulse'), 550);
    });
  });
}

// Reveal on scroll
const revealEls = document.querySelectorAll('.reveal');
if(revealEls.length){
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in'); });
  }, { threshold: .15 });
  revealEls.forEach(el => io.observe(el));
}

// Language dropdown — soporta varias instancias (franja superior de escritorio
// y pie del drawer móvil) sin duplicar lógica.
const langSelects = document.querySelectorAll('.lang-select');
if(langSelects.length){
  langSelects.forEach(select => {
    const btn = select.querySelector('.lang-btn');
    if(!btn) return;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = select.classList.toggle('open');
      btn.setAttribute('aria-expanded', String(isOpen));
      langSelects.forEach(other => {
        if(other !== select){
          other.classList.remove('open');
          other.querySelector('.lang-btn')?.setAttribute('aria-expanded', 'false');
        }
      });
    });
  });
  document.addEventListener('click', (e) => {
    langSelects.forEach(select => {
      if(select.classList.contains('open') && !select.contains(e.target)){
        select.classList.remove('open');
        select.querySelector('.lang-btn')?.setAttribute('aria-expanded', 'false');
      }
    });
  });
}

// Menú móvil: drawer lateral ("Petroil Energy Route") con overlay, cierre por
// Escape/overlay/X/selección de enlace, focus trap, bloqueo de scroll del
// body y limpieza de estados al volver a escritorio.
const hamburger = document.getElementById('hamburger');
const navDrawer = document.getElementById('navDrawer');
const navOverlay = document.getElementById('navOverlay');
const drawerClose = document.getElementById('drawerClose');

if(hamburger && navDrawer && navOverlay){
  let lastFocused = null;

  const getFocusable = () => Array.from(
    navDrawer.querySelectorAll('a[href], button:not([disabled])')
  );

  function onDrawerKeydown(e){
    if(e.key === 'Escape'){
      e.preventDefault();
      closeDrawer();
      return;
    }
    if(e.key === 'Tab'){
      const focusables = getFocusable();
      if(!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if(e.shiftKey && document.activeElement === first){
        e.preventDefault(); last.focus();
      } else if(!e.shiftKey && document.activeElement === last){
        e.preventDefault(); first.focus();
      }
    }
  }

  function openDrawer(){
    lastFocused = document.activeElement;
    navDrawer.classList.add('open');
    navOverlay.classList.add('open');
    hamburger.classList.add('active');
    hamburger.setAttribute('aria-expanded', 'true');
    hamburger.setAttribute('aria-label', 'Cerrar menú');
    navDrawer.setAttribute('aria-hidden', 'false');
    document.body.classList.add('nav-drawer-open');
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onDrawerKeydown);
    const focusables = getFocusable();
    if(focusables.length) focusables[0].focus();
  }

  function closeDrawer(){
    navDrawer.classList.remove('open');
    navOverlay.classList.remove('open');
    hamburger.classList.remove('active');
    hamburger.setAttribute('aria-expanded', 'false');
    hamburger.setAttribute('aria-label', 'Abrir menú');
    navDrawer.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('nav-drawer-open');
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onDrawerKeydown);
    if(lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  }

  hamburger.addEventListener('click', () => {
    if(navDrawer.classList.contains('open')) closeDrawer(); else openDrawer();
  });
  drawerClose?.addEventListener('click', closeDrawer);
  navOverlay.addEventListener('click', closeDrawer);
  navDrawer.querySelectorAll('.drawer-link').forEach(a => a.addEventListener('click', closeDrawer));

  // Si el usuario redimensiona la ventana hacia escritorio con el drawer
  // abierto, se cierra y se limpian todos los estados (scroll, aria, foco).
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if(window.innerWidth > 720 && navDrawer.classList.contains('open')) closeDrawer();
    }, 150);
  });
}

// Hero particles (aire que asciende)
const particleHost = document.getElementById('heroParticles');
if(particleHost){
  const n = 22;
  for(let i=0;i<n;i++){
    const p = document.createElement('span');
    p.className = 'particle';
    const size = 4 + Math.random()*10;
    p.style.width = size+'px';
    p.style.height = size+'px';
    p.style.left = Math.random()*100+'%';
    p.style.animationDuration = (7 + Math.random()*8)+'s';
    p.style.animationDelay = (Math.random()*10)+'s';
    particleHost.appendChild(p);
  }
}

// Footer map tabs
const mapFrame = document.getElementById('mapFrame');
const gmapsLink = document.getElementById('gmapsLink');
const maps = {
  bogota: {
    src: "https://www.openstreetmap.org/export/embed.html?bbox=-74.0443%2C4.6803%2C-74.0243%2C4.7003&layer=mapnik&marker=4.6903%2C-74.0343",
    gmaps: "https://www.google.com/maps/search/?api=1&query=Torre+Empresarial+Pacific+Calle+110+%239-25+Bogota"
  },
  santamarta: {
    src: "https://www.openstreetmap.org/export/embed.html?bbox=-74.1806%2C11.2195%2C-74.1606%2C11.2395&layer=mapnik&marker=11.2295%2C-74.1706",
    gmaps: "https://www.google.com/maps/search/?api=1&query=Carrera+57A+%2330-399+Mamatoco+Santa+Marta"
  }
};
if(mapFrame){
  document.querySelectorAll('.map-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.map-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const key = tab.dataset.map;
      mapFrame.src = maps[key].src;
      gmapsLink.href = maps[key].gmaps;
    });
  });
}

// Chat widget — AIRA, asistente virtual de Petroil
const chatLauncher = document.getElementById('chatLauncher');
const chatPanel = document.getElementById('chatPanel');
const chatClose = document.getElementById('chatClose');
const chatLog = document.getElementById('chatLog');
if(chatLauncher){
  const LABEL_OPEN = 'Abrir chat con AIRA, asistente virtual de Petroil';
  const LABEL_CLOSE = 'Cerrar chat con AIRA';

  chatLauncher.addEventListener('click', () => {
    const isOpen = chatPanel.classList.toggle('open');
    chatLauncher.setAttribute('aria-label', isOpen ? LABEL_CLOSE : LABEL_OPEN);
  });
  chatClose.addEventListener('click', () => {
    chatPanel.classList.remove('open');
    chatLauncher.setAttribute('aria-label', LABEL_OPEN);
  });

  const answers = {
    productos: "Producimos combustibles industriales, marinos y para minería como Petroil 40 A MAX, Petroil 90 Gasolina Premium, Petroil 300 VLSFO, entre otros. Puedes ver el listado completo en la sección Productos.",
    ubicacion: "Nuestra oficina comercial está en la Torre Empresarial Pacífic, Bogotá, y nuestra refinería en el sector Mamatoco, Santa Marta. Puedes verlas en el mapa del footer.",
    certificaciones: "Contamos con la trinorma ISO 9001 (Calidad), ISO 45001 (Seguridad y Salud en el Trabajo) e ISO 14001 (Gestión Ambiental).",
    asesor: "Con gusto. Te comparto el botón de WhatsApp abajo para hablar directamente con un asesor comercial."
  };

  function addMsg(text, who){
    const div = document.createElement('div');
    div.className = 'msg ' + who;
    div.textContent = text;
    chatLog.appendChild(div);
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  document.querySelectorAll('.quick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      addMsg(btn.textContent, 'user');
      setTimeout(() => addMsg(answers[btn.dataset.q], 'bot'), 400);
    });
  });
}

// Product videos: se reproducen con el cursor (desktop) o con el toque (móvil).
// El resto del tiempo se ve la imagen (.product-poster).
const productVideos = document.querySelectorAll('.product-video');
if(productVideos.length){

  // Precarga anticipada: en cuanto la tarjeta está por entrar en pantalla
  // (600px antes), empezamos a descargar el video en segundo plano, para que
  // cuando el usuario realmente llegue a esa tarjeta ya esté listo y no haya
  // demora al reproducirlo (evita el "stutter" inicial en desktop).
  const preloadObserver = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if(entry.isIntersecting){
        const v = entry.target;
        v.preload = 'auto';
        v.load();
        obs.unobserve(v);
      }
    });
  }, { rootMargin: '600px 0px', threshold: 0 });

  // Pausa automática cuando la tarjeta sale de pantalla (ahorra batería/datos,
  // sobre todo en móvil donde el video puede quedar reproduciéndose de fondo).
  const visibilityObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => { if(!entry.isIntersecting) entry.target.pause(); });
  }, { threshold: 0 });

  productVideos.forEach(v => {
    v.pause(); // por si el navegador intenta arrancarlo solo
    preloadObserver.observe(v);
    visibilityObserver.observe(v);

    const card = v.closest('.product-card');
    if(!card) return;

    function playVideo(){
      try { v.currentTime = 0; } catch(e) { /* aún sin metadata cargada, se ignora */ }
      const p = v.play();
      if(p && typeof p.catch === 'function') p.catch(() => { /* autoplay bloqueado, sigue la imagen */ });
    }
    function pauseVideo(){ v.pause(); }

    // Desktop: mouse y teclado
    card.addEventListener('mouseenter', playVideo);
    card.addEventListener('mouseleave', pauseVideo);
    // Accesibilidad: la tarjeta es un <a>, navegable con teclado
    card.addEventListener('focus', playVideo);
    card.addEventListener('blur', pauseVideo);

    // Móvil: muchos navegadores activan el estado :hover del CSS con el
    // primer toque (por eso la imagen ya se ocultaba y el video "aparecía"),
    // pero nadie llamaba a .play(). Con este listener, el toque también
    // dispara la reproducción real, evitando la pantalla en blanco.
    card.addEventListener('touchstart', playVideo, { passive: true });
  });
}

// PQRSF: selector visual de tipo + envío con panel de éxito y radicado (solo existe en pqrsf.html)
const pqrsfForm = document.getElementById('pqrsfForm');
const toast = document.getElementById('toast');

document.querySelectorAll('.pqrsf-type-card input[type="radio"]').forEach(input => {
  input.addEventListener('change', () => {
    document.querySelectorAll('.pqrsf-type-card').forEach(card => card.classList.remove('selected'));
    input.closest('.pqrsf-type-card').classList.add('selected');
  });
});

if(pqrsfForm){
  const successPanel = document.getElementById('pqrsfSuccess');
  const radicadoEl = document.getElementById('pqrsfRadicado');
  const resetBtn = document.getElementById('pqrsfReset');

  pqrsfForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const year = new Date().getFullYear();
    const folio = String(Math.floor(100000 + Math.random() * 899999));
    if(radicadoEl) radicadoEl.textContent = `PQR-${year}-${folio}`;
    pqrsfForm.style.display = 'none';
    if(successPanel) successPanel.classList.add('show');
    if(toast){
      toast.textContent = 'Solicitud de ejemplo registrada correctamente. (Formulario de demostración)';
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 3800);
    }
  });

  if(resetBtn){
    resetBtn.addEventListener('click', () => {
      pqrsfForm.reset();
      document.querySelectorAll('.pqrsf-type-card').forEach(card => card.classList.remove('selected'));
      if(successPanel) successPanel.classList.remove('show');
      pqrsfForm.style.display = '';
    });
  }
}

// TOC active state (páginas de artículo largo)
const tocLinks = document.querySelectorAll('.toc a');
if(tocLinks.length){
  const targets = Array.from(tocLinks).map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);
  const tocObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if(entry.isIntersecting){
        tocLinks.forEach(l => l.classList.remove('active'));
        const match = document.querySelector('.toc a[href="#'+entry.target.id+'"]');
        if(match) match.classList.add('active');
      }
    });
  }, { rootMargin: '-20% 0px -70% 0px' });
  targets.forEach(t => tocObserver.observe(t));
}

// ============================================
// CURSOR PERSONALIZADO — gota de agua con resplandor
// Añade un <div class="cursor-drop-wrap"> (gota SVG + resplandor) que sigue
// el puntero con una inercia mínima (lerp alto) calculada en
// requestAnimationFrame. El cursor nativo del sistema NUNCA se oculta; todo
// el conjunto es decorativo, con pointer-events:none, por lo que no puede
// interferir con clics, foco ni con el comportamiento normal de la página.
//
// Se desactiva por completo (no se crea ningún elemento ni se registra
// ningún listener) en dos casos, reutilizando "prefersReducedMotion" ya
// calculado al inicio de este archivo:
//   1) prefers-reduced-motion: reduce
//   2) dispositivos sin puntero fino (táctiles), detectados con
//      matchMedia('(hover: hover) and (pointer: fine)') — más fiable que
//      revisar 'ontouchstart' en window, ya que varios portátiles táctiles
//      sí tienen puntero fino y sí deben conservar el efecto.
// ============================================
(function initCustomCursor(){
  const supportsFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if(prefersReducedMotion || !supportsFinePointer) return;

  const wrap = document.createElement('div');
  wrap.className = 'cursor-drop-wrap';
  wrap.setAttribute('aria-hidden', 'true');
  wrap.innerHTML =
    '<div class="cursor-glow"></div>' +
    '<div class="cursor-drop">' +
      '<svg viewBox="0 0 24 28" xmlns="http://www.w3.org/2000/svg">' +
        '<path class="cursor-drop-path" d="M12 1C12 1 2.5 14 2.5 19.5A9.5 9.5 0 0012 29a9.5 9.5 0 009.5-9.5C21.5 14 12 1 12 1z"/>' +
      '</svg>' +
    '</div>';
  document.body.appendChild(wrap);

  // Elementos "interactivos": la gota crece y el resplandor se intensifica
  // sobre ellos (botones, enlaces, tarjetas clicables, controles de la ruta
  // de navegación, tabs del mapa, checkboxes/radios del PQRSF...).
  const GROW_SELECTOR = [
    'a', 'button', '[role="button"]',
    '.product-card', '.pillar-card', '.use-card', '.stat-card', '.news-card',
    '.doc-card', '.commit-card', '.pqrsf-type-card', '.pds-side-card', '.pds-visual-card',
    '.route-link', '.drawer-link', '.map-tab', '.lang-btn', '.quick-btn', '.hamburger',
    'input[type="checkbox"]', 'input[type="radio"]', 'input[type="submit"]'
  ].join(', ');

  // Elementos de texto y formulario: la gota se oculta para no estorbar la
  // lectura ni el cursor de texto (I-beam) nativo del navegador.
  const HIDE_SELECTOR = [
    'input:not([type="checkbox"]):not([type="radio"]):not([type="submit"])',
    'textarea', 'select', '[contenteditable="true"]',
    'p', 'li', 'h1', 'h2', 'h3', 'h4', 'span', 'label'
  ].join(', ');

  let mouseX = 0, mouseY = 0;
  let posX = 0, posY = 0;
  let tilt = 0;
  let rafId = null;
  let visible = false;
  const dropEl = wrap.querySelector('.cursor-drop');

  function render(){
    // Suavizado por interpolación lineal, con un factor alto (0.42) para
    // que la gota alcance al puntero real casi de inmediato: se percibe
    // mucho menos "delay" que un seguimiento con lerp bajo, pero conserva
    // un mínimo de inercia para que no se sienta clavada al puntero.
    //
    // ¿Cómo ajustar la velocidad de seguimiento (el "delay")?
    //   -> Sube este 0.42 (máx. ~1) para que la gota alcance el puntero
    //      casi sin retraso; bájalo (ej. 0.15) para más inercia/flotación.
    const dx = mouseX - posX;
    const dy = mouseY - posY;
    posX += dx * 0.62;
    posY += dy * 0.62;

    // Balanceo lateral según la velocidad horizontal: refuerza la
    // sensación de "gota líquida" en movimiento.
    //
    // ¿Cómo ajustar qué tan marcado es el balanceo?
    //   1) TILT_SENSITIVITY -> multiplica el desplazamiento horizontal (dx).
    //      Súbelo para que un mismo movimiento del mouse incline mucho más
    //      la gota; bájalo para un balanceo más discreto.
    //   2) TILT_MAX -> el ángulo máximo (en grados) que puede inclinarse
    //      la gota, hacia cada lado. Súbelo para permitir giros más
    //      dramáticos; bájalo para limitar la inclinación.
    //   3) El 0.5 al final de "tilt += (targetTilt - tilt) * 0.5" controla
    //      qué tan rápido reacciona la inclinación al movimiento: más alto
    //      = respuesta más inmediata y "nerviosa"; más bajo = balanceo más
    //      suave y con más rebote.
    const TILT_SENSITIVITY = 6.4;
    const TILT_MAX = 92;
    const targetTilt = Math.max(-TILT_MAX, Math.min(TILT_MAX, dx * TILT_SENSITIVITY));
    tilt += (targetTilt - tilt) * 0.5;

    wrap.style.transform = 'translate3d(' + posX + 'px, ' + posY + 'px, 0)';
    dropEl.style.transform = 'rotate(' + tilt.toFixed(1) + 'deg)';
    rafId = requestAnimationFrame(render);
  }

  function handlePointerMove(e){
    mouseX = e.clientX;
    mouseY = e.clientY;
    if(!visible){
      visible = true;
      posX = mouseX; posY = mouseY; // evita que "viaje" desde la esquina la primera vez
      wrap.style.transform = 'translate3d(' + posX + 'px, ' + posY + 'px, 0)';
      wrap.classList.add('is-visible');
    }
    const growTarget = e.target.closest(GROW_SELECTOR);
    const hideTarget = !growTarget && e.target.closest(HIDE_SELECTOR);
    wrap.classList.toggle('is-grow', !!growTarget);
    wrap.classList.toggle('is-hidden', !!hideTarget);
  }

  window.addEventListener('pointermove', handlePointerMove, { passive: true });

  // Oculta el conjunto si el puntero sale de la ventana (ej. hacia la barra
  // de pestañas) y lo restaura al volver a entrar, evitando que quede
  // "flotando" sobre un punto obsoleto.
  document.addEventListener('mouseleave', () => {
    wrap.classList.remove('is-visible');
    visible = false;
  });

  // Pequeña "salpicadura" al hacer clic: un anillo que se expande y se
  // desvanece en el punto exacto del clic, en línea con el motivo líquido
  // ya presente en el sitio (barra de progreso líquida). Se limita a
  // clics con el botón principal para no dispararse en cada scroll táctil
  // ni en clics secundarios.
  function spawnSplash(x, y){
    const splash = document.createElement('div');
    splash.className = 'cursor-splash';
    // Importante: la posición se fija con left/top (no con transform),
    // porque la animación CSS de la salpicadura también anima "transform"
    // (para el escalado) y lo sobrescribiría por completo, haciendo que
    // la salpicadura "desaparezca" en la esquina superior izquierda.
    splash.style.left = x + 'px';
    splash.style.top = y + 'px';
    document.body.appendChild(splash);
    splash.addEventListener('animationend', () => splash.remove(), { once: true });
  }
  window.addEventListener('pointerdown', (e) => {
    if(e.button === 0 && e.pointerType !== 'touch') spawnSplash(e.clientX, e.clientY);
  });

  // Ahorro de batería/CPU: se detiene el bucle de animación cuando la
  // pestaña no está visible, y se retoma solo si ya hubo movimiento real
  // del puntero en esta página.
  document.addEventListener('visibilitychange', () => {
    if(document.hidden){
      if(rafId) cancelAnimationFrame(rafId);
      rafId = null;
    } else if(!rafId){
      rafId = requestAnimationFrame(render);
    }
  });

  rafId = requestAnimationFrame(render);
})();
