/** Draw a minimal planted flag used exclusively during the Victory screen.
 * This avoids the full unfurling banner and any animated waves that
 * otherwise overlap the victory dialog on the overlay.
 */
function drawSmallPlantedFlag() {
  if (flag.state !== 'PLANTED') return;
  ctx.save();
  ctx.translate(flag.x, flag.y);

  // Simple pole
  ctx.strokeStyle = '#D4AF37';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -48);
  ctx.stroke();

  // Small rectangular banner (non-waving)
  const w = 30;
  const h = 16;
  ctx.fillStyle = '#0C1C42';
  ctx.strokeStyle = '#D4AF37';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.rect(4, -48, w, h);
  ctx.fill();
  ctx.stroke();

  // Tiny text/crest
  if (!prefersReducedMotion) {
    ctx.fillStyle = '#D4AF37';
    ctx.font = 'bold 7px "Cinzel", serif';
    ctx.textAlign = 'center';
    ctx.fillText('S J S', 4 + w / 2, -48 + 11);
  }

  ctx.restore();
}
/**
 * Mission Radiance — St. Joseph's School Interactive Game
 * Mobile-First 2D Canvas Engine | Radiance 2026-27
 *
 * Architecture:
 *  1. Audio System (Procedural Web Audio API)
 *  2. Constants & Configuration
 *  3. Canvas Setup, Starfield & Parallax Background
 *  4. Input Handler (Touch + Keyboard)
 *  5. Game Objects (Rocket, Asteroid, Badge)
 *  6. Particle Systems
 *  7. Planet Rendering — Earth & Moon (OffscreenCanvas cached)
 *  8. Flag Rendering
 *  9. Game Controller & State Machine
 * 10. Core Game Loop (update / draw)
 * 11. Victory Flag Canvas Animation
 * 12. Initialization & Event Wiring
 */

'use strict';

// ==========================================================================
// 0. Configurable Deployment Constants
// ==========================================================================

/**
 * MAGAZINE_URL — Replace with your final Heyzine flip-book URL before deployment.
 * @type {string}
 */
const MAGAZINE_URL = '#';

// ==========================================================================
// 1. Audio System (Procedural Web Audio API Synthesizer)
// ==========================================================================
class SoundSystem {
  constructor() {
    this.ctx         = null;
    this.muted       = false;
    this.engineOsc   = null;
    this.engineGain  = null;
    this.ambientOsc  = null;
    this.ambientOsc2 = null;
    this.ambientGain = null;
    this.initialized = false;
  }

  /** Lazy-init AudioContext on first user gesture (browser policy). */
  init() {
    if (this.initialized) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.initialized = true;
    } catch (e) {
      // Web Audio not supported — fail silently
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.muted) {
      this.stopEngine();
      this.stopAmbience();
    } else {
      this.startAmbience();
      if (gameState === 'GAMEPLAY' || gameState === 'LAUNCH') {
        this.startEngine();
      }
    }
    return this.muted;
  }

  /** Suspend all audio (tab hidden). */
  suspend() {
    if (this.ctx && this.ctx.state === 'running') {
      this.ctx.suspend();
    }
  }

  /** Resume all audio (tab visible again). */
  resume() {
    if (this.ctx && this.ctx.state === 'suspended' && !this.muted) {
      this.ctx.resume();
    }
  }

  playClick() {
    this.init();
    if (this.muted || !this.ctx) return;
    const now  = this.ctx.currentTime;
    const osc  = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.08);
    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  startAmbience() {
    this.init();
    if (this.muted || !this.ctx || this.ambientOsc) return;
    try {
      this.ambientOsc  = this.ctx.createOscillator();
      this.ambientOsc2 = this.ctx.createOscillator();
      this.ambientGain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      this.ambientOsc.type = 'sine';
      this.ambientOsc.frequency.setValueAtTime(65.41, this.ctx.currentTime); // C2

      this.ambientOsc2.type = 'triangle';
      this.ambientOsc2.frequency.setValueAtTime(98.00, this.ctx.currentTime); // G2 fifth

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(110, this.ctx.currentTime);

      this.ambientGain.gain.setValueAtTime(0, this.ctx.currentTime);
      this.ambientGain.gain.linearRampToValueAtTime(0.035, this.ctx.currentTime + 1.5);

      this.ambientOsc.connect(filter);
      this.ambientOsc2.connect(filter);
      filter.connect(this.ambientGain);
      this.ambientGain.connect(this.ctx.destination);

      this.ambientOsc.start();
      this.ambientOsc2.start();
    } catch (e) { /* ignore */ }
  }

  stopAmbience() {
    if (this.ambientOsc) {
      try { this.ambientOsc.stop();  } catch (e) {}
      try { this.ambientOsc2.stop(); } catch (e) {}
      this.ambientOsc  = null;
      this.ambientOsc2 = null;
      this.ambientGain = null;
    }
  }

  playLaunch() {
    this.init();
    if (this.muted || !this.ctx) return;
    const now    = this.ctx.currentTime;
    const osc    = this.ctx.createOscillator();
    const gain   = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(35, now);
    osc.frequency.exponentialRampToValueAtTime(145, now + 1.6);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(120, now);
    filter.frequency.exponentialRampToValueAtTime(350, now + 1.6);
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 1.2);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 1.8);
  }

  startEngine() {
    this.init();
    if (this.muted || !this.ctx || this.engineOsc) return;
    try {
      this.engineOsc  = this.ctx.createOscillator();
      this.engineGain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.setValueAtTime(50, this.ctx.currentTime);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(95, this.ctx.currentTime);
      this.engineGain.gain.setValueAtTime(0, this.ctx.currentTime);
      this.engineGain.gain.linearRampToValueAtTime(0.05, this.ctx.currentTime + 0.8);
      this.engineOsc.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(this.ctx.destination);
      this.engineOsc.start();
    } catch (e) { /* ignore */ }
  }

  stopEngine() {
    if (this.engineOsc) {
      try { this.engineOsc.stop(); } catch (e) {}
      this.engineOsc  = null;
      this.engineGain = null;
    }
  }

  playCollect() {
    this.init();
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    // Ascending C-major-9 arpeggio — bright and rewarding
    [523.25, 659.25, 783.99, 987.77, 1174.66].forEach((freq, idx) => {
      const osc  = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);
      gain.gain.setValueAtTime(0, now + idx * 0.06);
      gain.gain.linearRampToValueAtTime(0.12, now + idx * 0.06 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.35);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.4);
    });
  }

  playCollision() {
    this.init();
    if (this.muted || !this.ctx) return;
    const now    = this.ctx.currentTime;
    const osc    = this.ctx.createOscillator();
    const gain   = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(25, now + 0.35);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(150, now);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.45);
  }

  playLanding() {
    this.init();
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    // Rising majestic cinematic chords — C major ascending
    [261.63, 329.63, 392.00, 523.25, 659.25].forEach((freq, idx) => {
      const osc  = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.15);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, now + idx * 0.15 + 1.2);
      gain.gain.setValueAtTime(0, now + idx * 0.15);
      gain.gain.linearRampToValueAtTime(0.08, now + idx * 0.15 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.15 + 1.8);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + idx * 0.15);
      osc.stop(now + idx * 0.15 + 2.0);
    });
  }

  playBoost() {
    this.init();
    if (this.muted || !this.ctx) return;
    const now  = this.ctx.currentTime;
    const osc  = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(260, now + 0.22);
    gain.gain.setValueAtTime(0.03, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  }
}

const sfx = new SoundSystem();

// ==========================================================================
// 2. Constants & Game Configuration
// ==========================================================================

const VIEW_WIDTH  = 360; // Virtual canvas width  (logical pixels)
const VIEW_HEIGHT = 640; // Virtual canvas height (logical pixels)
const STAR_COUNT  = 150;
const MAX_PARTICLES = 180;

const easeInOut = t => t * t * (3 - 2 * t);

/** The 7 Core Values of St. Joseph's School, in mission order. */
const VALUE_BADGES = [
  'Knowledge',
  'Leadership',
  'Excellence',
  'Creativity',
  'Innovation',
  'Compassion',
  'Achievement'
];

/** Emoji icon and inspirational quote for each school value. */
const BADGE_DETAILS = {
  Knowledge:   { emoji: '📖', meaning: 'Learning lights the path.'      },
  Leadership:  { emoji: '👑', meaning: 'Inspiring others to grow.'       },
  Excellence:  { emoji: '🏆', meaning: 'Striving for the highest.'       },
  Creativity:  { emoji: '🎨', meaning: 'Shaping new possibilities.'      },
  Innovation:  { emoji: '💡', meaning: 'Building the future.'            },
  Compassion:  { emoji: '❤️', meaning: 'Kindness in every action.'       },
  Achievement: { emoji: '🏅', meaning: 'Honoring every success.'         }
};

const BOOST_MAX                    = 100;
const BOOST_DRAIN_RATE             = 36; // energy per second while boosting
const BOOST_RECOVER_RATE           = 24; // energy per second when not boosting
const BOOST_MIN_ACTIVATE           = 12; // minimum energy required to start a boost
const BOOST_SPEED_MULTIPLIER       = 2.6;  // sustained lateral steering speed while boosting
const BOOST_IGNITION_SPEED_MULTIPLIER = 3.2; // initial burst multiplier
const BOOST_IGNITION_DURATION      = 0.4; // seconds of initial burst
const BOOST_PROGRESS_MULTIPLIER    = 2.7; // faster forward progress while boosting
const BOOST_IGNITION_PROGRESS_MULTIPLIER = 3.1; // initial boost burst to feel powerful
const BOOST_STAR_SPEED_MULTIPLIER  = 1.9;
const BOOST_IGNITION_STAR_MULTIPLIER = 2.5;
const BOOST_ENGINE_VOLUME_ACTIVE   = 0.085;
const BOOST_ENGINE_VOLUME_IDLE     = 0.05;

// DOM References — Canvas
const canvas    = document.getElementById('game-canvas');
const ctx       = canvas.getContext('2d');
const container = document.getElementById('game-container');

// DOM References — Screens
const splashScreen      = document.getElementById('splash-screen');
const fullscreenPrompt  = document.getElementById('fullscreen-prompt');
const gameHud           = document.getElementById('game-hud');
const interruptedScreen = document.getElementById('interrupted-screen');
const victoryScreen     = document.getElementById('victory-screen');

// DOM References — Badge Modal
const badgeModal        = document.getElementById('badge-modal');
const badgeModalIcon    = document.getElementById('badge-modal-icon');
const badgeModalTitle   = document.getElementById('badge-modal-title');
const badgeModalMeaning = document.getElementById('badge-modal-meaning');

// DOM References — HUD
const badgesCollectedText = document.getElementById('badges-collected');
const progressBarFill     = document.getElementById('progress-bar-fill');
const progressRocketHead  = document.getElementById('progress-rocket-head');
const hudHearts           = document.querySelectorAll('#hud-hearts .heart');

// DOM References — Buttons
const btnBegin          = document.getElementById('btn-begin');
const btnFullscreen     = document.getElementById('btn-fullscreen');
const btnSkipFullscreen = document.getElementById('btn-skip-fullscreen');
const btnContinue       = document.getElementById('btn-continue');
const btnReplay         = document.getElementById('btn-replay');
const btnMagazine       = document.getElementById('btn-magazine');
const btnMute           = document.getElementById('btn-mute');
const soundOnIcon       = document.getElementById('sound-on-icon');
const soundOffIcon      = document.getElementById('sound-off-icon');
const btnBoost          = document.getElementById('btn-boost');
const boostBarFill      = document.getElementById('boost-bar-fill');

const victoryPhase1     = document.querySelector('#victory-screen .victory-phase-1');
const victoryPhase2     = document.querySelector('#victory-screen .victory-phase-2');
const victoryButtons    = document.querySelector('#victory-screen .victory-buttons');

// DOM References — Victory flag canvas
const victoryFlagCanvas = document.getElementById('victory-flag-canvas');
const vfCtx             = victoryFlagCanvas ? victoryFlagCanvas.getContext('2d') : null;

// Accessibility — detect reduced-motion preference
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ==========================================================================
// 3. Game State Variables
// ==========================================================================

/**
 * Game state machine states:
 *   INTRO | FULLSCREEN_PROMPT | LAUNCH | GAMEPLAY | PAUSE_COLLECT |
 *   INTERRUPTED | LANDING | VICTORY
 */
let gameState = 'INTRO';

// Controls
let keys           = {};
let activePointers = {};
let input          = { left: false, right: false, boost: false };

// Gameplay
let lives             = 3;
let currentBadgeIndex = 0;
let progress          = 0;
let progressLerp      = 0;   // Smoothed value for HUD bar animation
let boostEnergy       = BOOST_MAX;
let boostActive       = false;
let boostPointerId    = null;
let boostIgnitionTime = 0;
let gameDuration      = 120; // seconds
let scrollSpeed       = 2;
let targetScrollSpeed = 2;
let cameraShake       = 0;
let isInvulnerable    = false;
let invulnerableTime  = 0;
let spawnTimer        = 0;
let lastTime          = 0;
let gamePaused        = false; // used by Page Visibility API

// Camera (landing zoom)
let cameraZoom = 1.0;
let cameraY    = 0;

// Landing transition flash
let landingFlashAlpha = 0;

// Cosmic background
let nebulaOffset   = 0;
let shootingStar   = null;
let earthRotation  = 0;

// Entities
let rocket     = null;
let asteroids  = [];
let activeBadge = null;
let stars      = [];
let particles  = [];
let particlePool = [];
let landingTimer = 0;
let victoryScheduled = false;
let victoryTextTimer = null;
let victoryButtonsTimer = null;

// Planets
let earth = { x: VIEW_WIDTH / 2, y: VIEW_HEIGHT + 100, radius: 240 };
let moon  = { x: VIEW_WIDTH / 2, y: -200, radius: 100, alpha: 0 };
let flag  = { x: VIEW_WIDTH / 2, y: 320, state: 'HIDDEN', timer: 0 };
// flag.state: 'HIDDEN' | 'PLANTING' | 'UNFURLING' | 'PLANTED'

// ==========================================================================
// 4. OffscreenCanvas Caches (Earth & Moon Performance Optimization)
// ==========================================================================

/**
 * We pre-render Earth and Moon onto OffscreenCanvas buffers.
 * Each frame we check if the rotation / radius has changed beyond a threshold.
 * If it has, we re-render the cache; otherwise we simply blit the cached image.
 * This eliminates multiple createRadialGradient() and arc() calls per frame,
 * which are the primary source of Earth rendering lag on mobile.
 */

// Earth cache
let earthCanvas = null;
let earthCtx2d  = null;
let lastEarthRadius   = -1;
let lastEarthRotation = -999; // force initial render

// Moon cache
let moonCanvas = null;
let moonCtx2d  = null;
let lastMoonRadius = -1;

// Nebula gradient cache — created once, never re-created per frame
let nebulaGradientCache = null;

/** Create or resize the Earth OffscreenCanvas and render into it. */
function ensureEarthCache() {
  const r   = Math.ceil(earth.radius);
  const dim = (r + 30) * 2; // +30 for atmosphere rings

  const radiusChanged = r !== lastEarthRadius;
  if (!earthCanvas || radiusChanged) {
    if (typeof OffscreenCanvas !== 'undefined') {
      earthCanvas = new OffscreenCanvas(dim, dim);
    } else {
      earthCanvas = document.createElement('canvas');
      earthCanvas.width  = dim;
      earthCanvas.height = dim;
    }
    earthCtx2d = earthCanvas.getContext('2d');
    lastEarthRadius = r;

    const ec  = earthCtx2d;
    const cx  = dim / 2;
    const cy  = dim / 2;

    ec.clearRect(0, 0, dim, dim);

    // A. Atmospheric glow rings (3 layers)
    for (let i = 3; i >= 1; i--) {
      ec.fillStyle = `rgba(74, 144, 226, ${0.28 - i * 0.08})`;
      ec.beginPath();
      ec.arc(cx, cy, r + i * 8, 0, Math.PI * 2);
      ec.fill();
    }

    // B. Spherical base gradient
    const grad = ec.createRadialGradient(cx - 30, cy - 30, 20, cx, cy, r);
    grad.addColorStop(0,    '#1E2C4A');
    grad.addColorStop(0.4,  '#0D172E');
    grad.addColorStop(0.85, '#050A14');
    grad.addColorStop(1,    '#010307');
    ec.fillStyle = grad;
    ec.beginPath();
    ec.arc(cx, cy, r, 0, Math.PI * 2);
    ec.fill();

    // C. Continent blobs are drawn once in neutral orientation.
    ec.fillStyle = 'rgba(46, 204, 113, 0.13)';
    const blobs = [[-60, -80, 85], [80, 40, 110], [-20, 90, 65], [40, -110, 50]];
    blobs.forEach(([bx, by, br]) => {
      ec.beginPath();
      ec.arc(cx + bx, cy + by, br, 0, Math.PI * 2);
      ec.fill();
    });
  }
}

/** Create or resize the Moon OffscreenCanvas and render into it. */
function ensureMoonCache() {
  const r   = Math.ceil(moon.radius);
  const dim = (r + 50) * 2; // +50 for halo rings

  if (r === lastMoonRadius && moonCanvas) return; // cache valid

  if (typeof OffscreenCanvas !== 'undefined') {
    moonCanvas = new OffscreenCanvas(dim, dim);
  } else {
    moonCanvas = document.createElement('canvas');
    moonCanvas.width  = dim;
    moonCanvas.height = dim;
  }
  moonCtx2d = moonCanvas.getContext('2d');
  lastMoonRadius = r;

  // ── Render Moon into cache ───────────────────────────────────────────────
  const mc = moonCtx2d;
  const cx = dim / 2;
  const cy = dim / 2;

  mc.clearRect(0, 0, dim, dim);

  // A. Golden halo rings
  for (let i = 3; i >= 1; i--) {
    mc.fillStyle = `rgba(212, 175, 55, ${0.16 - i * 0.04})`;
    mc.beginPath();
    mc.arc(cx, cy, r + i * 14, 0, Math.PI * 2);
    mc.fill();
  }

  // B. Moon surface gradient
  const grad = mc.createRadialGradient(
    cx - r * 0.3, cy - r * 0.3, 5,
    cx, cy, r
  );
  grad.addColorStop(0,    '#FDF6D6');
  grad.addColorStop(0.5,  '#DCD09E');
  grad.addColorStop(0.85, '#A49867');
  grad.addColorStop(1,    '#534B29');
  mc.fillStyle = grad;
  mc.beginPath();
  mc.arc(cx, cy, r, 0, Math.PI * 2);
  mc.fill();

  // C. Crater details
  mc.fillStyle = 'rgba(0, 0, 0, 0.08)';
  [[-25, -25, 18], [35, 10, 12], [-10, 35, 15], [20, -35, 10], [-45, 20, 8]].forEach(([bx, by, br]) => {
    mc.beginPath();
    mc.arc(cx + bx, cy + by, br, 0, Math.PI * 2);
    mc.fill();
  });
}

// ==========================================================================
// 5. Canvas Setup, Starfield & Parallax Background
// ==========================================================================

function setupCanvas() {
  const dpr  = window.devicePixelRatio || 1;
  const rect = container.getBoundingClientRect();
  canvas.width  = rect.width  * dpr;
  canvas.height = rect.height * dpr;
  ctx.resetTransform();
  ctx.scale(rect.width * dpr / VIEW_WIDTH, rect.height * dpr / VIEW_HEIGHT);
  // Invalidate planet caches on resize (DPR may have changed)
  lastMoonRadius    = -1;
  lastEarthRadius   = -1;
  lastEarthRotation = -999;
  nebulaGradientCache = null;
}

function checkOrientation() {
  const lock = document.getElementById('portrait-lock');
  // Only trigger lock for phones in landscape (screen < 950px wide)
  if (window.innerWidth > window.innerHeight && window.innerWidth < 950) {
    lock.style.display = 'flex';
  } else {
    lock.style.display = 'none';
  }
}

/** Generate the parallax starfield array. */
function generateStars() {
  stars = [];
  for (let i = 0; i < STAR_COUNT; i++) {
    stars.push({
      x:           Math.random() * VIEW_WIDTH,
      y:           Math.random() * VIEW_HEIGHT,
      size:        0.3 + Math.random() * 1.5,
      depth:       0.12 + Math.random() * 0.88, // parallax speed factor
      pulseSpeed:  0.8 + Math.random() * 2.2,
      pulseTimer:  Math.random() * Math.PI,
      brightness:  0.25 + Math.random() * 0.75
    });
  }
}

function updateStars(dt) {
  if (prefersReducedMotion) return; // skip motion for accessibility

  const starBoost = boostActive
    ? (boostIgnitionTime < BOOST_IGNITION_DURATION ? BOOST_IGNITION_STAR_MULTIPLIER : BOOST_STAR_SPEED_MULTIPLIER)
    : 1;
  stars.forEach(star => {
    // Scroll downward to simulate rocket flying up
    star.y += scrollSpeed * star.depth * dt * 30 * starBoost;
    if (star.y > VIEW_HEIGHT) {
      star.y = 0;
      star.x = Math.random() * VIEW_WIDTH;
    }
    // Twinkle
    star.pulseTimer += star.pulseSpeed * dt;
    star.brightness = 0.3 + Math.sin(star.pulseTimer) * 0.35;
  });

  // Nebula slowly drifts
  nebulaOffset = (nebulaOffset + dt * 0.15) % VIEW_HEIGHT;

  // Shooting star logic (skip in reduced-motion mode)
  if (!shootingStar) {
    if (Math.random() < 0.003) {
      shootingStar = {
        x:      Math.random() * VIEW_WIDTH,
        y:      Math.random() * (VIEW_HEIGHT / 2),
        vx:    -200 - Math.random() * 180,
        vy:     200 + Math.random() * 180,
        length: 30 + Math.random() * 30,
        life:   1.0,
        speed:  1.2 + Math.random() * 1.2
      };
    }
  } else {
    shootingStar.x    += shootingStar.vx * dt * shootingStar.speed;
    shootingStar.y    += shootingStar.vy * dt * shootingStar.speed;
    shootingStar.life -= dt * 2.2;
    if (shootingStar.life <= 0) shootingStar = null;
  }
}

function drawStars() {
  // A. Nebula — cached gradient, cheap blit each frame
  if (!nebulaGradientCache) {
    // We create this once and reuse; it doesn't change position (just offset)
    nebulaGradientCache = ctx.createRadialGradient(
      VIEW_WIDTH / 2 - 20, 200, 30,
      VIEW_WIDTH / 2,       200, 280
    );
    nebulaGradientCache.addColorStop(0,   'rgba(80, 25, 140, 0.075)');
    nebulaGradientCache.addColorStop(0.5, 'rgba(30, 95, 185, 0.045)');
    nebulaGradientCache.addColorStop(1,   'rgba(0, 0, 0, 0)');
  }
  ctx.fillStyle = nebulaGradientCache;
  ctx.beginPath();
  ctx.arc(VIEW_WIDTH / 2, 200 + nebulaOffset * 0.12, 300, 0, Math.PI * 2);
  ctx.fill();

  // B. Stars
  stars.forEach(star => {
    ctx.fillStyle = `rgba(255, 235, 170, ${Math.max(star.brightness, 0.1)})`;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
    ctx.fill();

    // Subtle outer glow only on larger stars (avoids excess fill calls)
    if (star.size > 1.1) {
      ctx.fillStyle = `rgba(212, 175, 55, ${Math.max(star.brightness * 0.2, 0.02)})`;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size * 2.8, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // C. Shooting star
  if (shootingStar && !prefersReducedMotion) {
    ctx.save();
    const grad = ctx.createLinearGradient(
      shootingStar.x, shootingStar.y,
      shootingStar.x - shootingStar.vx * 0.05,
      shootingStar.y - shootingStar.vy * 0.05
    );
    grad.addColorStop(0, `rgba(255, 255, 255, ${shootingStar.life})`);
    grad.addColorStop(1, 'rgba(212, 175, 55, 0)');
    ctx.strokeStyle = grad;
    ctx.lineWidth   = 1.6;
    ctx.beginPath();
    ctx.moveTo(shootingStar.x, shootingStar.y);
    ctx.lineTo(
      shootingStar.x - shootingStar.vx * 0.05,
      shootingStar.y - shootingStar.vy * 0.05
    );
    ctx.stroke();
    ctx.restore();
  }
}

// ==========================================================================
// 6. Input Handler (Mobile Touch + Keyboard)
// ==========================================================================
function bindControls() {
  // Touch / Pointer events (covers mouse, touch, stylus)
  window.addEventListener('pointerdown',  handlePointerDown, { passive: false });
  window.addEventListener('pointermove',  handlePointerMove, { passive: false });
  window.addEventListener('pointerup',    handlePointerUp);
  window.addEventListener('pointercancel', handlePointerUp);

  // Keyboard fallback for desktop
  window.addEventListener('keydown', e => { keys[e.key] = true;  updateInput(); });
  window.addEventListener('keyup',   e => { keys[e.key] = false; updateInput(); });

  // Prevent browser scroll/zoom gestures on the canvas
  canvas.addEventListener('touchstart', e => e.preventDefault(), { passive: false });
  canvas.addEventListener('touchmove',  e => e.preventDefault(), { passive: false });
  canvas.addEventListener('touchend',   e => e.preventDefault(), { passive: false });
}

function handlePointerDown(e) {
  if (gameState !== 'GAMEPLAY') return;
  if (btnBoost && e.target && typeof e.target.closest === 'function' && e.target.closest('#btn-boost')) {
    activateBoostInput(e.pointerId);
    return;
  }
  activePointers[e.pointerId] = e.clientX;
  updateInput();
}

function handlePointerMove(e) {
  if (gameState !== 'GAMEPLAY') return;
  if (boostPointerId === e.pointerId) return;
  if (activePointers[e.pointerId] !== undefined) {
    activePointers[e.pointerId] = e.clientX;
    updateInput();
  }
}

function handlePointerUp(e) {
  delete activePointers[e.pointerId];
  if (boostPointerId === e.pointerId) {
    boostPointerId = null;
    input.boost = false;
    updateBoostButtonState();
  }
  updateInput();
}

function updateInput() {
  let moveLeft  = false;
  let moveRight = false;

  // Touch regions: left half = move left, right half = move right
  const midX = window.innerWidth / 2;
  for (const id in activePointers) {
    if (activePointers[id] < midX) moveLeft  = true;
    else                            moveRight = true;
  }

  // Keyboard fallback
  const keyLeft  = keys['ArrowLeft']  || keys['a'] || keys['A'];
  const keyRight = keys['ArrowRight'] || keys['d'] || keys['D'];
  const keyBoost = keys['Shift'] || keys['ShiftLeft'] || keys['ShiftRight'];

  input.left  = moveLeft  || keyLeft;
  input.right = moveRight || keyRight;
  input.boost = keyBoost || input.boost;
  updateBoostButtonState();
}

function updateBoostButtonState() {
  if (!btnBoost) return;
  btnBoost.classList.toggle('active', boostActive);
  btnBoost.classList.toggle('empty', boostEnergy <= 8 && !boostActive);
  btnBoost.classList.toggle('charging', boostEnergy > 8 && boostEnergy < BOOST_MAX && !boostActive);
  btnBoost.classList.toggle('ready', boostEnergy >= 45 && !boostActive);
}

function activateBoostInput(pointerId) {
  if (gameState !== 'GAMEPLAY') return;
  boostPointerId = pointerId;
  input.boost = true;
  updateBoostButtonState();
}

function deactivateBoostInput(pointerId) {
  if (boostPointerId !== null && boostPointerId !== pointerId) return;
  boostPointerId = null;
  input.boost = false;
  updateBoostButtonState();
}

// ==========================================================================
// 7. Game Objects
// ==========================================================================

// ── Rocket ──────────────────────────────────────────────────────────────────
class Rocket {
  constructor() {
    this.x      = VIEW_WIDTH / 2;
    this.y      = VIEW_HEIGHT - 120;
    this.width  = 24;
    this.height = 54;
    this.vx     = 0;
    this.speed  = 220;
    this.flameState = 0;
    this.bobTimer   = Math.random() * Math.PI;
    this.bobOffset  = 0;
  }

  update(dt) {
    // Steer with friction-based physics
    let steerDir = 0;
    if (input.left)  steerDir = -1;
    if (input.right) steerDir =  1;
    const activeBoost = boostActive && boostEnergy > BOOST_MIN_ACTIVATE;
    const ignitionPhase = activeBoost && boostIgnitionTime < BOOST_IGNITION_DURATION;
    const speedFactor = ignitionPhase ? BOOST_IGNITION_SPEED_MULTIPLIER : (activeBoost ? BOOST_SPEED_MULTIPLIER : 1);
    this.vx += steerDir * this.speed * 8 * dt * speedFactor;
    this.vx *= Math.pow(0.02, dt); // exponential damping
    this.x  += this.vx * dt;

    // Clamp within play area
    const margin = this.width / 2 + 10;
    if (this.x < margin) { this.x = margin; this.vx = 0; }
    if (this.x > VIEW_WIDTH - margin) { this.x = VIEW_WIDTH - margin; this.vx = 0; }

    // Idle bob
    if (!prefersReducedMotion) {
      this.bobTimer  += dt * 3.5;
      this.bobOffset  = Math.sin(this.bobTimer) * 2.8;
    }

    // Flame flicker phase
    this.flameState = (this.flameState + dt * 28) % (Math.PI * 2);

    // Spawn exhaust particles
    if (gameState === 'GAMEPLAY' || gameState === 'LAUNCH') {
      spawnThrusterParticle(this.x, this.y + this.bobOffset + this.height / 2);
      if (boostActive) {
        for (let i = 0; i < 2; i++) {
          if (Math.random() < 0.7) {
            spawnThrusterParticle(this.x, this.y + this.bobOffset + this.height / 2);
          }
        }
      }
    }
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y + this.bobOffset);

    // Invulnerability blink
    if (isInvulnerable && Math.floor(invulnerableTime * 12) % 2 === 0) {
      ctx.globalAlpha = 0.3;
    }

    // A. Engine flame (below fuselage)
    if (gameState === 'GAMEPLAY' || gameState === 'LAUNCH' || gameState === 'LANDING') {
      const flameScale = boostActive ? 1.9 : 1;
      const flicker    = 0.85 + Math.sin(this.flameState) * 0.2 + (Math.random() - 0.5) * 0.1;
      const fH         = 18 * flicker * flameScale;
      const fW         = 10 * flicker * flameScale;
      const flameGrad  = ctx.createRadialGradient(0, this.height / 2 - 3, 2, 0, this.height / 2 + fH, fW);
      flameGrad.addColorStop(0,   '#FFFFFF');
      flameGrad.addColorStop(0.18, '#FFF6B2');
      flameGrad.addColorStop(0.4, boostActive ? '#FFD46E' : '#FFE894');
      flameGrad.addColorStop(0.7, boostActive ? '#FF9F1C' : '#E67E22');
      flameGrad.addColorStop(1,   'rgba(230, 126, 34, 0)');
      ctx.shadowBlur  = boostActive ? 24 : 10;
      ctx.shadowColor = boostActive ? 'rgba(255, 190, 75, 0.7)' : 'rgba(212, 175, 55, 0.4)';
      ctx.fillStyle = flameGrad;
      ctx.beginPath();
      ctx.moveTo(-fW / 2, this.height / 2 - 5);
      ctx.quadraticCurveTo(0, this.height / 2 + fH, fW / 2, this.height / 2 - 5);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    if (boostActive) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 235, 180, 0.35)';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.85;
      for (let i = 0; i < 4; i++) {
        const offset = -10 + i * 8;
        ctx.beginPath();
        ctx.moveTo(offset, this.height / 2 + 6 + i * 2);
        ctx.lineTo(offset - 24 - i * 6, this.height / 2 + 12 + i * 4);
        ctx.stroke();
      }
      ctx.restore();
    }

    // B. Fins
    ctx.fillStyle = '#8A660D';
    ctx.beginPath();
    ctx.moveTo(-5, 5);
    ctx.quadraticCurveTo(-14, 18, -14, 25);
    ctx.lineTo(-4, 20);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(5, 5);
    ctx.quadraticCurveTo(14, 18, 14, 25);
    ctx.lineTo(4, 20);
    ctx.closePath();
    ctx.fill();

    // C. Fuselage with soft gold glow (shadowBlur kept low for perf)
    ctx.shadowBlur  = 10;
    ctx.shadowColor = 'rgba(212, 175, 55, 0.4)';
    const bodyGrad = ctx.createLinearGradient(-this.width / 2, 0, this.width / 2, 0);
    bodyGrad.addColorStop(0,   '#FFFFFF');
    bodyGrad.addColorStop(0.5, '#F5F6FA');
    bodyGrad.addColorStop(1,   '#DCDDE1');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.moveTo(0, -this.height / 2);
    ctx.quadraticCurveTo( this.width / 2 + 1, -10,  this.width / 2, this.height / 2 - 5);
    ctx.lineTo(-this.width / 2, this.height / 2 - 5);
    ctx.quadraticCurveTo(-this.width / 2 - 1, -10, 0, -this.height / 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // D. Gold nose cone
    const noseGrad = ctx.createLinearGradient(-6, -this.height / 2, 6, -10);
    noseGrad.addColorStop(0,   '#FFE894');
    noseGrad.addColorStop(0.6, '#D4AF37');
    noseGrad.addColorStop(1,   '#8A660D');
    ctx.fillStyle = noseGrad;
    ctx.beginPath();
    ctx.moveTo(0, -this.height / 2);
    ctx.quadraticCurveTo( this.width / 4, -this.height / 2 + 12,  this.width / 2 - 2, -this.height / 2 + 18);
    ctx.lineTo(-this.width / 2 + 2, -this.height / 2 + 18);
    ctx.quadraticCurveTo(-this.width / 4, -this.height / 2 + 12, 0, -this.height / 2);
    ctx.fill();

    // E. Cockpit window
    ctx.fillStyle   = '#0F2042';
    ctx.strokeStyle = '#D4AF37';
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.arc(0, -5, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.beginPath();
    ctx.arc(-1.5, -6.5, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // F. Gold body stripe
    ctx.fillStyle = '#D4AF37';
    ctx.fillRect(-this.width / 2 + 1.2, 5, this.width - 2.4, 2);

    ctx.restore();
  }
}

// ── Asteroid ─────────────────────────────────────────────────────────────────
class Asteroid {
  constructor() {
    this.x        = Math.random() * (VIEW_WIDTH - 40) + 20;
    this.y        = -50;
    this.radius   = 14 + Math.random() * 12;
    this.speedY   = 110 + Math.random() * 80;
    this.speedX   = (Math.random() - 0.5) * 35;
    this.rotation = Math.random() * Math.PI;
    this.rotSpeed = (Math.random() - 0.5) * 2;

    // Generate organic polygonal shape
    this.points = [];
    const n = 8 + Math.floor(Math.random() * 5);
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * Math.PI * 2;
      const r     = this.radius * (0.85 + Math.random() * 0.3);
      this.points.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
    }
  }

  update(dt) {
    this.y        += this.speedY   * dt;
    this.x        += this.speedX   * dt;
    this.rotation += this.rotSpeed * dt;
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);

    // Dark rock body (no shadowBlur — too expensive for many asteroids)
    ctx.fillStyle   = '#1D2536';
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.2)';
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.moveTo(this.points[0].x, this.points[0].y);
    for (let i = 1; i < this.points.length; i++) {
      ctx.lineTo(this.points[i].x, this.points[i].y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Outer glow ring — cheap arc instead of shadowBlur
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.08)';
    ctx.lineWidth   = 4;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius + 3, 0, Math.PI * 2);
    ctx.stroke();

    // Internal crater details
    ctx.fillStyle = '#121824';
    ctx.beginPath();
    ctx.arc(-this.radius * 0.3, -this.radius * 0.2, this.radius * 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(this.radius * 0.3, this.radius * 0.3, this.radius * 0.15, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

// ── Badge ─────────────────────────────────────────────────────────────────────
class Badge {
  constructor(name) {
    this.name       = name;
    this.x          = VIEW_WIDTH / 2;
    this.y          = -60;
    this.radius     = 18;
    this.speedY     = 85;
    this.bobbing    = 0;
    this.glowState  = 0;
    this.rotation   = 0;
  }

  update(dt) {
    this.y       += this.speedY * dt;
    this.bobbing += dt * 3.5;
    this.x        = VIEW_WIDTH / 2 + Math.sin(this.bobbing) * 55;
    this.rotation += dt * 1.5;
    this.glowState = 0.5 + Math.sin(this.bobbing * 2) * 0.4;
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);

    // Glow ring — two arcs instead of shadowBlur (much cheaper on mobile)
    const glowAlpha = 0.3 * this.glowState;
    ctx.strokeStyle = `rgba(255, 215, 0, ${glowAlpha})`;
    ctx.lineWidth   = 8;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius + 6, 0, Math.PI * 2);
    ctx.stroke();

    // Rotating dashed outer ring
    ctx.strokeStyle = '#D4AF37';
    ctx.lineWidth   = 2.2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.arc(0, 0, this.radius + 3, this.rotation, this.rotation + Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Inner gold orb gradient
    const gradient = ctx.createRadialGradient(0, 0, 2, 0, 0, this.radius);
    gradient.addColorStop(0,   '#FFF5CC');
    gradient.addColorStop(0.4, '#FFE894');
    gradient.addColorStop(0.8, '#D4AF37');
    gradient.addColorStop(1,   '#8A660D');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();

    // 4-point star insignia
    ctx.fillStyle = '#060B19';
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.quadraticCurveTo(0, 0,  9, 0);
    ctx.quadraticCurveTo(0, 0,  0, 9);
    ctx.quadraticCurveTo(0, 0, -9, 0);
    ctx.quadraticCurveTo(0, 0,  0, -9);
    ctx.fill();

    // Value name capsule above the badge
    ctx.translate(0, -this.radius - 12);
    const label     = this.name.toUpperCase();
    ctx.font        = 'bold 7.5px "Outfit", sans-serif';
    const labelW    = ctx.measureText(label).width + 16;
    ctx.fillStyle   = 'rgba(10, 18, 44, 0.95)';
    ctx.strokeStyle = '#D4AF37';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.roundRect(-labelW / 2, -7.5, labelW, 15, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle     = '#FFFFFF';
    ctx.textAlign     = 'center';
    ctx.textBaseline  = 'middle';
    ctx.fillText(label, 0, 0);

    ctx.restore();
  }
}

// ==========================================================================
// 8. Particle Systems
// ==========================================================================

function acquireParticle() {
  if (particlePool.length > 0) {
    return particlePool.pop();
  }
  return {};
}

function releaseParticle(p) {
  if (particlePool.length < MAX_PARTICLES) {
    particlePool.push(p);
  }
}

function spawnThrusterParticle(rx, ry) {
  if (particles.length > MAX_PARTICLES) return;
  const p = acquireParticle();
  const boostScale = boostActive ? 1.35 : 1;
  p.x     = rx + (Math.random() - 0.5) * 6 * boostScale;
  p.y     = ry + 5;
  p.vx    = (Math.random() - 0.5) * 18 * boostScale;
  p.vy    = 120 + Math.random() * 60 + (boostActive ? 45 : 0);
  p.size  = 2.5 + Math.random() * 3.5 * boostScale;
  p.alpha = 1.0;
  if (boostActive && Math.random() < 0.72) {
    p.color = '#FFD26C';
    p.decay = 1.3 + Math.random() * 1.2;
  } else {
    p.color = Math.random() > 0.45 ? '#FFEAA7' : '#E67E22';
    p.decay = 1.8 + Math.random() * 1.5;
  }
  particles.push(p);
}

function spawnExplosion(x, y, isBadge) {
  const count     = isBadge ? 30 : 20;
  const baseColor = isBadge ? '#FFD700' : '#E74C3C';
  for (let i = 0; i < count; i++) {
    if (particles.length > MAX_PARTICLES) break;
    const angle = Math.random() * Math.PI * 2;
    const speed = isBadge ? (50 + Math.random() * 140) : (40 + Math.random() * 100);
    const p = acquireParticle();
    p.x     = x;
    p.y     = y;
    p.vx    = Math.cos(angle) * speed;
    p.vy    = Math.sin(angle) * speed;
    p.size  = isBadge ? (1.5 + Math.random() * 3.5) : (2.0 + Math.random() * 4.5);
    p.alpha = 1.0;
    p.color = baseColor;
    p.decay = 1.2 + Math.random() * 1.5;
    particles.push(p);
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x     += p.vx * dt;
    p.y     += p.vy * dt;
    p.alpha -= p.decay * dt;
    if (p.alpha <= 0) {
      particles.splice(i, 1);
      releaseParticle(p);
    }
  }
}

function drawParticles() {
  const alphaBackup = ctx.globalAlpha;
  particles.forEach(p => {
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle   = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = alphaBackup;
}

// ==========================================================================
// 9. Planet Rendering (Earth & Moon — OffscreenCanvas cached)
// ==========================================================================

function drawEarth() {
  if (earth.y - earth.radius > VIEW_HEIGHT) return; // fully off-screen, skip

  ensureEarthCache();
  if (!earthCanvas) return;

  const r   = Math.ceil(earth.radius);
  const dim = (r + 30) * 2;

  // Rotate the cached Earth image at draw time instead of re-rendering gradients.
  ctx.save();
  ctx.translate(earth.x, earth.y);
  ctx.rotate(earthRotation);
  ctx.drawImage(earthCanvas, -dim / 2, -dim / 2, dim, dim);
  ctx.restore();
}

function drawMoon() {
  if (moon.alpha <= 0) return;

  ensureMoonCache();

  if (!moonCanvas) return;
  const r   = Math.ceil(moon.radius);
  const dim = (r + 50) * 2;
  ctx.globalAlpha = moon.alpha;
  ctx.drawImage(moonCanvas, moon.x - dim / 2, moon.y - dim / 2, dim, dim);
  ctx.globalAlpha = 1.0;
}

// ==========================================================================
// 10. Flag Rendering
// ==========================================================================

function drawFlag() {
  if (flag.state === 'HIDDEN') return;

  ctx.save();
  ctx.translate(flag.x, flag.y);

  const poleHeight = 65;
  const drawHeight = poleHeight * flag.timer; // grows from 0 → full

  // Gold flag pole
  ctx.strokeStyle = '#D4AF37';
  ctx.lineWidth   = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -drawHeight);
  ctx.stroke();

  // Banner (shown during UNFURLING and PLANTED)
  if (flag.state === 'UNFURLING' || flag.state === 'PLANTED') {
    const unfurlPct = flag.state === 'PLANTED' ? 1.0 : flag.timer;
    const unfurlW   = 38 * unfurlPct;

    if (unfurlW > 1) {
      ctx.save();
      ctx.translate(0, -drawHeight);

      const wave = Math.sin(Date.now() * 0.007) * 2;

      // Flag background
      const flagGrad = ctx.createLinearGradient(0, 0, unfurlW, 0);
      flagGrad.addColorStop(0, '#060E21');
      flagGrad.addColorStop(1, '#0C1C42');
      ctx.fillStyle   = flagGrad;
      ctx.strokeStyle = '#D4AF37';
      ctx.lineWidth   = 1;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(unfurlW / 3, wave, unfurlW * 2 / 3, -wave, unfurlW, 0);
      ctx.lineTo(unfurlW, 24);
      ctx.bezierCurveTo(unfurlW * 2 / 3, 24 - wave, unfurlW / 3, 24 + wave, 0, 24);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Text labels (only when wide enough)
      if (unfurlW > 20) {
        ctx.fillStyle   = '#D4AF37';
        ctx.font        = 'bold 7px "Cinzel", serif';
        ctx.textAlign   = 'center';
        ctx.fillText('S J S', unfurlW / 2, 11);
        ctx.font = '4.5px "Outfit", sans-serif';
        ctx.fillText('2026-27', unfurlW / 2, 19);
      }

      ctx.restore();
    }
  }

  ctx.restore();
}

// ==========================================================================
// 11. Game Controller & Core States
// ==========================================================================

function spawnToast(badgeName) {
  const toastContainer = document.getElementById('badge-toast');
  const toast          = document.createElement('div');
  toast.className      = 'badge-toast';
  toast.innerHTML      = `
    <span class="toast-crest">✦</span>
    <span class="toast-text">${badgeName} Collected</span>
  `;
  toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 2600);
}

/** Trigger haptic vibration on supported Android/iOS devices. */
function triggerVibration(pattern) {
  if ('vibrate' in navigator) {
    try { navigator.vibrate(pattern); } catch (e) { /* ignore */ }
  }
}

function handleBadgeCollection() {
  const badgeName = VALUE_BADGES[currentBadgeIndex];
  sfx.playCollect();
  triggerVibration([70, 30, 70]);
  spawnToast(badgeName);

  // Pause gameplay and show the fullscreen value modal
  gameState = 'PAUSE_COLLECT';
  sfx.stopEngine();

  const detail            = BADGE_DETAILS[badgeName];
  badgeModalIcon.textContent    = detail.emoji;
  badgeModalTitle.textContent   = badgeName;
  badgeModalMeaning.textContent = `"${detail.meaning}"`;
  badgeModal.classList.add('active');

  setTimeout(() => {
    badgeModal.classList.remove('active');
    currentBadgeIndex++;
    badgesCollectedText.textContent = currentBadgeIndex;
    activeBadge = null;

    if (gameState === 'PAUSE_COLLECT') {
      boostActive    = false;
      input.boost    = false;
      boostPointerId = null;
      updateBoostUI();
      gameState = 'GAMEPLAY';
      sfx.startEngine();
    }
  }, 1600);
}

function handleAsteroidCollision() {
  if (isInvulnerable) return;
  lives--;
  sfx.playCollision();
  triggerVibration(180);
  cameraShake = 16;
  spawnExplosion(rocket.x, rocket.y, false);
  updateHeartsUI();

  if (lives <= 0) {
    gameState = 'INTERRUPTED';
    sfx.stopEngine();
    interruptedScreen.classList.add('active');
  } else {
    isInvulnerable    = true;
    invulnerableTime  = 1.8;
  }
}

function updateHeartsUI() {
  hudHearts.forEach((heart, idx) => {
    heart.className = idx < lives ? 'heart active' : 'heart lost';
  });
}

function updateBoostUI() {
  if (!boostBarFill) return;
  boostBarFill.style.width = `${boostEnergy}%`;
  updateBoostButtonState();
}

/** Reset all game state and begin the launch animation. */
function startLaunchSequence() {
  gameState = 'LAUNCH';
  // Note: sfx.playClick() is intentionally NOT called here —
  // the button handler already called it before reaching this function.
  sfx.startAmbience();
  sfx.playLaunch();

  splashScreen.classList.remove('active');
  fullscreenPrompt.classList.remove('active');
  gameHud.classList.add('active');

  rocket     = new Rocket();
  asteroids  = [];
  activeBadge = null;
  particles  = [];

  progress          = 0;
  progressLerp      = 0;
  currentBadgeIndex = 0;
  lives             = 3;
  boostEnergy       = BOOST_MAX;
  boostActive       = false;
  boostPointerId    = null;
  spawnTimer        = 0;
  landingFlashAlpha = 0;
  updateHeartsUI();
  updateBoostUI();
  badgesCollectedText.textContent = '0';

  cameraZoom    = 1.0;
  cameraY       = 0;
  earthRotation = 0;

  earth.y      = VIEW_HEIGHT + 40;
  earth.radius = 240;
  lastEarthRadius   = -1; // invalidate cache for new run
  lastEarthRotation = -999;

  moon.y      = -220;
  moon.alpha  = 0;
  moon.radius = 110;
  lastMoonRadius = -1;

  flag.state = 'HIDDEN';
  flag.timer = 0;
  victoryScheduled = false;

  scrollSpeed       = 0.5;
  targetScrollSpeed = 10;

  // Delay engine hum until rocket is visibly accelerating
  setTimeout(() => {
    if (gameState === 'LAUNCH' || gameState === 'GAMEPLAY') {
      sfx.startEngine();
    }
  }, 600);
}

function triggerContinueMission() {
  sfx.playClick();
  interruptedScreen.classList.remove('active');
  lives            = 3;
  updateHeartsUI();
  isInvulnerable   = true;
  invulnerableTime = 2.5;
  boostActive    = false;
  input.boost    = false;
  boostPointerId = null;
  updateBoostUI();
  gameState        = 'GAMEPLAY';
  sfx.startEngine();
}

function resetVictoryTextSequence() {
  if (victoryTextTimer) {
    clearTimeout(victoryTextTimer);
    victoryTextTimer = null;
  }
  if (victoryButtonsTimer) {
    clearTimeout(victoryButtonsTimer);
    victoryButtonsTimer = null;
  }
  if (victoryPhase1) victoryPhase1.classList.remove('active');
  if (victoryPhase2) victoryPhase2.classList.remove('active');
  if (victoryButtons) victoryButtons.classList.remove('visible');
}

function beginVictorySequence() {
  if (gameState === 'VICTORY') return;

  gameState = 'VICTORY';
  gameHud.classList.remove('active');
  victoryScreen.classList.add('active');

  asteroids.length = 0;
  activeBadge = null;
  particles.length = 0;
  rocket = null;

  ctx.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  startVictoryFlagAnimation();
}

function beginVictoryTextSequence() {
  if (!victoryPhase1 || !victoryPhase2 || !victoryButtons) return;
  resetVictoryTextSequence();
  victoryPhase1.classList.add('active');
  victoryPhase2.classList.remove('active');
  victoryButtons.classList.remove('visible');

  victoryTextTimer = setTimeout(() => {
    victoryPhase1.classList.remove('active');
    victoryPhase2.classList.add('active');

    victoryButtonsTimer = setTimeout(() => {
      victoryButtons.classList.add('visible');
    }, 600);
  }, 2000);
}

function triggerReplay() {
  sfx.playClick();
  victoryScreen.classList.remove('active');
  resetVictoryTextSequence();
  stopVictoryFlagAnimation();
  startLaunchSequence();
}

// ==========================================================================
// 12. Core Game Loop — update()
// ==========================================================================

function update(dt) {
  dt = Math.min(dt, 0.1); // cap to prevent physics explosion on tab resume

  // Camera shake decay
  if (cameraShake > 0) {
    cameraShake -= dt * 45;
    if (cameraShake < 0) cameraShake = 0;
  }

  // Slowly rotate Earth texture every frame (cheap float add)
  earthRotation += dt * 0.006;

  // Landing flash decay
  if (landingFlashAlpha > 0) {
    landingFlashAlpha -= dt * 3.5;
    if (landingFlashAlpha < 0) landingFlashAlpha = 0;
  }

  // ── PAUSE_COLLECT ──────────────────────────────────────────────────────
  if (gameState === 'PAUSE_COLLECT') {
    // Keep background alive at reduced speed
    updateStars(dt * 0.15);
    updateParticles(dt * 0.5);
    return;
  }

  // ── LAUNCH ─────────────────────────────────────────────────────────────
  if (gameState === 'LAUNCH') {
    updateStars(dt);
    rocket.update(dt);
    updateParticles(dt);

    earth.y += 110 * dt; // Earth sinks as rocket rises

    if (scrollSpeed < targetScrollSpeed) scrollSpeed += dt * 5;

    if (earth.y - earth.radius > VIEW_HEIGHT) {
      gameState         = 'GAMEPLAY';
      scrollSpeed       = 4;
      targetScrollSpeed = 4;
    }
    return;
  }

  // ── GAMEPLAY ───────────────────────────────────────────────────────────
  if (gameState === 'GAMEPLAY') {
    updateStars(dt);
    rocket.update(dt);
    updateParticles(dt);

    if (isInvulnerable) {
      invulnerableTime -= dt;
      if (invulnerableTime <= 0) isInvulnerable = false;
    }

    // Hyper Boost energy management
      const isBoosting = input.boost && boostEnergy > BOOST_MIN_ACTIVATE;
    if (isBoosting) {
      if (!boostActive) {
        boostActive = true;
        boostIgnitionTime = 0;
        cameraShake = 2.2; // subtle initial ignition shake
        sfx.playBoost();
      }
      boostIgnitionTime += dt;
      boostEnergy -= BOOST_DRAIN_RATE * dt;
      if (boostEnergy <= 0) {
        boostEnergy = 0;
        boostActive = false;
      }
    } else {
      if (boostActive) boostActive = false;
      boostIgnitionTime = 0;
      boostEnergy += BOOST_RECOVER_RATE * dt;
      if (boostEnergy > BOOST_MAX) boostEnergy = BOOST_MAX;
    }

    if (sfx.engineGain && sfx.ctx) {
      const targetGain = boostActive ? BOOST_ENGINE_VOLUME_ACTIVE : BOOST_ENGINE_VOLUME_IDLE;
      sfx.engineGain.gain.setTargetAtTime(targetGain, sfx.ctx.currentTime, 0.08);
    }

    updateBoostUI();

    // Progress advances at constant rate; stalls at 96% if badges remain
    const progressSpeed = 100 / gameDuration;
    const progressMultiplier = boostActive
      ? (boostIgnitionTime < BOOST_IGNITION_DURATION ? BOOST_IGNITION_PROGRESS_MULTIPLIER : BOOST_PROGRESS_MULTIPLIER)
      : 1;
    if (progress < 96 || currentBadgeIndex >= 7) progress += progressSpeed * progressMultiplier * dt;

      if (progress >= 100) {
      progress          = 100;
      gameState         = 'LANDING';
      scrollSpeed       = 0;
      targetScrollSpeed = 0;
      landingFlashAlpha = 0.45; // subtle transition flash
      sfx.stopEngine();
      sfx.playLanding();
      landingTimer      = 0;
      victoryScheduled  = false;

      // Immediately disable all player control during landing.
      input.left      = false;
      input.right     = false;
      input.boost     = false;
      boostActive     = false;
      boostPointerId  = null;
      activePointers  = {};
      keys            = {};
      updateBoostButtonState();

      // Clear any remaining gameplay entities before the landing sequence.
      asteroids.length = 0;
      activeBadge = null;

      // Prevent the remainder of the gameplay frame from continuing physics.
      return;
    }

    // Smooth HUD progress bar (lerp toward real progress)
    progressLerp += (progress - progressLerp) * 4.5 * dt;
    progressBarFill.style.width    = `${progressLerp}%`;
    progressRocketHead.style.left  = `${progressLerp}%`;

    // Planet positions driven by progress
    earth.y   = VIEW_HEIGHT + 100 + (progress / 100) * 1200;
    if (progress > 55) {
      moon.alpha = Math.min((progress - 55) / 25, 1.0);
      moon.y     = -200 + ((progress - 55) / 45) * 440;
    }

    // Asteroid spawning
    spawnTimer += dt;
    if (spawnTimer >= 1.5) {
      spawnTimer = 0;
      asteroids.push(new Asteroid());
    }

    // Badge spawning at milestone checkpoints
    if (!activeBadge && currentBadgeIndex < 7) {
      const milestone = (currentBadgeIndex + 1) * 13;
      if (progress >= milestone) {
        activeBadge = new Badge(VALUE_BADGES[currentBadgeIndex]);
      }
    }

    // Asteroid updates + collision detection
    for (let i = asteroids.length - 1; i >= 0; i--) {
      const ast = asteroids[i];
      ast.update(dt);
      if (ast.y > VIEW_HEIGHT + 30 || ast.x < -30 || ast.x > VIEW_WIDTH + 30) {
        asteroids.splice(i, 1);
        continue;
      }
      const dist = Math.hypot(ast.x - rocket.x, ast.y - rocket.y);
      if (dist < ast.radius + rocket.width / 2.5) {
        handleAsteroidCollision();
        asteroids.splice(i, 1);
      }
    }

    // Badge update + collection detection
    if (activeBadge) {
      activeBadge.update(dt);
      if (activeBadge.y > VIEW_HEIGHT + 30) {
        activeBadge = null; // missed — respawns at next milestone check
      } else {
        const dist = Math.hypot(activeBadge.x - rocket.x, activeBadge.y - rocket.y);
        if (dist < activeBadge.radius + rocket.width / 1.8) {
          spawnExplosion(activeBadge.x, activeBadge.y, true);
          handleBadgeCollection();
        }
      }
    }
    return;
  }

  // ── LANDING ────────────────────────────────────────────────────────────
  if (gameState === 'LANDING') {
    updateStars(dt);
    updateParticles(dt);

    scrollSpeed = Math.max(scrollSpeed - dt * 3.5, 0);

    const surfaceY = moon.y + moon.radius - 210;

    // Rocket autopilot glides gently to centre and toward the lunar surface.
    const targetX = VIEW_WIDTH / 2;
    const targetY = surfaceY;
    rocket.x += (targetX - rocket.x) * 2.8 * dt;
    rocket.y += (targetY - rocket.y) * 1.8 * dt;

    // Cinematic camera zoom and slow drift
    cameraZoom += (1.5 - cameraZoom) * 0.9 * dt;
    cameraY    += (115  - cameraY)    * 0.85 * dt;

    // Moon drifts into view and grows softly
    moon.y      += (180 - moon.y)      * 1.1 * dt;
    moon.radius += (145 - moon.radius) * 0.85 * dt;

    // Snap final landing and camera values once close enough.
    if (Math.abs(rocket.x - targetX) < 1.5) {
      rocket.x = targetX;
      rocket.vx = 0;
    }
    if (Math.abs(rocket.y - targetY) < 1.5) {
      rocket.y = targetY;
    }
    if (Math.abs(cameraZoom - 1.5) < 0.002) cameraZoom = 1.5;
    if (Math.abs(cameraY - 115) < 0.5) cameraY = 115;
    if (Math.abs(moon.y - 180) < 0.5) moon.y = 180;
    if (Math.abs(moon.radius - 145) < 0.5) moon.radius = 145;

    if (Math.abs(rocket.x - targetX) < 3 && Math.abs(rocket.y - surfaceY) < 6) {
      rocket.y = surfaceY;
      if (flag.state === 'HIDDEN') {
        flag.state = 'PLANTING';
        flag.x     = VIEW_WIDTH / 2 - 35;
        flag.y     = surfaceY + 18;
        flag.timer = 0;
      }
    }

    if (flag.state === 'PLANTING') {
      flag.timer += dt * 1.1;
      if (flag.timer < 1) {
        for (let i = 0; i < 2; i++) {
          const p = acquireParticle();
          p.x     = rocket.x + (Math.random() - 0.5) * 18;
          p.y     = rocket.y + 22;
          p.vx    = (Math.random() - 0.5) * 40;
          p.vy    = -10 - Math.random() * 24;
          p.size  = 2.2 + Math.random() * 2.8;
          p.alpha = 0.65;
          p.color = '#CCC39F';
          p.decay = 1.1 + Math.random() * 1.1;
          particles.push(p);
        }
      }
      if (flag.timer >= 1) {
        flag.timer = 0;
        flag.state = 'UNFURLING';
      }
    } else if (flag.state === 'UNFURLING') {
      flag.timer += dt * 1.05;
      if (Math.random() < 0.14) {
        const p = acquireParticle();
        p.x     = flag.x + (Math.random() - 0.5) * 14;
        p.y     = flag.y - 65 * flag.timer;
        p.vx    = (Math.random() - 0.5) * 22;
        p.vy    = (Math.random() - 0.5) * 22 - 12;
        p.size  = 1.0 + Math.random() * 1.4;
        p.alpha = 1.0;
        p.color = '#FFD700';
        p.decay = 1.9;
        particles.push(p);
      }
      if (flag.timer >= 1) {
        flag.timer = 1;
        flag.state = 'PLANTED';
        if (!victoryScheduled) {
          victoryScheduled = true;
          setTimeout(() => {
            beginVictorySequence();
          }, 1400);
        }
      }
    } else if (flag.state === 'PLANTED' && !victoryScheduled) {
      victoryScheduled = true;
      setTimeout(() => {
        beginVictorySequence();
      }, 1400);
    }
    return;
  }
}

// ==========================================================================
// 13. Core Game Loop — draw()
// ==========================================================================

function draw() {
  ctx.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

  // Stars & nebula are drawn BEFORE camera transform so they remain
  // pinpoint-sharp regardless of the landing zoom factor.
  drawStars();

  // If we're in the Victory state, only render the static background
  // and the small planted flag. This prevents the large unfurling
  // banners and rocket fuselage from being drawn behind the overlay.
  if (gameState === 'VICTORY') {
    drawEarth();
    drawMoon();
    drawSmallPlantedFlag();
    // Victory uses the overlay DOM for text/buttons; draw any final
    // landing flash if applicable then return early.
    if (landingFlashAlpha > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${landingFlashAlpha})`;
      ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    }
    return;
  }

  // ── Camera transform for landing zoom ────────────────────────────────
  ctx.save();
  if (gameState === 'LANDING') {
    ctx.translate(VIEW_WIDTH / 2, VIEW_HEIGHT / 2);
    ctx.scale(cameraZoom, cameraZoom);
    ctx.translate(-VIEW_WIDTH / 2, -VIEW_HEIGHT / 2 + cameraY);
  }

  // Camera shake (applied on top of any zoom transform)
  if (cameraShake > 0) {
    const dx = (Math.random() - 0.5) * cameraShake;
    const dy = (Math.random() - 0.5) * cameraShake;
    ctx.translate(dx, dy);
  }

  // ── Scene objects ─────────────────────────────────────────────────────
  drawEarth();
  drawMoon();

  if (flag.state !== 'HIDDEN' && (gameState !== 'VICTORY' || flag.state === 'PLANTED')) {
    drawFlag();
  }

  const shouldRenderGameplayScene = gameState !== 'INTRO' && gameState !== 'FULLSCREEN_PROMPT' && gameState !== 'VICTORY';
  if (shouldRenderGameplayScene) {
    asteroids.forEach(ast => ast.draw());
    if (activeBadge) activeBadge.draw();
    drawParticles();
    if (rocket) rocket.draw();
  }

  ctx.restore();

  // ── GAMEPLAY → LANDING transition flash (drawn after restore, no transform) ──
  if (landingFlashAlpha > 0) {
    ctx.fillStyle   = `rgba(255, 255, 255, ${landingFlashAlpha})`;
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  }
}

// ==========================================================================
// 14. Victory Screen — Animated Waving Flag Canvas
// ==========================================================================

let victoryFlagAnimId = null;

function startVictoryFlagAnimation() {
  if (!vfCtx || !victoryFlagCanvas) return;
  stopVictoryFlagAnimation(); // ensure no duplicate loops

  function frame() {
    const w = victoryFlagCanvas.width;   // 160
    const h = victoryFlagCanvas.height;  // 80
    vfCtx.clearRect(0, 0, w, h);

    const t    = Date.now() * 0.005;
    const poleX = 18;

    // Moon surface (small arc at bottom)
    const moonGrad = vfCtx.createRadialGradient(w / 2, h + 20, 10, w / 2, h + 20, 60);
    moonGrad.addColorStop(0,   '#DCD09E');
    moonGrad.addColorStop(1,   '#A49867');
    vfCtx.fillStyle = moonGrad;
    vfCtx.beginPath();
    vfCtx.arc(w / 2, h + 20, 70, 0, Math.PI * 2);
    vfCtx.fill();

    // Gold flag pole
    vfCtx.strokeStyle = '#D4AF37';
    vfCtx.lineWidth   = 2.5;
    vfCtx.beginPath();
    vfCtx.moveTo(poleX, h - 8);
    vfCtx.lineTo(poleX, 8);
    vfCtx.stroke();

    // Waving flag banner
    const flagW = 110;
    const flagH = 30;
    const topY  = 10;

    const flagGrad = vfCtx.createLinearGradient(poleX, 0, poleX + flagW, 0);
    flagGrad.addColorStop(0,   '#060E21');
    flagGrad.addColorStop(1,   '#0C1C42');
    vfCtx.fillStyle   = flagGrad;
    vfCtx.strokeStyle = '#D4AF37';
    vfCtx.lineWidth   = 1;

    vfCtx.beginPath();
    vfCtx.moveTo(poleX, topY);
    for (let x = 0; x <= flagW; x += 2) {
      const wave = Math.sin((x / flagW) * Math.PI * 2 + t) * 4;
      vfCtx.lineTo(poleX + x, topY + wave);
    }
    for (let x = flagW; x >= 0; x -= 2) {
      const wave = Math.sin((x / flagW) * Math.PI * 2 + t) * 4;
      vfCtx.lineTo(poleX + x, topY + flagH + wave);
    }
    vfCtx.closePath();
    vfCtx.fill();
    vfCtx.stroke();

    // Text on flag
    vfCtx.fillStyle  = '#D4AF37';
    vfCtx.font       = 'bold 9px "Cinzel", serif';
    vfCtx.textAlign  = 'center';
    const midX       = poleX + flagW / 2;
    vfCtx.fillText('ST. JOSEPH\'S', midX, topY + 13);
    vfCtx.font = '7px "Outfit", sans-serif';
    vfCtx.fillText('RADIANCE 2026-27', midX, topY + 23);

    victoryFlagAnimId = requestAnimationFrame(frame);
  }

  victoryFlagAnimId = requestAnimationFrame(frame);
}

function stopVictoryFlagAnimation() {
  if (victoryFlagAnimId) {
    cancelAnimationFrame(victoryFlagAnimId);
    victoryFlagAnimId = null;
  }
}

// ==========================================================================
// 15. Main Game Loop
// ==========================================================================

function loop(timestamp) {
  if (gamePaused) {
    lastTime = 0; // reset so dt doesn't spike on resume
    requestAnimationFrame(loop);
    return;
  }

  if (!lastTime) lastTime = timestamp;
  const dt = (timestamp - lastTime) / 1000;
  lastTime = timestamp;

  update(dt);
  draw();

  requestAnimationFrame(loop);
}

// ==========================================================================
// 16. Initialization & Event Wiring
// ==========================================================================

function toggleFullscreen() {
  const el  = document.documentElement;
  const req = el.requestFullscreen || el.mozRequestFullScreen ||
              el.webkitRequestFullscreen || el.msRequestFullscreen;
  if (req) req.call(el).catch(() => { /* Fullscreen refused — continue anyway */ });
}

function setupSoundBtn() {
  btnMute.addEventListener('click', e => {
    e.stopPropagation();
    const isMuted = sfx.toggleMute();
    soundOnIcon.classList.toggle('hidden',  isMuted);
    soundOffIcon.classList.toggle('hidden', !isMuted);
  });
}

/**
 * Page Visibility API — pause/resume audio & game loop
 * when the browser tab is hidden or the app goes to background.
 */
function setupVisibilityHandling() {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      gamePaused = true;
      sfx.suspend();
    } else {
      gamePaused = false;
      sfx.resume();
      lastTime = 0; // prevent dt spike after long pause
    }
  });

  // Pause on window blur (desktop tab switch / phone home button)
  window.addEventListener('blur', () => {
    gamePaused = true;
    sfx.suspend();
  });

  window.addEventListener('focus', () => {
    gamePaused = false;
    sfx.resume();
    lastTime = 0;
  });
}

function init() {
  setupCanvas();
  generateStars();
  bindControls();
  setupSoundBtn();
  setupVisibilityHandling();

  // Invalidate planet caches on orientation/resize
  window.addEventListener('resize', () => {
    setupCanvas();
    checkOrientation();
    nebulaGradientCache = null;
  });
  checkOrientation();

  // ── Button event handlers ────────────────────────────────────────────

  btnBegin.addEventListener('click', () => {
    sfx.playClick();
    sfx.startAmbience();

    const isFSSupported = document.fullscreenEnabled || document.webkitFullscreenEnabled;
    if (isFSSupported) {
      splashScreen.classList.remove('active');
      fullscreenPrompt.classList.add('active');
      gameState = 'FULLSCREEN_PROMPT';
    } else {
      startLaunchSequence();
    }
  });

  btnFullscreen.addEventListener('click', () => {
    toggleFullscreen();
    startLaunchSequence();
  });

  btnSkipFullscreen.addEventListener('click', () => {
    startLaunchSequence();
  });

  btnContinue.addEventListener('click', () => {
    triggerContinueMission();
  });

  if (btnBoost) {
    btnBoost.addEventListener('pointerdown', e => {
      if (gameState !== 'GAMEPLAY') return;
      e.preventDefault();
      e.stopPropagation();
      activateBoostInput(e.pointerId);
    }, { passive: false });

    btnBoost.addEventListener('pointerup', e => {
      deactivateBoostInput(e.pointerId);
    });

    btnBoost.addEventListener('pointercancel', e => {
      deactivateBoostInput(e.pointerId);
    });

    btnBoost.addEventListener('touchstart', e => {
      e.preventDefault();
    }, { passive: false });
  }

  btnReplay.addEventListener('click', () => {
    triggerReplay();
  });

  btnMagazine.addEventListener('click', () => {
    sfx.playClick();
    // Open the Heyzine magazine link in a new tab
    if (MAGAZINE_URL && MAGAZINE_URL !== '#') {
      window.open(MAGAZINE_URL, '_blank', 'noopener,noreferrer');
    } else {
      // MAGAZINE_URL is placeholder — notify developer in console only
      console.info('Mission Radiance: Set MAGAZINE_URL at the top of game.js before deployment.');
    }
  });

  // Start main loop
  requestAnimationFrame(loop);
}

window.addEventListener('DOMContentLoaded', init);
