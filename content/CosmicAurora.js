/**
 * CosmicAurora - PixiJS v8 Animation Components
 * 
 * Features: Object pooling, layered particles, energy waves, interactive bursts
 * Uses PixiContext dependency injection pattern
 * 
 * Components:
 * - AuroraStreamer: Background flowing ribbons of light
 * - StarField: Twinkling stars with varying brightness
 * - FloatingOrbs: Gently floating particles with glow
 * - NovaBurst: Explosive particle burst (pooled)
 * - ShockwaveRing: Expanding energy rings (pooled)
 * - EnergyCore: Pulsing central energy source
 * 
 * @example
 * // Setup context
 * const ctx = createPixiContext(PIXI, { gsap, PixiPlugin }, app);
 * 
 * // Create components
 * const aurora = new AuroraStreamer(ctx, { width: 800, height: 600 });
 * stage.addChild(aurora.container);
 * aurora.start();
 */

// ─────────────────────────────────────────────────────────────────────────────
// PIXI CONTEXT FACTORY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a PixiContext for dependency injection
 * @param {object} pixiModule - PIXI namespace
 * @param {object} gsapModule - { gsap, PixiPlugin }
 * @param {PIXI.Application} app - Initialized PIXI application
 * @param {object} [config] - Optional overrides
 * @returns {object} Frozen context object
 */
function createPixiContext(pixiModule, gsapModule, app, config = {}) {
  if (!pixiModule) {
    throw new Error('PixiContext: pixiModule is required');
  }
  if (!gsapModule?.gsap) {
    throw new Error('PixiContext: gsapModule with gsap is required');
  }
  if (!app?.stage) {
    throw new Error('PixiContext: app with stage is required');
  }

  const { gsap, PixiPlugin } = gsapModule;
  if (PixiPlugin && !gsap.plugins?.pixi) {
    gsap.registerPlugin(PixiPlugin);
    PixiPlugin.registerPIXI(pixiModule);
  }

  return Object.freeze({
    app,
    stage: app.stage,
    ticker: config.ticker ?? app.ticker,
    renderer: app.renderer,
    gsap,
    classes: Object.freeze({
      Container: pixiModule.Container,
      Graphics: pixiModule.Graphics,
      Sprite: pixiModule.Sprite,
      Text: pixiModule.Text,
      Point: pixiModule.Point,
    }),
    create: Object.freeze({
      container: () => new pixiModule.Container(),
      graphics: () => new pixiModule.Graphics(),
      point: (x = 0, y = 0) => new pixiModule.Point(x, y),
    }),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY: Easing Functions
// ─────────────────────────────────────────────────────────────────────────────

const Easing = {
  easeOutCubic: t => 1 - Math.pow(1 - t, 3),
  easeOutQuart: t => 1 - Math.pow(1 - t, 4),
  easeInOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2,
  easeOutElastic: t => {
    const c4 = (2 * Math.PI) / 3;
    return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT: Aurora Streamer (Background Layer)
// Gentle, flowing ribbons of light
// ─────────────────────────────────────────────────────────────────────────────

class AuroraStreamer {
  static defaults = {
    width: 800,
    height: 600,
    streamerCount: 5,
    colors: [0x00ff88, 0x00ffcc, 0x88ffff, 0xff88ff, 0x8888ff],
    speed: 0.3
  };

  /**
   * @param {object} ctx - PixiContext
   * @param {object} [options] - Configuration
   */
  constructor(ctx, options = {}) {
    if (!ctx?.classes) throw new Error('AuroraStreamer: ctx.classes is required');

    this.ticker = ctx.ticker;
    this.classes = ctx.classes;
    this.gsap = ctx.gsap;
    this.options = { ...AuroraStreamer.defaults, ...options };

    this._destroyed = false;
    this._isRunning = false;
    this._elapsed = 0;
    this._boundUpdate = this._update.bind(this);
    this._streamers = [];

    this.container = new this.classes.Container();
    this._setup();
  }

  _setup() {
    const { width, height, streamerCount, colors } = this.options;

    for (let i = 0; i < streamerCount; i++) {
      const graphics = new this.classes.Graphics();
      graphics._phase = (i / streamerCount) * Math.PI * 2;
      graphics._baseY = height * 0.3 + (i * height * 0.1);
      graphics._color = colors[i % colors.length];
      graphics._amplitude = 50 + Math.random() * 30;
      graphics._frequency = 0.005 + Math.random() * 0.003;
      this._streamers.push(graphics);
      this.container.addChild(graphics);
    }
  }

  start() {
    if (this._destroyed || this._isRunning) return this;
    this._isRunning = true;
    this.ticker.add(this._boundUpdate);
    return this;
  }

  stop() {
    if (!this._isRunning) return this;
    this._isRunning = false;
    this.ticker.remove(this._boundUpdate);
    return this;
  }

  _update(ticker) {
    const delta = ticker.deltaTime;
    this._elapsed += delta * this.options.speed * 0.016;
    const { width, height } = this.options;

    for (const streamer of this._streamers) {
      streamer.clear();

      const points = [];
      for (let x = 0; x <= width; x += 20) {
        const wave1 = Math.sin(x * streamer._frequency + this._elapsed + streamer._phase);
        const wave2 = Math.sin(x * streamer._frequency * 0.5 + this._elapsed * 0.7);
        const y = streamer._baseY + (wave1 + wave2 * 0.5) * streamer._amplitude;
        points.push({ x, y });
      }

      streamer.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length - 2; i++) {
        const xc = (points[i].x + points[i + 1].x) / 2;
        const yc = (points[i].y + points[i + 1].y) / 2;
        streamer.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
      }

      streamer.lineTo(width, height);
      streamer.lineTo(0, height);
      streamer.closePath();
      streamer.fill({ color: streamer._color, alpha: 0.08 });
    }
  }

  reset() {
    this.stop();
    this._elapsed = 0;
    return this;
  }

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    this.stop();
    this._streamers = [];
    this._boundUpdate = null;
    this.container.destroy({ children: true });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT: Star Field (Background Layer)
// Twinkling stars with varying sizes and brightness
// ─────────────────────────────────────────────────────────────────────────────

class StarField {
  static defaults = {
    width: 800,
    height: 600,
    starCount: 150,
    twinkleSpeed: 0.02
  };

  /**
   * @param {object} ctx - PixiContext
   * @param {object} [options] - Configuration
   */
  constructor(ctx, options = {}) {
    if (!ctx?.classes) throw new Error('StarField: ctx.classes is required');

    this.ticker = ctx.ticker;
    this.classes = ctx.classes;
    this.gsap = ctx.gsap;
    this.options = { ...StarField.defaults, ...options };

    this._destroyed = false;
    this._isRunning = false;
    this._elapsed = 0;
    this._boundUpdate = this._update.bind(this);
    this._stars = [];

    this.container = new this.classes.Container();
    this._setup();
  }

  _setup() {
    const { width, height, starCount } = this.options;

    for (let i = 0; i < starCount; i++) {
      const star = new this.classes.Graphics();
      const size = Math.random() < 0.1 ? 2 + Math.random() * 2 : 0.5 + Math.random() * 1.5;

      star.circle(0, 0, size);
      star.fill({ color: 0xffffff });

      star.x = Math.random() * width;
      star.y = Math.random() * height;
      star._phase = Math.random() * Math.PI * 2;
      star._speed = 0.5 + Math.random() * 1.5;
      star._baseAlpha = 0.3 + Math.random() * 0.7;

      this._stars.push(star);
      this.container.addChild(star);
    }
  }

  start() {
    if (this._destroyed || this._isRunning) return this;
    this._isRunning = true;
    this.ticker.add(this._boundUpdate);
    return this;
  }

  stop() {
    if (!this._isRunning) return this;
    this._isRunning = false;
    this.ticker.remove(this._boundUpdate);
    return this;
  }

  _update(ticker) {
    const delta = ticker.deltaTime;
    this._elapsed += delta * this.options.twinkleSpeed;

    for (const star of this._stars) {
      const twinkle = Math.sin(this._elapsed * star._speed + star._phase);
      star.alpha = star._baseAlpha * (0.5 + twinkle * 0.5);
    }
  }

  reset() {
    this.stop();
    this._elapsed = 0;
    return this;
  }

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    this.stop();
    this._stars = [];
    this._boundUpdate = null;
    this.container.destroy({ children: true });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT: Floating Orbs (Mid Layer)
// Gently floating particles with glow effect
// ─────────────────────────────────────────────────────────────────────────────

class FloatingOrbs {
  static defaults = {
    width: 800,
    height: 600,
    orbCount: 25,
    colors: [0xff2bff, 0x3affff, 0x88ff88, 0xffff88, 0xff8888]
  };

  /**
   * @param {object} ctx - PixiContext
   * @param {object} [options] - Configuration
   */
  constructor(ctx, options = {}) {
    if (!ctx?.classes) throw new Error('FloatingOrbs: ctx.classes is required');

    this.ticker = ctx.ticker;
    this.classes = ctx.classes;
    this.gsap = ctx.gsap;
    this.options = { ...FloatingOrbs.defaults, ...options };

    this._destroyed = false;
    this._isRunning = false;
    this._elapsed = 0;
    this._boundUpdate = this._update.bind(this);
    this._orbs = [];

    this.container = new this.classes.Container();
    this._setup();
  }

  _setup() {
    const { width, height, orbCount, colors } = this.options;

    for (let i = 0; i < orbCount; i++) {
      const orbContainer = new this.classes.Container();
      const color = colors[Math.floor(Math.random() * colors.length)];
      const size = 3 + Math.random() * 8;

      // Glow layer
      const glow = new this.classes.Graphics();
      glow.circle(0, 0, size * 3);
      glow.fill({ color, alpha: 0.1 });
      orbContainer.addChild(glow);

      // Core
      const core = new this.classes.Graphics();
      core.circle(0, 0, size);
      core.fill({ color, alpha: 0.8 });
      orbContainer.addChild(core);

      orbContainer.x = Math.random() * width;
      orbContainer.y = Math.random() * height;
      orbContainer._baseX = orbContainer.x;
      orbContainer._baseY = orbContainer.y;
      orbContainer._phaseX = Math.random() * Math.PI * 2;
      orbContainer._phaseY = Math.random() * Math.PI * 2;
      orbContainer._amplitudeX = 20 + Math.random() * 40;
      orbContainer._amplitudeY = 15 + Math.random() * 30;
      orbContainer._speedX = 0.3 + Math.random() * 0.4;
      orbContainer._speedY = 0.2 + Math.random() * 0.3;

      this._orbs.push(orbContainer);
      this.container.addChild(orbContainer);
    }
  }

  start() {
    if (this._destroyed || this._isRunning) return this;
    this._isRunning = true;
    this.ticker.add(this._boundUpdate);
    return this;
  }

  stop() {
    if (!this._isRunning) return this;
    this._isRunning = false;
    this.ticker.remove(this._boundUpdate);
    return this;
  }

  _update(ticker) {
    const delta = ticker.deltaTime;
    this._elapsed += delta * 0.016;

    for (const orb of this._orbs) {
      orb.x = orb._baseX + Math.sin(this._elapsed * orb._speedX + orb._phaseX) * orb._amplitudeX;
      orb.y = orb._baseY + Math.sin(this._elapsed * orb._speedY + orb._phaseY) * orb._amplitudeY;
    }
  }

  reset() {
    this.stop();
    this._elapsed = 0;
    return this;
  }

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    this.stop();
    this._orbs = [];
    this._boundUpdate = null;
    this.container.destroy({ children: true });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT: Nova Burst (Interactive Effect)
// Explosive particle burst with pooling
// ─────────────────────────────────────────────────────────────────────────────

class NovaBurst {
  static defaults = {
    poolSize: 150,
    colors: [0xff2bff, 0x3affff, 0xffffff, 0xffff88]
  };

  /**
   * @param {object} ctx - PixiContext
   * @param {object} [options] - Configuration
   */
  constructor(ctx, options = {}) {
    if (!ctx?.classes) throw new Error('NovaBurst: ctx.classes is required');

    this.ticker = ctx.ticker;
    this.classes = ctx.classes;
    this.gsap = ctx.gsap;
    this.options = { ...NovaBurst.defaults, ...options };

    this._destroyed = false;
    this._isRunning = false;
    this._boundUpdate = this._update.bind(this);
    this._pool = [];
    this._active = [];

    this.container = new this.classes.Container();
    this._setup();
  }

  _setup() {
    const { poolSize, colors } = this.options;

    for (let i = 0; i < poolSize; i++) {
      const particle = new this.classes.Graphics();
      const color = colors[i % colors.length];
      const size = 2 + Math.random() * 4;

      particle.circle(0, 0, size * 2);
      particle.fill({ color, alpha: 0.3 });
      particle.circle(0, 0, size);
      particle.fill({ color, alpha: 0.8 });

      particle.visible = false;
      particle._poolIndex = i;
      particle._vx = 0;
      particle._vy = 0;
      particle._life = 0;
      particle._maxLife = 1;
      particle._gravity = 0;
      particle._friction = 0.98;
      particle._rotationSpeed = 0;

      this._pool.push(particle);
      this.container.addChild(particle);
    }
  }

  start() {
    if (this._destroyed || this._isRunning) return this;
    this._isRunning = true;
    this.ticker.add(this._boundUpdate);
    return this;
  }

  stop() {
    if (!this._isRunning) return this;
    this._isRunning = false;
    this.ticker.remove(this._boundUpdate);
    return this;
  }

  _spawn() {
    if (this._pool.length === 0) return null;
    const particle = this._pool.pop();
    particle.visible = true;
    particle._poolIndex = this._active.length;
    this._active.push(particle);
    return particle;
  }

  _recycle(particle) {
    particle.visible = false;
    // O(1) swap-and-pop
    const index = particle._poolIndex;
    if (index < 0 || index >= this._active.length) return;
    const last = this._active[this._active.length - 1];
    this._active[index] = last;
    last._poolIndex = index;
    this._active.pop();
    this._pool.push(particle);
  }

  emit(x, y, count = 80) {
    // Primary burst
    for (let i = 0; i < count; i++) {
      const p = this._spawn();
      if (!p) break;

      p.x = x;
      p.y = y;
      p._life = 0;
      p._maxLife = 0.6 + Math.random() * 0.6;

      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const speed = 8 + Math.random() * 12;
      p._vx = Math.cos(angle) * speed;
      p._vy = Math.sin(angle) * speed;
      p._gravity = 0.08;
      p._friction = 0.97;
      p._rotationSpeed = (Math.random() - 0.5) * 0.3;
      p.scale.set(1.5);
    }

    // Secondary ring burst
    const secondaryCount = Math.floor(count * 0.3);
    for (let i = 0; i < secondaryCount; i++) {
      const p = this._spawn();
      if (!p) break;

      p.x = x;
      p.y = y;
      p._life = -0.05;
      p._maxLife = 0.8 + Math.random() * 0.4;

      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 5;
      p._vx = Math.cos(angle) * speed;
      p._vy = Math.sin(angle) * speed;
      p._gravity = 0.02;
      p._friction = 0.99;
      p._rotationSpeed = (Math.random() - 0.5) * 0.1;
      p.scale.set(0.8);
    }

    return this;
  }

  _update(ticker) {
    const delta = ticker.deltaTime;

    for (let i = this._active.length - 1; i >= 0; i--) {
      const p = this._active[i];
      p._life += delta * 0.016;

      if (p._life >= p._maxLife) {
        this._recycle(p);
        continue;
      }

      p._vy += p._gravity * delta;
      p._vx *= p._friction;
      p._vy *= p._friction;

      p.x += p._vx * delta;
      p.y += p._vy * delta;
      p.rotation += p._rotationSpeed * delta;

      const lifeRatio = p._life / p._maxLife;
      p.alpha = Easing.easeOutCubic(1 - lifeRatio);
      p.scale.set(1 - lifeRatio * 0.5);
    }
  }

  reset() {
    while (this._active.length > 0) {
      this._recycle(this._active[0]);
    }
    return this;
  }

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    this.stop();
    this._pool = [];
    this._active = [];
    this._boundUpdate = null;
    this.container.destroy({ children: true });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT: Shockwave Ring (Interactive Effect)
// Expanding energy ring with chromatic aberration feel
// ─────────────────────────────────────────────────────────────────────────────

class ShockwaveRing {
  static defaults = {
    poolSize: 10
  };

  /**
   * @param {object} ctx - PixiContext
   * @param {object} [options] - Configuration
   */
  constructor(ctx, options = {}) {
    if (!ctx?.classes) throw new Error('ShockwaveRing: ctx.classes is required');

    this.ticker = ctx.ticker;
    this.classes = ctx.classes;
    this.gsap = ctx.gsap;
    this.options = { ...ShockwaveRing.defaults, ...options };

    this._destroyed = false;
    this._isRunning = false;
    this._boundUpdate = this._update.bind(this);
    this._pool = [];
    this._active = [];

    this.container = new this.classes.Container();
    this._setup();
  }

  _setup() {
    const { poolSize } = this.options;

    for (let i = 0; i < poolSize; i++) {
      const ring = new this.classes.Container();

      // Cyan outer ring
      const outer = new this.classes.Graphics();
      outer.circle(0, 0, 100);
      outer.stroke({ color: 0x3affff, width: 4, alpha: 0.8 });
      ring.addChild(outer);

      // Magenta middle ring
      const middle = new this.classes.Graphics();
      middle.circle(0, 0, 100);
      middle.stroke({ color: 0xff2bff, width: 3, alpha: 0.6 });
      ring.addChild(middle);

      // White inner ring
      const inner = new this.classes.Graphics();
      inner.circle(0, 0, 100);
      inner.stroke({ color: 0xffffff, width: 2, alpha: 0.9 });
      ring.addChild(inner);

      ring.visible = false;
      ring._poolIndex = i;
      ring._life = 0;
      ring._maxLife = 1;
      ring._outer = outer;
      ring._middle = middle;
      ring._inner = inner;

      this._pool.push(ring);
      this.container.addChild(ring);
    }
  }

  start() {
    if (this._destroyed || this._isRunning) return this;
    this._isRunning = true;
    this.ticker.add(this._boundUpdate);
    return this;
  }

  stop() {
    if (!this._isRunning) return this;
    this._isRunning = false;
    this.ticker.remove(this._boundUpdate);
    return this;
  }

  _spawn() {
    if (this._pool.length === 0) return null;
    const ring = this._pool.pop();
    ring.visible = true;
    ring._poolIndex = this._active.length;
    this._active.push(ring);
    return ring;
  }

  _recycle(ring) {
    ring.visible = false;
    const index = ring._poolIndex;
    if (index < 0 || index >= this._active.length) return;
    const last = this._active[this._active.length - 1];
    this._active[index] = last;
    last._poolIndex = index;
    this._active.pop();
    this._pool.push(ring);
  }

  emit(x, y) {
    const ring = this._spawn();
    if (!ring) return this;

    ring.x = x;
    ring.y = y;
    ring._life = 0;
    ring._maxLife = 0.8;
    ring.scale.set(0.1);
    ring.alpha = 1;

    return this;
  }

  _update(ticker) {
    const delta = ticker.deltaTime;

    for (let i = this._active.length - 1; i >= 0; i--) {
      const ring = this._active[i];
      ring._life += delta * 0.016;

      if (ring._life >= ring._maxLife) {
        this._recycle(ring);
        continue;
      }

      const lifeRatio = ring._life / ring._maxLife;
      const scale = Easing.easeOutQuart(lifeRatio) * 3;
      ring.scale.set(scale);
      ring.alpha = 1 - Easing.easeOutCubic(lifeRatio);

      // Chromatic separation effect
      const separation = lifeRatio * 0.15;
      ring._outer.scale.set(1 + separation);
      ring._middle.scale.set(1);
      ring._inner.scale.set(1 - separation * 0.5);
    }
  }

  reset() {
    while (this._active.length > 0) {
      this._recycle(this._active[0]);
    }
    return this;
  }

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    this.stop();
    this._pool = [];
    this._active = [];
    this._boundUpdate = null;
    this.container.destroy({ children: true });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT: Energy Core (Center Attraction)
// Pulsing energy core
// ─────────────────────────────────────────────────────────────────────────────

class EnergyCore {
  static defaults = {
    baseRadius: 30,
    pulseAmount: 0.3,
    pulseSpeed: 2
  };

  /**
   * @param {object} ctx - PixiContext
   * @param {object} [options] - Configuration
   */
  constructor(ctx, options = {}) {
    if (!ctx?.classes) throw new Error('EnergyCore: ctx.classes is required');

    this.ticker = ctx.ticker;
    this.classes = ctx.classes;
    this.gsap = ctx.gsap;
    this.options = { ...EnergyCore.defaults, ...options };

    this._destroyed = false;
    this._isRunning = false;
    this._elapsed = 0;
    this._boundUpdate = this._update.bind(this);

    this.container = new this.classes.Container();
    this._setup();
  }

  _setup() {
    const { baseRadius } = this.options;

    // Outer glow
    this._outerGlow = new this.classes.Graphics();
    this._outerGlow.circle(0, 0, baseRadius * 3);
    this._outerGlow.fill({ color: 0x3affff, alpha: 0.05 });
    this.container.addChild(this._outerGlow);

    // Mid glow
    this._midGlow = new this.classes.Graphics();
    this._midGlow.circle(0, 0, baseRadius * 2);
    this._midGlow.fill({ color: 0xff2bff, alpha: 0.1 });
    this.container.addChild(this._midGlow);

    // Inner glow
    this._innerGlow = new this.classes.Graphics();
    this._innerGlow.circle(0, 0, baseRadius * 1.5);
    this._innerGlow.fill({ color: 0xffffff, alpha: 0.15 });
    this.container.addChild(this._innerGlow);

    // Core
    this._core = new this.classes.Graphics();
    this._core.circle(0, 0, baseRadius * 0.5);
    this._core.fill({ color: 0xffffff, alpha: 0.8 });
    this.container.addChild(this._core);
  }

  start() {
    if (this._destroyed || this._isRunning) return this;
    this._isRunning = true;
    this.ticker.add(this._boundUpdate);
    return this;
  }

  stop() {
    if (!this._isRunning) return this;
    this._isRunning = false;
    this.ticker.remove(this._boundUpdate);
    return this;
  }

  _update(ticker) {
    const delta = ticker.deltaTime;
    this._elapsed += delta * this.options.pulseSpeed * 0.016;

    const pulse = Math.sin(this._elapsed * Math.PI * 2);
    const { pulseAmount } = this.options;

    this._outerGlow.scale.set(1 + pulse * pulseAmount * 0.5);
    this._midGlow.scale.set(1 + pulse * pulseAmount * 0.3);
    this._innerGlow.scale.set(1 + pulse * pulseAmount * 0.2);
    this._core.scale.set(1 + pulse * pulseAmount * 0.1);

    this._outerGlow.alpha = 0.05 + pulse * 0.02;
    this._midGlow.alpha = 0.1 + pulse * 0.05;
  }

  setPosition(x, y) {
    this.container.position.set(x, y);
    return this;
  }

  reset() {
    this.stop();
    this._elapsed = 0;
    return this;
  }

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    this.stop();
    this._boundUpdate = null;
    this.container.destroy({ children: true });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

export {
  createPixiContext,
  Easing,
  AuroraStreamer,
  StarField,
  FloatingOrbs,
  NovaBurst,
  ShockwaveRing,
  EnergyCore
};

export default {
  createPixiContext,
  Easing,
  AuroraStreamer,
  StarField,
  FloatingOrbs,
  NovaBurst,
  ShockwaveRing,
  EnergyCore
};
