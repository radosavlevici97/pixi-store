/**
 * GoldenStarCharge - Casino-Grade Energy Charge-Up
 * PixiJS v8 Component | PixiContext Architecture
 * 
 * Themed for casino/slot games with warm golden energy,
 * purple/magenta glows, star particles, and magical sparkles.
 * 
 * VISUAL FEATURES:
 * - Golden multi-layer core with warm glow
 * - Vortex particles spiraling inward (absorbed energy)
 * - Floating star particles orbiting
 * - Magical sparkle bursts
 * - Purple/magenta atmospheric glow
 * - Soft bokeh-style background particles
 * 
 * RELEASE EXPLOSION:
 * - Golden shockwave burst
 * - Star particle explosion
 * - Radiant light rays
 * - Magical sparkle shower
 * - Warm afterglow
 * 
 * @example
 * // Create context
 * const ctx = createPixiContext(PIXI, { gsap, PixiPlugin }, app);
 * 
 * // Create component
 * const charge = new GoldenStarCharge(ctx, {
 *   container: app.stage,
 *   maxRadius: 120
 * });
 * 
 * // Start charge-up
 * charge.start();
 * 
 * // Listen for events
 * charge.onPeak.add(() => console.log('Fully charged!'));
 * charge.onReleaseComplete.add(() => console.log('Release done!'));
 * 
 * // Trigger release when ready
 * charge.release();
 */

// ============================================================================
// SIGNAL CLASS
// ============================================================================

class Signal {
  constructor() {
    this._listeners = new Set();
    this._onceListeners = new Set();
    this._iterationSnapshot = [];
  }

  add(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  once(fn) {
    this._onceListeners.add(fn);
    return () => this._onceListeners.delete(fn);
  }

  remove(fn) {
    this._listeners.delete(fn);
    this._onceListeners.delete(fn);
  }

  emit(data) {
    this._iterationSnapshot.length = 0;
    for (const fn of this._listeners) {
      this._iterationSnapshot.push(fn);
    }
    for (const fn of this._onceListeners) {
      this._iterationSnapshot.push(fn);
    }
    this._onceListeners.clear();

    for (const fn of this._iterationSnapshot) {
      try {
        fn(data);
      } catch (err) {
        console.error('[Signal] Listener error:', err);
      }
    }
  }

  clear() {
    this._listeners.clear();
    this._onceListeners.clear();
    this._iterationSnapshot.length = 0;
  }

  get hasListeners() {
    return this._listeners.size > 0 || this._onceListeners.size > 0;
  }

  get listenerCount() {
    return this._listeners.size + this._onceListeners.size;
  }
}

// ============================================================================
// GOLDEN STAR CHARGE COMPONENT
// ============================================================================

class GoldenStarCharge {
  /**
   * Default configuration
   */
  static defaults = {
    // Dimensions (used to calculate center position)
    width: 800,
    height: 600,

    // Size
    maxRadius: 120,

    // Timing (ms)
    ignitionDuration: 150,
    accumulationDuration: 500,
    peakDuration: 200,
    releaseDuration: 600,

    // Visual counts
    vortexParticleCount: 35,
    starCount: 16,
    sparkleCount: 24,
    bokehCount: 12,
    rayCount: 10,

    // Casino Theme Colors
    goldLight: 0xffd700,      // Bright gold
    goldMid: 0xffa500,        // Orange gold
    goldDark: 0xff8c00,       // Dark gold
    magenta: 0xff00ff,        // Hot pink/magenta
    purple: 0x8b008b,         // Deep purple
    purpleDark: 0x4b0082,     // Indigo
    white: 0xffffff,          // Sparkle white

    // Quality
    quality: 'high',

    // Auto-start
    autoStart: false,

    // Auto-release: automatically trigger release after holding for holdDuration
    autoRelease: true,
    holdDuration: 800, // ms to hold at peak before auto-releasing
  };

  /**
   * @param {PixiContext} ctx - Context from createPixiContext()
   * @param {object} options - Component configuration
   */
  constructor(ctx, options = {}) {
    // 1. Validate required parameters
    if (!ctx?.classes) {
      throw new Error('GoldenStarCharge: ctx (PixiContext) is required');
    }
    if (!ctx?.gsap) {
      throw new Error('GoldenStarCharge: ctx.gsap is required');
    }
    if (!options.container) {
      throw new Error('GoldenStarCharge: options.container is required');
    }

    // 2. Store context references
    this.ticker = ctx.ticker;
    this.classes = ctx.classes;
    this.create = ctx.create;
    this.gsap = ctx.gsap;

    // 3. Store container reference
    this.container = options.container;

    // 4. Merge options with defaults
    this.options = { ...GoldenStarCharge.defaults, ...options };

    // 5. Initialize signals
    this.onPeak = new Signal();
    this.onReleaseStart = new Signal();
    this.onReleaseComplete = new Signal();
    this.onDestroy = new Signal();

    // 6. State
    this._time = 0;
    this._chargeProgress = 0;
    this._phase = 'idle';
    this._phaseTime = 0;
    this._running = false;
    this._destroyed = false;
    this._releaseProgress = 0;

    // 7. Bound update handler
    this._boundUpdate = null;

    // 8. Track display objects for cleanup
    this._displayObjects = [];
    this._textures = [];

    // 9. Apply quality settings and setup
    this._applyQuality();
    this._setup();

    // 10. Center the effect based on dimensions
    const centerX = this.options.width / 2;
    const centerY = this.options.height / 2;
    this.setPosition(centerX, centerY);

    // 11. Auto-start if configured
    if (this.options.autoStart) {
      this.start();
    }
  }

  _applyQuality() {
    const q = this.options.quality;
    if (q === 'low') {
      this.options.vortexParticleCount = 18;
      this.options.starCount = 8;
      this.options.sparkleCount = 12;
      this.options.bokehCount = 6;
      this.options.rayCount = 6;
    } else if (q === 'medium') {
      this.options.vortexParticleCount = 25;
      this.options.starCount = 12;
      this.options.sparkleCount = 18;
      this.options.bokehCount = 8;
      this.options.rayCount = 8;
    }
  }

  _setup() {
    const opts = this.options;

    // Main container (composition - not extending Container)
    this._root = new this.classes.Container();
    this._root.visible = false;
    this.container.addChild(this._root);
    this._displayObjects.push(this._root);

    // === LAYER 1: PURPLE ATMOSPHERIC GLOW ===
    this._atmosphereGlow = this._createRadialGlow(opts.maxRadius * 3.5, opts.purpleDark, 0.5);
    this._atmosphereGlow.alpha = 0;
    this._root.addChild(this._atmosphereGlow);

    // === LAYER 2: BOKEH PARTICLES (background ambiance) ===
    this._bokehContainer = new this.classes.Container();
    this._bokehContainer.blendMode = 'add';
    this._root.addChild(this._bokehContainer);
    this._bokehParticles = [];
    this._createBokehParticles();

    // === LAYER 3: MAGENTA GLOW RING ===
    this._magentaGlow = this._createRadialGlow(opts.maxRadius * 2, opts.magenta, 0.4);
    this._magentaGlow.alpha = 0;
    this._root.addChild(this._magentaGlow);

    // === LAYER 4: VORTEX PARTICLES (spiraling inward) ===
    this._vortexContainer = new this.classes.Container();
    this._vortexContainer.blendMode = 'add';
    this._root.addChild(this._vortexContainer);
    this._vortexParticles = [];
    this._vortexTexture = this._createVortexTexture();
    this._textures.push(this._vortexTexture);
    this._createVortexParticles();

    // === LAYER 5: ORBITING STARS ===
    this._starsContainer = new this.classes.Container();
    this._starsContainer.blendMode = 'add';
    this._root.addChild(this._starsContainer);
    this._stars = [];
    this._starTexture = this._createStarTexture();
    this._textures.push(this._starTexture);
    this._createStars();

    // === LAYER 6: GOLDEN CORE (multi-layer) ===
    this._coreContainer = new this.classes.Container();
    this._coreContainer.blendMode = 'add';
    this._root.addChild(this._coreContainer);
    
    this._coreOuter = this._createCoreLayer(opts.maxRadius * 0.55, opts.goldDark, 0.5);
    this._coreMid = this._createCoreLayer(opts.maxRadius * 0.35, opts.goldMid, 0.7);
    this._coreInner = this._createCoreLayer(opts.maxRadius * 0.18, opts.goldLight, 0.9);
    this._coreCenter = this._createCoreLayer(opts.maxRadius * 0.08, opts.white, 1);
    
    this._coreContainer.addChild(this._coreOuter);
    this._coreContainer.addChild(this._coreMid);
    this._coreContainer.addChild(this._coreInner);
    this._coreContainer.addChild(this._coreCenter);
    this._coreContainer.alpha = 0;

    // === LAYER 7: SPARKLES ===
    this._sparkleContainer = new this.classes.Container();
    this._sparkleContainer.blendMode = 'add';
    this._root.addChild(this._sparkleContainer);
    this._sparkles = [];
    this._sparkleTexture = this._createSparkleTexture();
    this._textures.push(this._sparkleTexture);
    this._createSparkles();

    // === LAYER 8: PULSE RINGS ===
    this._pulseRings = [];
    this._pulseContainer = new this.classes.Container();
    this._pulseContainer.blendMode = 'add';
    this._root.addChild(this._pulseContainer);
    this._createPulseRings();

    // === LAYER 9: RELEASE EFFECTS ===
    // Shockwaves
    this._shockwaves = [];
    this._shockContainer = new this.classes.Container();
    this._shockContainer.blendMode = 'add';
    this._root.addChild(this._shockContainer);
    this._createShockwaves();

    // Light rays
    this._rays = [];
    this._rayContainer = new this.classes.Container();
    this._rayContainer.blendMode = 'add';
    this._root.addChild(this._rayContainer);
    this._createRays();

    // Burst stars
    this._burstStars = [];
    this._burstContainer = new this.classes.Container();
    this._burstContainer.blendMode = 'add';
    this._root.addChild(this._burstContainer);
    this._createBurstStars();

    // Flash
    this._flash = this._createRadialGlow(opts.maxRadius * 4, opts.goldLight, 1);
    this._flash.alpha = 0;
    this._root.addChild(this._flash);

    // Afterglow
    this._afterglow = this._createRadialGlow(opts.maxRadius * 2.5, opts.goldMid, 0.6);
    this._afterglow.alpha = 0;
    this._root.addChild(this._afterglow);
  }

  // ===== TEXTURE CREATORS =====

  _createRadialGlow(size, color, intensity) {
    const canvas = document.createElement('canvas');
    canvas.width = size * 2;
    canvas.height = size * 2;
    const ctx = canvas.getContext('2d');
    
    const r = (color >> 16) & 0xff;
    const g = (color >> 8) & 0xff;
    const b = color & 0xff;
    
    const gradient = ctx.createRadialGradient(size, size, 0, size, size, size);
    gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${intensity})`);
    gradient.addColorStop(0.3, `rgba(${r}, ${g}, ${b}, ${intensity * 0.5})`);
    gradient.addColorStop(0.6, `rgba(${r}, ${g}, ${b}, ${intensity * 0.2})`);
    gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size * 2, size * 2);
    
    const texture = this.classes.Texture.from(canvas);
    this._textures.push(texture);
    
    const sprite = new this.classes.Sprite(texture);
    sprite.anchor.set(0.5);
    return sprite;
  }

  _createCoreLayer(radius, color, intensity) {
    const canvas = document.createElement('canvas');
    const size = radius * 2 + 10;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const cx = size / 2;
    const cy = size / 2;
    
    const r = (color >> 16) & 0xff;
    const g = (color >> 8) & 0xff;
    const b = color & 0xff;
    
    // Soft glow
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    gradient.addColorStop(0, `rgba(255, 255, 255, ${intensity})`);
    gradient.addColorStop(0.3, `rgba(${r}, ${g}, ${b}, ${intensity})`);
    gradient.addColorStop(0.7, `rgba(${r}, ${g}, ${b}, ${intensity * 0.4})`);
    gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    
    const texture = this.classes.Texture.from(canvas);
    this._textures.push(texture);
    
    const sprite = new this.classes.Sprite(texture);
    sprite.anchor.set(0.5);
    return sprite;
  }

  _createVortexTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 40;
    canvas.height = 10;
    const ctx = canvas.getContext('2d');
    
    const gradient = ctx.createLinearGradient(0, 0, 40, 0);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
    gradient.addColorStop(0.2, 'rgba(255, 215, 0, 0.6)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.8, 'rgba(255, 165, 0, 0.6)');
    gradient.addColorStop(1, 'rgba(255, 140, 0, 0)');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(20, 5, 20, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    
    return this.classes.Texture.from(canvas);
  }

  _createStarTexture() {
    const canvas = document.createElement('canvas');
    const size = 32;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const cx = size / 2;
    const cy = size / 2;
    
    // Draw 4-point star
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    
    const outerR = size / 2 - 2;
    const innerR = outerR * 0.3;
    const points = 4;
    
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const angle = (i * Math.PI) / points - Math.PI / 2;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    
    // Add glow
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 8;
    ctx.fill();
    
    return this.classes.Texture.from(canvas);
  }

  _createSparkleTexture() {
    const canvas = document.createElement('canvas');
    const size = 16;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const cx = size / 2;
    const cy = size / 2;
    
    // 4-point sparkle
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, size / 2);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.3, 'rgba(255, 215, 0, 0.8)');
    gradient.addColorStop(0.6, 'rgba(255, 165, 0, 0.3)');
    gradient.addColorStop(1, 'rgba(255, 140, 0, 0)');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
    ctx.fill();
    
    return this.classes.Texture.from(canvas);
  }

  _createBokehParticles() {
    const opts = this.options;
    
    for (let i = 0; i < opts.bokehCount; i++) {
      const size = 20 + Math.random() * 40;
      const bokeh = this._createRadialGlow(size, 
        Math.random() > 0.5 ? opts.magenta : opts.purple, 
        0.2 + Math.random() * 0.2
      );
      
      bokeh._data = {
        baseX: (Math.random() - 0.5) * opts.maxRadius * 3,
        baseY: (Math.random() - 0.5) * opts.maxRadius * 3,
        floatSpeed: 0.5 + Math.random() * 0.5,
        floatOffset: Math.random() * Math.PI * 2,
        floatRadius: 10 + Math.random() * 20
      };
      
      bokeh.alpha = 0;
      this._bokehParticles.push(bokeh);
      this._bokehContainer.addChild(bokeh);
    }
  }

  _createVortexParticles() {
    const opts = this.options;
    
    for (let i = 0; i < opts.vortexParticleCount; i++) {
      const sprite = new this.classes.Sprite(this._vortexTexture);
      sprite.anchor.set(1, 0.5);
      sprite.scale.set(0.6 + Math.random() * 0.5, 0.4 + Math.random() * 0.3);
      
      // Tint with gold variations
      const tints = [opts.goldLight, opts.goldMid, opts.white];
      sprite.tint = tints[Math.floor(Math.random() * tints.length)];
      sprite.alpha = 0;
      
      sprite._data = {
        angle: Math.random() * Math.PI * 2,
        radius: opts.maxRadius * (1.5 + Math.random() * 1.5),
        speed: 70 + Math.random() * 50,
        spiralSpeed: 1.2 + Math.random() * 0.8,
        baseRadius: opts.maxRadius * (1.5 + Math.random() * 1.5)
      };
      
      this._vortexParticles.push(sprite);
      this._vortexContainer.addChild(sprite);
    }
  }

  _createStars() {
    const opts = this.options;
    
    for (let i = 0; i < opts.starCount; i++) {
      const star = new this.classes.Sprite(this._starTexture);
      star.anchor.set(0.5);
      star.scale.set(0.3 + Math.random() * 0.4);
      star.tint = Math.random() > 0.3 ? opts.goldLight : opts.white;
      star.alpha = 0;
      
      star._data = {
        orbitRadius: opts.maxRadius * (0.5 + Math.random() * 0.4),
        orbitAngle: (i / opts.starCount) * Math.PI * 2,
        orbitSpeed: 0.8 + Math.random() * 0.6,
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: 2 + Math.random() * 2,
        wobbleAmp: 5 + Math.random() * 10,
        twinkleSpeed: 3 + Math.random() * 4,
        twinkleOffset: Math.random() * Math.PI * 2,
        baseScale: 0.3 + Math.random() * 0.4
      };
      
      this._stars.push(star);
      this._starsContainer.addChild(star);
    }
  }

  _createSparkles() {
    const opts = this.options;
    
    for (let i = 0; i < opts.sparkleCount; i++) {
      const sparkle = new this.classes.Sprite(this._sparkleTexture);
      sparkle.anchor.set(0.5);
      sparkle.scale.set(0.2 + Math.random() * 0.3);
      sparkle.alpha = 0;
      sparkle.visible = false;
      
      sparkle._data = {
        active: false,
        life: 0,
        maxLife: 200 + Math.random() * 200,
        x: 0,
        y: 0,
        angle: 0,
        speed: 30 + Math.random() * 40
      };
      
      this._sparkles.push(sparkle);
      this._sparkleContainer.addChild(sparkle);
    }
  }

  _createPulseRings() {
    const opts = this.options;
    
    for (let i = 0; i < 3; i++) {
      const ring = this._createPulseRing(opts.maxRadius * 0.4);
      ring._data = { delay: i * 250 };
      ring.alpha = 0;
      this._pulseRings.push(ring);
      this._pulseContainer.addChild(ring);
    }
  }

  _createPulseRing(radius) {
    const canvas = document.createElement('canvas');
    const size = radius * 2 + 30;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const cx = size / 2;
    const cy = size / 2;
    
    // Golden ring with glow
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.8)';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
    
    const texture = this.classes.Texture.from(canvas);
    this._textures.push(texture);
    
    const sprite = new this.classes.Sprite(texture);
    sprite.anchor.set(0.5);
    return sprite;
  }

  _createShockwaves() {
    for (let i = 0; i < 3; i++) {
      const shock = this._createShockwaveRing();
      shock._data = { delay: i * 60, speed: 1.3 - i * 0.15 };
      shock.alpha = 0;
      shock.scale.set(0.15);
      this._shockwaves.push(shock);
      this._shockContainer.addChild(shock);
    }
  }

  _createShockwaveRing() {
    const opts = this.options;
    const size = opts.maxRadius * 5;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const cx = size / 2;
    const cy = size / 2;
    const outerR = size / 2;
    const innerR = outerR * 0.88;
    
    const gradient = ctx.createRadialGradient(cx, cy, innerR, cx, cy, outerR);
    gradient.addColorStop(0, 'rgba(255, 215, 0, 0)');
    gradient.addColorStop(0.3, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.5, 'rgba(255, 215, 0, 0.9)');
    gradient.addColorStop(0.7, 'rgba(255, 165, 0, 0.6)');
    gradient.addColorStop(1, 'rgba(255, 140, 0, 0)');
    
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
    ctx.arc(cx, cy, innerR, 0, Math.PI * 2, true);
    ctx.fillStyle = gradient;
    ctx.fill();
    
    const texture = this.classes.Texture.from(canvas);
    this._textures.push(texture);
    
    const sprite = new this.classes.Sprite(texture);
    sprite.anchor.set(0.5);
    return sprite;
  }

  _createRays() {
    const opts = this.options;
    
    for (let i = 0; i < opts.rayCount; i++) {
      const ray = this._createRay();
      ray._data = {
        angle: (i / opts.rayCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.3
      };
      ray.rotation = ray._data.angle;
      ray.alpha = 0;
      this._rays.push(ray);
      this._rayContainer.addChild(ray);
    }
  }

  _createRay() {
    const opts = this.options;
    const length = opts.maxRadius * 3.5;
    const canvas = document.createElement('canvas');
    canvas.width = length;
    canvas.height = 30;
    const ctx = canvas.getContext('2d');
    
    // Golden ray with fade
    const gradient = ctx.createLinearGradient(0, 0, length, 0);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.05, 'rgba(255, 215, 0, 1)');
    gradient.addColorStop(0.3, 'rgba(255, 165, 0, 0.6)');
    gradient.addColorStop(0.6, 'rgba(255, 140, 0, 0.2)');
    gradient.addColorStop(1, 'rgba(255, 140, 0, 0)');
    
    ctx.fillStyle = gradient;
    
    // Tapered ray shape
    ctx.beginPath();
    ctx.moveTo(0, 15);
    ctx.lineTo(length, 13);
    ctx.lineTo(length, 17);
    ctx.lineTo(0, 15);
    ctx.fill();
    
    // Glow
    const glowGradient = ctx.createLinearGradient(0, 0, length * 0.5, 0);
    glowGradient.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
    glowGradient.addColorStop(1, 'rgba(255, 215, 0, 0)');
    ctx.fillStyle = glowGradient;
    ctx.fillRect(0, 5, length * 0.5, 20);
    
    const texture = this.classes.Texture.from(canvas);
    this._textures.push(texture);
    
    const sprite = new this.classes.Sprite(texture);
    sprite.anchor.set(0, 0.5);
    return sprite;
  }

  _createBurstStars() {
    const opts = this.options;
    const count = opts.starCount + 6;
    
    for (let i = 0; i < count; i++) {
      const star = new this.classes.Sprite(this._starTexture);
      star.anchor.set(0.5);
      star.scale.set(0.4 + Math.random() * 0.5);
      star.tint = Math.random() > 0.4 ? opts.goldLight : opts.white;
      star.alpha = 0;
      
      star._data = {
        angle: (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4,
        speed: 120 + Math.random() * 100,
        rotSpeed: (Math.random() - 0.5) * 8,
        x: 0,
        y: 0
      };
      
      this._burstStars.push(star);
      this._burstContainer.addChild(star);
    }
  }

  // ===== LIFECYCLE METHODS =====

  /**
   * Start the charge-up animation
   */
  start() {
    if (this._running || this._destroyed) return;
    
    this._running = true;
    this._time = 0;
    this._chargeProgress = 0;
    this._phase = 'ignition';
    this._phaseTime = 0;
    this._releaseProgress = 0;
    
    this._root.visible = true;
    this._resetVisuals();
    
    this._boundUpdate = this._boundUpdate || this._update.bind(this);
    this.ticker.add(this._boundUpdate);
  }

  /**
   * Stop the animation
   */
  stop() {
    if (!this._running) return;
    this._running = false;
    this._phase = 'idle';
    if (this._boundUpdate) {
      this.ticker.remove(this._boundUpdate);
    }
  }

  /**
   * Reset to initial state
   */
  reset() {
    this.stop();
    this._resetVisuals();
    this._root.visible = false;
  }

  /**
   * Trigger the release explosion
   */
  release() {
    if (this._phase === 'holding' || this._phase === 'peak') {
      this._phase = 'releasing';
      this._phaseTime = 0;
      this._releaseProgress = 0;
      
      // Reset burst star positions
      for (const star of this._burstStars) {
        star._data.x = 0;
        star._data.y = 0;
      }
      
      this.onReleaseStart.emit({ component: this });
    }
  }

  /**
   * Clean up all resources
   */
  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;

    // 1. Stop ticker
    this.stop();
    this._boundUpdate = null;

    // 2. Emit destroy signal before cleanup
    this.onDestroy.emit({ component: this });

    // 3. Clear signals
    this.onPeak.clear();
    this.onReleaseStart.clear();
    this.onReleaseComplete.clear();
    this.onDestroy.clear();

    // 4. Destroy textures
    for (const texture of this._textures) {
      if (texture && !texture.destroyed) {
        texture.destroy(true);
      }
    }
    this._textures = [];

    // 5. Remove and destroy root container
    if (this._root && this._root.parent) {
      this._root.parent.removeChild(this._root);
    }
    if (this._root) {
      this._root.destroy({ children: true });
    }

    // Clear references
    this._displayObjects = [];
    this._bokehParticles = [];
    this._vortexParticles = [];
    this._stars = [];
    this._sparkles = [];
    this._pulseRings = [];
    this._shockwaves = [];
    this._rays = [];
    this._burstStars = [];
  }

  /**
   * Restart the animation cycle (used for auto-release looping)
   */
  _restartCycle() {
    this._time = 0;
    this._chargeProgress = 0;
    this._phase = 'ignition';
    this._phaseTime = 0;
    this._releaseProgress = 0;
    this._resetVisuals();
  }

  _resetVisuals() {
    this._atmosphereGlow.alpha = 0;
    this._magentaGlow.alpha = 0;
    this._coreContainer.alpha = 0;
    this._coreContainer.scale.set(0.3);
    this._flash.alpha = 0;
    this._afterglow.alpha = 0;
    
    for (const bokeh of this._bokehParticles) bokeh.alpha = 0;
    for (const v of this._vortexParticles) {
      v.alpha = 0;
      v._data.radius = v._data.baseRadius;
    }
    for (const star of this._stars) star.alpha = 0;
    for (const sparkle of this._sparkles) {
      sparkle.alpha = 0;
      sparkle.visible = false;
      sparkle._data.active = false;
    }
    for (const ring of this._pulseRings) {
      ring.alpha = 0;
      ring.scale.set(0.5);
    }
    for (const shock of this._shockwaves) {
      shock.alpha = 0;
      shock.scale.set(0.15);
    }
    for (const ray of this._rays) {
      ray.alpha = 0;
      ray.scale.x = 0;
    }
    for (const star of this._burstStars) {
      star.alpha = 0;
      star.x = 0;
      star.y = 0;
    }
  }

  // ===== UPDATE LOOP =====

  _update(ticker) {
    const delta = ticker.deltaTime;
    const deltaMs = ticker.deltaMS;
    
    this._time += deltaMs;
    this._phaseTime += deltaMs;
    
    this._updatePhase();
    
    if (this._phase === 'releasing') {
      this._updateRelease(delta, deltaMs);
    } else {
      this._updateCharge(delta, deltaMs);
    }
  }

  _updatePhase() {
    const opts = this.options;
    
    switch (this._phase) {
      case 'ignition':
        this._chargeProgress = Math.min(this._phaseTime / opts.ignitionDuration, 1) * 0.15;
        if (this._phaseTime >= opts.ignitionDuration) {
          this._phase = 'accumulation';
          this._phaseTime = 0;
        }
        break;
      case 'accumulation':
        const accum = Math.min(this._phaseTime / opts.accumulationDuration, 1);
        this._chargeProgress = 0.15 + accum * 0.65;
        if (this._phaseTime >= opts.accumulationDuration) {
          this._phase = 'peak';
          this._phaseTime = 0;
        }
        break;
      case 'peak':
        const peak = Math.min(this._phaseTime / opts.peakDuration, 1);
        this._chargeProgress = 0.8 + this._easeOutElastic(peak) * 0.2;
        if (this._phaseTime >= opts.peakDuration) {
          this._phase = 'holding';
          this._phaseTime = 0;
          this.onPeak.emit({ component: this });
        }
        break;
      case 'holding':
        this._chargeProgress = 0.95 + Math.sin(this._time * 0.004) * 0.05;
        // Auto-release after holdDuration
        if (opts.autoRelease && this._phaseTime >= opts.holdDuration) {
          this.release();
        }
        break;
      case 'releasing':
        this._releaseProgress = Math.min(this._phaseTime / opts.releaseDuration, 1);
        if (this._releaseProgress >= 1) {
          this.onReleaseComplete.emit({ component: this });
          // Auto-restart the cycle if autoRelease is enabled
          if (opts.autoRelease) {
            this._restartCycle();
          } else {
            this.reset();
          }
        }
        break;
    }
  }

  _updateCharge(delta, deltaMs) {
    const progress = this._chargeProgress;
    const opts = this.options;
    const deltaSec = deltaMs / 1000;
    
    // === ATMOSPHERE GLOW ===
    this._atmosphereGlow.alpha = progress * 0.4;
    this._atmosphereGlow.scale.set(0.6 + progress * 0.4);
    
    // === MAGENTA GLOW ===
    this._magentaGlow.alpha = progress * 0.3;
    const magentaPulse = Math.sin(this._time * 0.003) * 0.1;
    this._magentaGlow.scale.set(0.7 + progress * 0.3 + magentaPulse * progress);
    
    // === BOKEH PARTICLES ===
    for (const bokeh of this._bokehParticles) {
      const data = bokeh._data;
      bokeh.alpha = progress * 0.3;
      
      const floatX = Math.sin(this._time * 0.001 * data.floatSpeed + data.floatOffset) * data.floatRadius;
      const floatY = Math.cos(this._time * 0.001 * data.floatSpeed + data.floatOffset) * data.floatRadius;
      bokeh.x = data.baseX + floatX;
      bokeh.y = data.baseY + floatY;
    }
    
    // === GOLDEN CORE ===
    const pulseFreq = 3 + progress * 8;
    const pulse = Math.sin(this._time * 0.001 * pulseFreq) * 0.08;
    const coreScale = 0.3 + progress * 0.7 + pulse * progress;
    
    this._coreContainer.scale.set(coreScale);
    this._coreContainer.alpha = Math.min(progress * 2, 1);
    
    // Subtle layer movement for richness
    const shimmer = progress * 2;
    this._coreOuter.x = Math.sin(this._time * 0.004) * shimmer;
    this._coreOuter.y = Math.cos(this._time * 0.004) * shimmer;
    
    // === VORTEX PARTICLES (spiral inward) ===
    for (const v of this._vortexParticles) {
      const data = v._data;
      
      data.radius -= data.speed * deltaSec * progress;
      data.angle += data.spiralSpeed * deltaSec * (1 + progress * 0.5);
      
      if (data.radius < opts.maxRadius * 0.15) {
        data.radius = data.baseRadius;
        data.angle = Math.random() * Math.PI * 2;
      }
      
      v.x = Math.cos(data.angle) * data.radius;
      v.y = Math.sin(data.angle) * data.radius;
      v.rotation = data.angle + Math.PI;
      v.alpha = progress * 0.8 * (data.radius / data.baseRadius);
    }
    
    // === ORBITING STARS ===
    for (const star of this._stars) {
      const data = star._data;
      
      data.orbitAngle += data.orbitSpeed * deltaSec * (1 + progress * 0.5);
      const wobble = Math.sin(this._time * 0.001 * data.wobbleSpeed + data.wobble) * data.wobbleAmp * progress;
      
      const radius = data.orbitRadius * (0.4 + progress * 0.6) + wobble;
      star.x = Math.cos(data.orbitAngle) * radius;
      star.y = Math.sin(data.orbitAngle) * radius * 0.7; // Slight ellipse
      
      // Twinkle
      const twinkle = 0.5 + Math.sin(this._time * 0.001 * data.twinkleSpeed + data.twinkleOffset) * 0.5;
      star.alpha = progress * 0.8 * twinkle;
      star.scale.set(data.baseScale * (0.8 + twinkle * 0.4));
      star.rotation += 0.02 * delta;
    }
    
    // === SPARKLES ===
    const sparkleRate = 0.03 + progress * 0.12;
    if (Math.random() < sparkleRate) {
      this._spawnSparkle();
    }
    
    for (const sparkle of this._sparkles) {
      if (!sparkle._data.active) continue;
      
      const data = sparkle._data;
      data.life -= deltaMs;
      
      if (data.life <= 0) {
        sparkle._data.active = false;
        sparkle.visible = false;
        continue;
      }
      
      const lifeRatio = data.life / data.maxLife;
      sparkle.alpha = lifeRatio * 0.9;
      sparkle.scale.set(0.3 * lifeRatio + 0.1);
      
      // Drift outward slightly
      data.x += Math.cos(data.angle) * data.speed * deltaSec * 0.3;
      data.y += Math.sin(data.angle) * data.speed * deltaSec * 0.3;
      sparkle.x = data.x;
      sparkle.y = data.y;
    }
    
    // === PULSE RINGS ===
    for (const ring of this._pulseRings) {
      const data = ring._data;
      const cycleTime = 900;
      const adjustedTime = (this._time - data.delay) % cycleTime;
      
      if (progress > 0.3) {
        const ringProgress = adjustedTime / cycleTime;
        ring.scale.set(0.4 + ringProgress * 1.8);
        ring.alpha = (1 - ringProgress) * progress * 0.5;
      } else {
        ring.alpha = 0;
      }
    }
  }

  _spawnSparkle() {
    const opts = this.options;
    const sparkle = this._sparkles.find(s => !s._data.active);
    if (!sparkle) return;
    
    const angle = Math.random() * Math.PI * 2;
    const radius = opts.maxRadius * (0.3 + Math.random() * 0.5);
    
    sparkle._data.active = true;
    sparkle._data.life = sparkle._data.maxLife;
    sparkle._data.x = Math.cos(angle) * radius;
    sparkle._data.y = Math.sin(angle) * radius;
    sparkle._data.angle = angle;
    sparkle.x = sparkle._data.x;
    sparkle.y = sparkle._data.y;
    sparkle.visible = true;
    sparkle.alpha = 0.8;
  }

  _updateRelease(delta, deltaMs) {
    const progress = this._releaseProgress;
    const easeOut = this._easeOutQuart(progress);
    const easeIn = this._easeInQuad(progress);
    const opts = this.options;
    const deltaSec = deltaMs / 1000;
    
    // === FLASH ===
    if (progress < 0.12) {
      this._flash.alpha = 1 - (progress / 0.12);
      this._flash.scale.set(0.4 + progress * 3);
    } else {
      this._flash.alpha = 0;
    }
    
    // === CORE EXPLOSION ===
    if (progress < 0.25) {
      const explode = progress / 0.25;
      this._coreContainer.scale.set(1 + explode * 2.5);
      this._coreContainer.alpha = 1;
    } else {
      const fade = (progress - 0.25) / 0.75;
      this._coreContainer.scale.set(3.5 + fade * 1.5);
      this._coreContainer.alpha = 1 - this._easeInQuad(fade);
    }
    
    // === SHOCKWAVES ===
    for (const shock of this._shockwaves) {
      const data = shock._data;
      const shockTime = Math.max(0, this._phaseTime - data.delay);
      const shockProgress = Math.min(shockTime / (opts.releaseDuration * 0.75), 1);
      
      if (shockProgress > 0) {
        const ease = this._easeOutQuart(shockProgress);
        shock.scale.set(0.15 + ease * data.speed);
        shock.alpha = (1 - shockProgress) * 0.95;
      }
    }
    
    // === LIGHT RAYS ===
    for (const ray of this._rays) {
      if (progress < 0.35) {
        const rayProgress = progress / 0.35;
        ray.scale.x = this._easeOutQuart(rayProgress);
        ray.alpha = 1;
      } else {
        const fade = (progress - 0.35) / 0.65;
        ray.alpha = 1 - this._easeInQuad(fade);
      }
    }
    
    // === BURST STARS ===
    for (const star of this._burstStars) {
      const data = star._data;
      
      const speed = data.speed * (1 + progress * 0.5);
      data.x += Math.cos(data.angle) * speed * deltaSec;
      data.y += Math.sin(data.angle) * speed * deltaSec;
      
      star.x = data.x;
      star.y = data.y;
      star.rotation += data.rotSpeed * deltaSec;
      star.alpha = (1 - easeIn) * 0.95;
    }
    
    // === VORTEX BURST OUTWARD ===
    for (const v of this._vortexParticles) {
      const data = v._data;
      data.radius += 250 * deltaSec * (1 + progress);
      v.x = Math.cos(data.angle) * data.radius;
      v.y = Math.sin(data.angle) * data.radius;
      v.alpha = (1 - easeIn) * 0.7;
    }
    
    // === ORBITING STARS SCATTER ===
    for (const star of this._stars) {
      const data = star._data;
      data.orbitRadius += 150 * deltaSec * (1 + progress);
      star.x = Math.cos(data.orbitAngle) * data.orbitRadius;
      star.y = Math.sin(data.orbitAngle) * data.orbitRadius * 0.7;
      star.alpha = (1 - easeIn) * 0.8;
    }
    
    // === SPARKLE BURST ===
    if (progress < 0.4 && Math.random() < 0.4) {
      this._spawnSparkle();
    }
    
    for (const sparkle of this._sparkles) {
      if (sparkle._data.active) {
        const data = sparkle._data;
        data.x += Math.cos(data.angle) * 200 * deltaSec;
        data.y += Math.sin(data.angle) * 200 * deltaSec;
        sparkle.x = data.x;
        sparkle.y = data.y;
        sparkle.alpha *= (1 - progress * 0.02);
      }
    }
    
    // === ATMOSPHERE FADE ===
    this._atmosphereGlow.scale.set(1 + easeOut * 1.2);
    this._atmosphereGlow.alpha = (1 - easeOut) * 0.5;
    
    this._magentaGlow.scale.set(1 + easeOut * 0.8);
    this._magentaGlow.alpha = (1 - easeOut) * 0.4;
    
    // === AFTERGLOW ===
    if (progress > 0.4) {
      const afterProgress = (progress - 0.4) / 0.6;
      this._afterglow.alpha = Math.sin(afterProgress * Math.PI) * 0.5;
      this._afterglow.scale.set(1 + afterProgress * 0.4);
    }
  }

  // ===== EASING FUNCTIONS =====
  
  _easeOutElastic(t) {
    const c4 = (2 * Math.PI) / 3;
    return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  }
  
  _easeOutQuart(t) { 
    return 1 - Math.pow(1 - t, 4); 
  }
  
  _easeInQuad(t) { 
    return t * t; 
  }

  // ===== PUBLIC GETTERS =====
  
  get chargeProgress() { return this._chargeProgress; }
  get releaseProgress() { return this._releaseProgress; }
  get isFullyCharged() { return this._phase === 'holding' || this._phase === 'peak'; }
  get isReleasing() { return this._phase === 'releasing'; }
  get isActive() { return this._running; }
  get phase() { return this._phase; }
  
  /**
   * Get the root container for positioning
   */
  get displayObject() { return this._root; }
  
  /**
   * Set position of the effect
   */
  setPosition(x, y) {
    this._root.x = x;
    this._root.y = y;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export { GoldenStarCharge, Signal };
export default GoldenStarCharge;
