// Scroll progress (barra de flujo, elemento de firma del sitio)
const progressBar = document.getElementById('scrollProgress');
if(progressBar){
  window.addEventListener('scroll', () => {
    const h = document.documentElement;
    const pct = (h.scrollTop) / (h.scrollHeight - h.clientHeight) * 100;
    progressBar.style.width = pct + '%';
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

// Language dropdown
const langSelect = document.getElementById('langSelect');
if(langSelect){
  document.getElementById('langBtn').addEventListener('click', () => langSelect.classList.toggle('open'));
  document.addEventListener('click', (e) => { if (!langSelect.contains(e.target)) langSelect.classList.remove('open'); });
}

// Mobile menu
const hamburger = document.getElementById('hamburger');
const navLinks = document.getElementById('navLinks');
if(hamburger && navLinks){
  hamburger.addEventListener('click', () => navLinks.classList.toggle('open'));
  navLinks.querySelectorAll('a').forEach(a => a.addEventListener('click', () => navLinks.classList.remove('open')));
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

// Chat widget
const chatLauncher = document.getElementById('chatLauncher');
const chatPanel = document.getElementById('chatPanel');
const chatClose = document.getElementById('chatClose');
const chatLog = document.getElementById('chatLog');
if(chatLauncher){
  chatLauncher.addEventListener('click', () => chatPanel.classList.toggle('open'));
  chatClose.addEventListener('click', () => chatPanel.classList.remove('open'));

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
