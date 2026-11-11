// Kasus 12 — simulasi ukuran gambar
const frame = document.getElementById('frame');
const label = document.getElementById('frameLabel');
const caption = document.getElementById('frameCaption');
const miniRect = document.getElementById('miniRect');
const sizeButtons = [...document.querySelectorAll('.sizes button')];

const CAPTIONS = {
  LS: 'Seluruh tubuh dan ruangan terlihat. Wajah hanya beberapa piksel — senyum dan air mata hilang, latar justru jadi pusat perhatian.',
  MS: 'Pinggang ke atas. Bahasa tubuh terbaca, tetapi ekspresi wajah masih terlalu samar untuk menahan emosi adegan.',
  CU: 'Dagu sampai atas kepala. Senyum dan mata mulai menjadi pusat perhatian; latar berhenti mengganggu.',
  BCU: 'Mata dan pipi memenuhi layar. Air mata dan getaran kelopak mata terbaca — momen paling emosional dibesarkan.'
};

const LENS = { LS: '24 mm', MS: '50 mm', CU: '85 mm', BCU: '135 mm' };
const lensReadout = document.getElementById('lensReadout');

// face position inside frame.jpg; every crop is centred there
const ORIGIN = { x: 50.7, y: 23.5 };

function setSize(button) {
  const scale = Number(button.dataset.scale);
  const code = button.dataset.code;
  // keep the face centred: translate the crop's top-left corner to the frame edge
  frame.style.transform =
    `translate(${-(scale * ORIGIN.x - 50)}%, ${-(scale * ORIGIN.y - 50)}%) scale(${scale})`;
  label.textContent = code;
  caption.textContent = CAPTIONS[code];
  lensReadout.textContent = `${LENS[code]} · f/2.0 · eye level`;
  sizeButtons.forEach(b => b.setAttribute('aria-pressed', String(b === button)));

  const side = 100 / scale;
  miniRect.style.width = side + '%';
  miniRect.style.height = side + '%';
  miniRect.style.left = (ORIGIN.x - side / 2) + '%';
  miniRect.style.top = (ORIGIN.y - side / 2) + '%';
}

sizeButtons.forEach(b => b.addEventListener('click', () => setSize(b)));
setSize(sizeButtons.find(b => b.getAttribute('aria-pressed') === 'true') || sizeButtons[2]);

// Kasus 9 — konsol mixing
let updateScopeStatus = null;
let ensureAudioContext = null;
const playBtn = document.getElementById('playBtn');
const dialogFader = document.getElementById('dialogFader');
const musicFader = document.getElementById('musicFader');
const dialogOut = document.getElementById('dialogOut');
const musicOut = document.getElementById('musicOut');
const duckToggle = document.getElementById('duckToggle');
const verdict = document.getElementById('verdict');
const dialogMeter = document.getElementById('dialogMeter');
const musicMeter = document.getElementById('musicMeter');
const timecode = document.getElementById('timecode');

const LINES = [
  'Aku diterima. Beasiswanya turun, Bu.',
  'Aku masih tidak percaya.',
  'Semua kerja keras itu ternyata dihargai.',
  'Terima kasih sudah percaya padaku.'
];

const dbToGain = db => Math.pow(10, db / 20);
const fmt = db => (db === 0 ? '0 dB' : '−' + Math.abs(db) + ' dB');

const audioEl = new Audio('assets/music.mp3');
audioEl.loop = true;
let playing = false;
let speaking = false;
let ducked = false;
let lineIndex = 0;
let startedAt = 0;
let ticker = null;

let dialogDb = 0;
let musicDb = -4;

dialogFader.addEventListener('input', () => {
  dialogDb = Number(dialogFader.value);
  dialogOut.textContent = fmt(dialogDb);
  updateMeters();
});

musicFader.addEventListener('input', () => {
  musicDb = Number(musicFader.value);
  musicOut.textContent = fmt(musicDb);
  updateMeters();
});

function effectiveMusicDb() {
  return ducked ? Math.max(-40, musicDb - 12) : musicDb;
}

function updateMeters() {
  dialogMeter.style.width = Math.max(0, ((dialogDb + 30) / 30) * 100) + '%';
  musicMeter.style.width = Math.max(0, ((effectiveMusicDb() + 30) / 30) * 100) + '%';

  const gap = effectiveMusicDb() - dialogDb; // 0 means both equally loud
  if (gap > -6) {
    verdict.textContent = 'dialog tertutup musik';
    verdict.dataset.state = 'bad';
  } else if (gap > -12) {
    verdict.textContent = 'masih berkelahi';
    verdict.dataset.state = 'mid';
  } else {
    verdict.textContent = 'seimbang — dialog jelas';
    verdict.dataset.state = 'good';
  }
  updateScopeStatus && updateScopeStatus();
}

function speakNext() {
  if (!playing || !window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(LINES[lineIndex % LINES.length]);
  lineIndex++;
  u.lang = 'id-ID';
  u.rate = 0.96;
  u.volume = dbToGain(dialogDb);

  const idVoice = speechSynthesis.getVoices().find(v => v.lang && v.lang.toLowerCase().startsWith('id'));
  if (idVoice) u.voice = idVoice;

  u.onstart = () => {
    speaking = true;
    ducked = duckToggle.checked;
    applyMusicGain();
    updateMeters();
  };
  u.onend = () => {
    speaking = false;
    ducked = false;
    applyMusicGain();
    updateMeters();
    if (playing) setTimeout(speakNext, 380);
  };
  u.onerror = u.onend;

  speechSynthesis.speak(u);
}

function applyMusicGain() {
  audioEl.volume = dbToGain(effectiveMusicDb());
}

function toggle() {
  if (playing) {
    playing = false;
    audioEl.pause();
    window.speechSynthesis && speechSynthesis.cancel();
    speaking = false;
    ducked = false;
    clearInterval(ticker);
    playBtn.textContent = '▶ Putar';
    playBtn.setAttribute('aria-pressed', 'false');
    updateMeters();
    return;
  }

  ensureAudioContext && ensureAudioContext();
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  playing = true;
  playBtn.textContent = '❚❚ Jeda';
  playBtn.setAttribute('aria-pressed', 'true');
  startedAt = Date.now() - startedAt;
  audioEl.play();
  applyMusicGain();
  speakNext();
  updateMeters();
  clearInterval(ticker);
  ticker = setInterval(() => {
    const s = Math.floor((Date.now() - startedAt) / 1000);
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    timecode.textContent = `00:${mm}:${ss}`;
  }, 250);
}

playBtn.addEventListener('click', toggle);
duckToggle.addEventListener('change', () => {
  ducked = duckToggle.checked && speaking;
  applyMusicGain();
  updateMeters();
});

if (window.speechSynthesis) speechSynthesis.getVoices(); // warm up the voice list
updateMeters();

// Motion layer: one entrance per section, skipped for reduced motion.
// Guarded so the page still works fully if the CDN is unreachable.
if (window.gsap && window.ScrollTrigger) {
  gsap.registerPlugin(ScrollTrigger);
  const mm = gsap.matchMedia();
  mm.add({ reduce: '(prefers-reduced-motion: reduce)', fine: '(prefers-reduced-motion: no-preference)' }, ctx => {
    if (ctx.conditions.reduce) return;

    // Viewfinder camera monitor boot sequence
    const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });

    tl.from('.hero .vf-c', {
      scale: 0.6,
      autoAlpha: 0,
      duration: 0.45,
      stagger: 0.04
    })
    .from('.hero .hud-item, .hero .badge, .hero .vf-grid, .hero .vf-crosshair', {
      autoAlpha: 0,
      duration: 0.4,
      stagger: 0.025
    }, '-=0.2')
    .from('.hero-text h1', {
      y: 20,
      autoAlpha: 0,
      duration: 0.7
    }, '-=0.15')
    .from('.hero-text .lead', {
      y: 18,
      autoAlpha: 0,
      duration: 0.6
    }, '-=0.45')
    .from('.hero-nav .cine-action', {
      y: 16,
      autoAlpha: 0,
      duration: 0.5,
      stagger: 0.1
    }, '-=0.35');

    document.querySelectorAll('.case, .summary').forEach(sec => {
      gsap.from(sec.querySelectorAll('.case-side > *, .framing, .mixer, .answers .qa, .note, .summary > *'), {
        y: 24,
        autoAlpha: 0,
        duration: 0.6,
        ease: 'power2.out',
        stagger: 0.07,
        scrollTrigger: { trigger: sec, start: 'top 75%', once: true }
      });
    });
  });
}
// ==========================================
// 1. Cinematography: 3D Optical Lens Parallax (Hero)
// ==========================================
function initHeroLensParallax() {
  const canvas = document.getElementById('heroLensCanvas');
  const heroSec = document.getElementById('top');
  if (!canvas || !heroSec || !window.THREE) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const scene = new THREE.Scene();
  let width = heroSec.clientWidth;
  let height = heroSec.clientHeight;

  const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 1000);
  camera.position.set(0, 0, 24);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance'
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // Optical Lens Barrel Assembly
  let baseLensX = width > 900 ? 3.6 : 0;
  const lensGroup = new THREE.Group();
  lensGroup.position.set(baseLensX, 0, 0);
  scene.add(lensGroup);

  // 1. Aperture Gear Ring (Outer)
  const outerRingGeo = new THREE.RingGeometry(7.2, 7.5, 64);
  const outerRingMat = new THREE.MeshBasicMaterial({
    color: 0xdda04a,
    transparent: true,
    opacity: 0.18,
    side: THREE.DoubleSide
  });
  const outerRing = new THREE.Mesh(outerRingGeo, outerRingMat);
  lensGroup.add(outerRing);

  // 2. Optical Glass Barrels (Torus rings at varying z-depths)
  const barrelMat = new THREE.MeshBasicMaterial({
    color: 0xefe9df,
    transparent: true,
    opacity: 0.22,
    wireframe: true
  });
  const barrel1 = new THREE.Mesh(new THREE.TorusGeometry(6.0, 0.04, 6, 48), barrelMat);
  barrel1.position.z = 2;
  lensGroup.add(barrel1);

  const barrel2 = new THREE.Mesh(new THREE.TorusGeometry(4.8, 0.03, 6, 48), barrelMat);
  barrel2.position.z = -3;
  lensGroup.add(barrel2);

  // 3. Aperture Iris Blades (Wireframe geometry)
  const bladePoints = [];
  const bladeCount = 8;
  const radius = 4.2;
  for (let i = 0; i < bladeCount; i++) {
    const a1 = (i / bladeCount) * Math.PI * 2;
    const a2 = ((i + 1) / bladeCount) * Math.PI * 2;
    const innerA = a1 + Math.PI / bladeCount;
    const innerR = 1.9;
    bladePoints.push(
      new THREE.Vector3(Math.cos(a1) * radius, Math.sin(a1) * radius, 0),
      new THREE.Vector3(Math.cos(innerA) * innerR, Math.sin(innerA) * innerR, 0.5),
      new THREE.Vector3(Math.cos(innerA) * innerR, Math.sin(innerA) * innerR, 0.5),
      new THREE.Vector3(Math.cos(a2) * radius, Math.sin(a2) * radius, 0)
    );
  }
  const bladeGeo = new THREE.BufferGeometry().setFromPoints(bladePoints);
  const bladeMat = new THREE.LineBasicMaterial({
    color: 0xdda04a,
    transparent: true,
    opacity: 0.35
  });
  const irisMesh = new THREE.LineSegments(bladeGeo, bladeMat);
  lensGroup.add(irisMesh);

  // 4. Optical Focus Witness Marks (radial ticks)
  const tickPoints = [];
  for (let i = 0; i < 24; i++) {
    const angle = (i / 24) * Math.PI * 2;
    const r1 = 6.8;
    const r2 = (i % 3 === 0) ? 7.15 : 7.0;
    tickPoints.push(
      new THREE.Vector3(Math.cos(angle) * r1, Math.sin(angle) * r1, 0),
      new THREE.Vector3(Math.cos(angle) * r2, Math.sin(angle) * r2, 0)
    );
  }
  const tickGeo = new THREE.BufferGeometry().setFromPoints(tickPoints);
  const tickMat = new THREE.LineBasicMaterial({
    color: 0xefe9df,
    transparent: true,
    opacity: 0.28
  });
  const ticks = new THREE.LineSegments(tickGeo, tickMat);
  lensGroup.add(ticks);

  // 5. Floating Optical Dust / Halide Particles
  const partCount = 75;
  const partPositions = new Float32Array(partCount * 3);
  for (let i = 0; i < partCount; i++) {
    partPositions[i * 3] = (Math.random() - 0.5) * 26;
    partPositions[i * 3 + 1] = (Math.random() - 0.5) * 18;
    partPositions[i * 3 + 2] = (Math.random() - 0.5) * 30;
  }
  const partGeo = new THREE.BufferGeometry();
  partGeo.setAttribute('position', new THREE.BufferAttribute(partPositions, 3));
  const partMat = new THREE.PointsMaterial({
    color: 0xdda04a,
    size: 0.12,
    transparent: true,
    opacity: 0.45
  });
  const particles = new THREE.Points(partGeo, partMat);
  scene.add(particles);

  // Mouse Parallax
  let targetCamRotX = 0;
  let targetCamRotY = 0;
  let targetLensX = 0;
  let targetLensY = 0;
  let isHeroVisible = true;

  if (!reduceMotion) {
    heroSec.addEventListener('pointermove', e => {
      const rect = heroSec.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
      targetCamRotY = nx * 0.12;
      targetCamRotX = -ny * 0.09;
      targetLensX = nx * 1.2;
      targetLensY = -ny * 0.9;

      if (window.gsap) {
        gsap.to('.hero-img', {
          x: nx * -16,
          y: ny * -12,
          duration: 1.2,
          ease: 'power1.out',
          overwrite: 'auto'
        });
        gsap.to('.hero .vf-c', {
          x: nx * 8,
          y: ny * 6,
          duration: 1.2,
          ease: 'power1.out',
          overwrite: 'auto'
        });
      }
    });

    heroSec.addEventListener('pointerleave', () => {
      targetCamRotX = 0;
      targetCamRotY = 0;
      targetLensX = 0;
      targetLensY = 0;
      if (window.gsap) {
        gsap.to('.hero-img, .hero .vf-c', { x: 0, y: 0, duration: 1.5, ease: 'power2.out', overwrite: 'auto' });
      }
    });
  }

  // Scroll Parallax with GSAP ScrollTrigger
  if (!reduceMotion && window.gsap && window.ScrollTrigger) {
    gsap.to('.hero-img', {
      yPercent: 16,
      scale: 1.05,
      ease: 'none',
      scrollTrigger: {
        trigger: '#top',
        start: 'top top',
        end: 'bottom top',
        scrub: true
      }
    });
    gsap.to('.hero-text', {
      yPercent: -8,
      autoAlpha: 0.15,
      ease: 'none',
      scrollTrigger: {
        trigger: '#top',
        start: 'top top',
        end: 'bottom top',
        scrub: true
      }
    });
    gsap.to(camera.position, {
      z: 15,
      ease: 'none',
      scrollTrigger: {
        trigger: '#top',
        start: 'top top',
        end: 'bottom top',
        scrub: true
      }
    });
    gsap.to(lensGroup.rotation, {
      z: Math.PI * 0.5,
      ease: 'none',
      scrollTrigger: {
        trigger: '#top',
        start: 'top top',
        end: 'bottom top',
        scrub: true
      }
    });
  }

  function onResize() {
    width = heroSec.clientWidth;
    height = heroSec.clientHeight;
    baseLensX = width > 900 ? 3.6 : 0;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }
  window.addEventListener('resize', onResize, { passive: true });

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(([entry]) => {
      isHeroVisible = entry.isIntersecting;
    }, { threshold: 0.05 });
    observer.observe(heroSec);
  }

  function animate() {
    requestAnimationFrame(animate);
    if (!isHeroVisible) return;

    if (!reduceMotion) {
      camera.rotation.y += (targetCamRotY - camera.rotation.y) * 0.05;
      camera.rotation.x += (targetCamRotX - camera.rotation.x) * 0.05;
      lensGroup.position.x += ((baseLensX + targetLensX) - lensGroup.position.x) * 0.05;
      lensGroup.position.y += (targetLensY - lensGroup.position.y) * 0.05;
      lensGroup.rotation.z += 0.0012;
      particles.rotation.y += 0.0006;
    }

    renderer.render(scene, camera);
  }
  animate();
}

// ==========================================
// 2. Audio: 3D Vector Scope & Web Audio Analyser (Kasus 9)
// ==========================================
let audioCtx = null;
let audioAnalyser = null;
let audioTimeData = null;
ensureAudioContext = function() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    audioCtx = new AudioCtx();
    audioAnalyser = audioCtx.createAnalyser();
    audioAnalyser.fftSize = 256;
    audioAnalyser.smoothingTimeConstant = 0.85;
    audioTimeData = new Uint8Array(audioAnalyser.fftSize);

    const src = audioCtx.createMediaElementSource(audioEl);
    src.connect(audioAnalyser);
    audioAnalyser.connect(audioCtx.destination);
  } catch (err) {
    audioAnalyser = null;
  }
}

function initAudioScopeVisualizer() {
  const canvas = document.getElementById('audioScopeCanvas');
  const stage = canvas ? canvas.parentElement : null;
  const scopeStatus = document.getElementById('scopeStatus');
  if (!canvas || !stage || !window.THREE) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const scene = new THREE.Scene();
  let width = stage.clientWidth;
  let height = stage.clientHeight;

  const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
  camera.position.set(0, 4.2, 5.8);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance'
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scopeGroup = new THREE.Group();
  scene.add(scopeGroup);

  // Radar Graticule Rings
  const graticuleMat = new THREE.LineBasicMaterial({
    color: 0xefe9df,
    transparent: true,
    opacity: 0.14
  });
  const graticuleAmberMat = new THREE.LineBasicMaterial({
    color: 0xdda04a,
    transparent: true,
    opacity: 0.22
  });

  [1.0, 1.8, 2.6].forEach((r, idx) => {
    const pts = [];
    const segments = 48;
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
    }
    const ringGeo = new THREE.BufferGeometry().setFromPoints(pts);
    scopeGroup.add(new THREE.Line(ringGeo, idx === 2 ? graticuleAmberMat : graticuleMat));
  });

  // Center Crosshair Axis
  const axisPts = [
    new THREE.Vector3(-2.8, 0, 0), new THREE.Vector3(2.8, 0, 0),
    new THREE.Vector3(0, 0, -2.8), new THREE.Vector3(0, 0, 2.8),
    new THREE.Vector3(0, -0.2, 0), new THREE.Vector3(0, 2.2, 0)
  ];
  const axisGeo = new THREE.BufferGeometry().setFromPoints(axisPts);
  const axisMat = new THREE.LineSegments(axisGeo, new THREE.LineBasicMaterial({
    color: 0xefe9df,
    transparent: true,
    opacity: 0.18
  }));
  scopeGroup.add(axisMat);

  // Dynamic 3D Waveform Ring
  const pointCount = 128;
  const positions = new Float32Array(pointCount * 3);
  const colors = new Float32Array(pointCount * 3);

  for (let i = 0; i < pointCount; i++) {
    const a = (i / pointCount) * Math.PI * 2;
    positions[i * 3] = Math.cos(a) * 1.5;
    positions[i * 3 + 1] = 0;
    positions[i * 3 + 2] = Math.sin(a) * 1.5;
    colors[i * 3] = 0.86;
    colors[i * 3 + 1] = 0.62;
    colors[i * 3 + 2] = 0.29;
  }

  const waveGeo = new THREE.BufferGeometry();
  waveGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  waveGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const waveMat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.85
  });
  const waveLine = new THREE.LineLoop(waveGeo, waveMat);
  scopeGroup.add(waveLine);

  // Center Dialogue Indicator
  const dialogPinGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0.05, 0)
  ]);
  const dialogPinMat = new THREE.LineBasicMaterial({
    color: 0x86b57d,
    transparent: true,
    opacity: 0.9
  });
  const dialogPin = new THREE.Line(dialogPinGeo, dialogPinMat);
  scopeGroup.add(dialogPin);

  updateScopeStatus = function() {
    if (!scopeStatus) return;
    const gap = effectiveMusicDb() - dialogDb;
    if (!playing) {
      scopeStatus.textContent = 'STANDBY';
      scopeStatus.dataset.state = 'idle';
    } else if (gap > -6) {
      scopeStatus.textContent = 'MASKING RAWAT (L/R > DIALOG)';
      scopeStatus.dataset.state = 'bad';
    } else if (gap > -12) {
      scopeStatus.textContent = 'MASIH BERSAING';
      scopeStatus.dataset.state = 'mid';
    } else {
      scopeStatus.textContent = 'SEIMBANG (DIALOG JELAS)';
      scopeStatus.dataset.state = 'good';
    }
  };

  let isDragging = false;
  let prevPointerX = 0;
  let prevPointerY = 0;
  let targetRotY = 0;
  let targetRotX = 0;

  stage.addEventListener('pointerdown', e => {
    isDragging = true;
    prevPointerX = e.clientX;
    prevPointerY = e.clientY;
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener('pointermove', e => {
    if (!isDragging) return;
    const dx = e.clientX - prevPointerX;
    const dy = e.clientY - prevPointerY;
    prevPointerX = e.clientX;
    prevPointerY = e.clientY;
    targetRotY += dx * 0.01;
    targetRotX += dy * 0.01;
    targetRotX = Math.max(-0.6, Math.min(0.6, targetRotX));
  });
  stage.addEventListener('pointerup', () => { isDragging = false; });
  stage.addEventListener('pointercancel', () => { isDragging = false; });

  let isMixerVisible = true;
  if ('IntersectionObserver' in window) {
    const obs = new IntersectionObserver(([entry]) => {
      isMixerVisible = entry.isIntersecting;
    }, { threshold: 0.05 });
    obs.observe(stage);
  }

  function onResize() {
    width = stage.clientWidth;
    height = stage.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }
  window.addEventListener('resize', onResize, { passive: true });

  let phase = 0;
  function animate() {
    requestAnimationFrame(animate);
    if (!isMixerVisible) return;

    scopeGroup.rotation.y += (targetRotY - scopeGroup.rotation.y) * 0.08;
    scopeGroup.rotation.x += (targetRotX - scopeGroup.rotation.x) * 0.08;
    if (!isDragging && !reduceMotion) {
      targetRotY += 0.003;
    }

    const pos = waveGeo.attributes.position.array;
    const col = waveGeo.attributes.color.array;

    const musicLevel = playing ? dbToGain(effectiveMusicDb()) : 0.08;
    const dialogLevel = (playing && speaking) ? dbToGain(dialogDb) * 2.2 : (playing ? 0.2 : 0);
    const gap = effectiveMusicDb() - dialogDb;
    const isBad = gap > -6;

    if (audioAnalyser && playing) {
      audioAnalyser.getByteTimeDomainData(audioTimeData);
    }

    phase += playing ? 0.08 : 0.02;

    for (let i = 0; i < pointCount; i++) {
      const a = (i / pointCount) * Math.PI * 2;
      let waveVal = 0;
      if (audioAnalyser && playing) {
        const dataIdx = Math.floor((i / pointCount) * audioTimeData.length);
        waveVal = ((audioTimeData[dataIdx] - 128) / 128) * musicLevel * 1.5;
      } else {
        waveVal = Math.sin(a * 4 + phase) * Math.cos(a * 2 - phase * 0.7) * musicLevel * 0.8;
      }

      const r = 1.3 + musicLevel * 1.4 + waveVal;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const centerFactor = Math.max(0, 1 - Math.hypot(x, z) / 2.5);
      const y = Math.sin(a * 8 + phase * 2) * 0.15 * musicLevel + (dialogLevel * centerFactor * 1.8);

      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;

      if (!playing) {
        col[i * 3] = 0.58; col[i * 3 + 1] = 0.55; col[i * 3 + 2] = 0.51;
      } else if (isBad) {
        col[i * 3] = 0.97; col[i * 3 + 1] = 0.44; col[i * 3 + 2] = 0.44;
      } else if (speaking && ducked) {
        col[i * 3] = 0.52; col[i * 3 + 1] = 0.75; col[i * 3 + 2] = 0.49;
      } else {
        col[i * 3] = 0.86; col[i * 3 + 1] = 0.62; col[i * 3 + 2] = 0.29;
      }
    }

    const pinPos = dialogPin.geometry.attributes.position.array;
    pinPos[4] = dialogLevel * 1.8;
    dialogPin.geometry.attributes.position.needsUpdate = true;
    dialogPin.material.color.setHex((speaking && ducked) ? 0x86b57d : (isBad ? 0xf87171 : 0xdda04a));

    waveGeo.attributes.position.needsUpdate = true;
    waveGeo.attributes.color.needsUpdate = true;

    renderer.render(scene, camera);
  }
  animate();
  updateScopeStatus();
}

// Initialize Three.js features
initHeroLensParallax();
initAudioScopeVisualizer();
