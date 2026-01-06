/**
 * BokehBallThrow - Bouncing bokeh ball effect with depth and reflections
 * 
 * Balls are thrown from above, bounce on a floor surface, and gradually
 * recede into the distance with smooth depth-based scaling and fading.
 * 
 * @example
 * // Production (ES Modules)
 * import * as PIXI from 'pixi.js';
 * import { gsap } from 'gsap';
 * import { PixiPlugin } from 'gsap/PixiPlugin';
 * import { createPixiContext, BokehBallThrow } from './BokehBallThrow.js';
 * 
 * gsap.registerPlugin(PixiPlugin);
 * PixiPlugin.registerPIXI(PIXI);
 * 
 * const app = new PIXI.Application();
 * await app.init({ width: 800, height: 600 });
 * 
 * const ctx = createPixiContext(PIXI, { gsap, PixiPlugin }, app);
 * const effect = new BokehBallThrow(ctx, {
 *   container: app.stage,
 *   width: 800,
 *   height: 600,
 *   autoStart: true
 * });
 */

// ============================================================================
// SIGNAL CLASS
// ============================================================================

/**
 * Signal - Canonical event emitter for all components
 * Features: add/once/remove listeners, emit with data, clear all
 */
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
    for (const fn of this._listeners) this._iterationSnapshot.push(fn);
    for (const fn of this._onceListeners) this._iterationSnapshot.push(fn);
    this._onceListeners.clear();
    for (const fn of this._iterationSnapshot) {
      try {
        fn(data);
      } catch (err) {
        console.error('[Signal]', err);
      }
    }
  }

  clear() {
    this._listeners.clear();
    this._onceListeners.clear();
    this._iterationSnapshot.length = 0;
  }
}

// ============================================================================
// PIXI CONTEXT FACTORY
// ============================================================================

/**
 * Creates a PixiContext with GSAP integration.
 * 
 * @param {object} pixiModule - PIXI namespace (global or imported)
 * @param {object} gsapModule - GSAP namespace { gsap, PixiPlugin }
 * @param {object} app - Initialized PIXI application
 * @param {object} [config] - Optional overrides
 * @returns {object} Immutable context object
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
      Point: pixiModule.Point,
      RenderTexture: pixiModule.RenderTexture,
    }),
    create: Object.freeze({
      container: () => new pixiModule.Container(),
      graphics: () => new pixiModule.Graphics(),
      sprite: (tex) => new pixiModule.Sprite(tex),
      point: (x = 0, y = 0) => new pixiModule.Point(x, y),
    }),
  });
}

// ============================================================================
// BOKEH BALL DATA OBJECT
// ============================================================================

/**
 * BokehBall - Data object for a single bokeh ball
 * Plain object with sprite references, NOT a PIXI extension
 */
class BokehBall {
  constructor() {
    this.sprite = null;
    this.reflectionSprite = null;
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.z = 0;              // Depth: 0 = close (large), 1 = far (small)
    this.baseRadius = 30;
    this.color = 0xffffff;
    this.active = false;
    this.bounceCount = 0;
    this._poolIndex = -1;
  }

  reset(config) {
    this.x = config.x ?? 0;
    this.y = config.y ?? 0;
    this.vx = config.vx ?? 0;
    this.vy = config.vy ?? 0;
    this.z = config.z ?? 0;
    this.baseRadius = config.baseRadius ?? 30;
    this.color = config.color ?? 0xffffff;
    this.active = true;
    this.bounceCount = 0;

    if (this.sprite) {
      this.sprite.visible = true;
      this.sprite.tint = this.color;
    }
    if (this.reflectionSprite) {
      this.reflectionSprite.visible = true;
      this.reflectionSprite.tint = this.color;
    }
  }

  deactivate() {
    this.active = false;
    if (this.sprite) this.sprite.visible = false;
    if (this.reflectionSprite) this.reflectionSprite.visible = false;
  }
}

// ============================================================================
// BOKEH BALL THROW COMPONENT
// ============================================================================

/**
 * BokehBallThrow - Bouncing bokeh ball effect with depth and reflections
 * 
 * @param {object} ctx - PixiContext from createPixiContext()
 * @param {object} options - Configuration options
 * @param {object} options.container - Parent container (required)
 * @param {number} [options.width=800] - Effect width
 * @param {number} [options.height=600] - Effect height
 * @param {number} [options.ballCount=40] - Maximum active balls
 * @param {number[]} [options.colors] - Ball colors array
 * @param {boolean} [options.autoStart=false] - Start animation immediately
 * @param {number} [options.gravity=0.32] - Gravity strength
 * @param {number} [options.throwInterval=150] - Ms between throws
 * @param {number} [options.throwBurst=3] - Balls per throw
 * @param {number} [options.minRadius=25] - Minimum ball radius
 * @param {number} [options.maxRadius=80] - Maximum ball radius
 * @param {number} [options.floorY] - Floor Y position (defaults to height * 0.75)
 * @param {boolean} [options.showReflection=true] - Show floor reflections
 */
class BokehBallThrow {
  static defaults = {
    width: 800,
    height: 600,
    ballCount: 40,
    colors: [
      0xccff00, 0x99ff00, 0xbbff33,  // Lime greens
      0xff4400, 0xff5500, 0xff6633,  // Red oranges
      0xffcc00, 0xffdd00, 0xffee33,  // Yellows
      0xff8866, 0xff7755,            // Corals
    ],
    autoStart: false,
    gravity: 0.32,
    throwInterval: 150,
    throwBurst: 3,
    minRadius: 25,
    maxRadius: 80,
    floorY: null,
    showReflection: true,
  };

  constructor(ctx, options = {}) {
    // Validate required context
    if (!ctx?.classes) {
      throw new Error('BokehBallThrow: ctx.classes is required');
    }
    if (!ctx?.ticker) {
      throw new Error('BokehBallThrow: ctx.ticker is required');
    }
    if (!ctx?.renderer) {
      throw new Error('BokehBallThrow: ctx.renderer is required');
    }
    if (!options.container) {
      throw new Error('BokehBallThrow: options.container is required');
    }

    // Store context references
    this.ticker = ctx.ticker;
    this.renderer = ctx.renderer;
    this.classes = ctx.classes;
    this.create = ctx.create;
    this.gsap = ctx.gsap;
    this.container = options.container;

    // Merge options with defaults
    this.options = { ...BokehBallThrow.defaults, ...options };

    // Calculate floor position if not provided
    if (this.options.floorY === null) {
      this.options.floorY = this.options.height * 0.75;
    }

    // Signals
    this.onStart = new Signal();
    this.onStop = new Signal();
    this.onDestroy = new Signal();

    // Internal state
    this._running = false;
    this._destroyed = false;
    this._boundUpdate = null;
    this._lastThrowTime = 0;
    this._displayObjects = [];
    this._rootContainer = null;
    this._ballContainer = null;
    this._reflectionContainer = null;
    this._floorGraphics = null;
    this._bokehTexture = null;
    this._pool = [];
    this._active = [];

    // Setup
    this._setup();

    // Auto-start if configured
    if (this.options.autoStart) {
      this.start();
    }
  }

  /**
   * Initialize visual elements
   */
  _setup() {
    this._rootContainer = new this.classes.Container();
    this.container.addChild(this._rootContainer);
    this._displayObjects.push(this._rootContainer);

    this._createBokehTexture();
    this._createFloorSurface();

    // Reflection container (below floor)
    if (this.options.showReflection) {
      this._reflectionContainer = new this.classes.Container();
      this._reflectionContainer.alpha = 0.35;
      this._rootContainer.addChild(this._reflectionContainer);
    }

    // Main ball container
    this._ballContainer = new this.classes.Container();
    this._rootContainer.addChild(this._ballContainer);

    this._initializePool();
  }

  /**
   * Create floor surface with gradient
   */
  _createFloorSurface() {
    const { width, height, floorY } = this.options;
    this._floorGraphics = new this.classes.Graphics();

    // Gradient reflection fade (from floor going down)
    const gradientSteps = 30;
    const gradientHeight = height - floorY;

    for (let i = 0; i < gradientSteps; i++) {
      const y = floorY + (gradientHeight / gradientSteps) * i;
      const h = gradientHeight / gradientSteps + 1;
      const alpha = 0.12 * Math.pow(1 - i / gradientSteps, 2);

      this._floorGraphics.rect(0, y, width, h);
      this._floorGraphics.fill({ color: 0x181818, alpha });
    }

    // Subtle horizon line
    this._floorGraphics.rect(0, floorY, width, 1);
    this._floorGraphics.fill({ color: 0x333333, alpha: 0.5 });

    this._rootContainer.addChild(this._floorGraphics);
  }

  /**
   * Create bokeh texture for sprites
   */
  _createBokehTexture() {
    const size = 128;
    const g = new this.classes.Graphics();

    // Soft glowing ball with bright center
    const steps = 40;
    for (let i = steps; i > 0; i--) {
      const ratio = i / steps;
      const radius = (size / 2) * ratio;
      const alpha = Math.pow(1 - ratio, 0.7) * 0.9 + 0.1;
      g.circle(size / 2, size / 2, radius);
      g.fill({ color: 0xffffff, alpha });
    }

    this._bokehTexture = this.renderer.generateTexture({ target: g, resolution: 1 });
    g.destroy();
  }

  /**
   * Initialize object pool
   */
  _initializePool() {
    const poolSize = this.options.ballCount * 2;

    for (let i = 0; i < poolSize; i++) {
      const ball = new BokehBall();
      ball._poolIndex = i;

      const sprite = new this.classes.Sprite(this._bokehTexture);
      sprite.anchor.set(0.5);
      sprite.visible = false;
      ball.sprite = sprite;

      if (this.options.showReflection) {
        const reflSprite = new this.classes.Sprite(this._bokehTexture);
        reflSprite.anchor.set(0.5);
        reflSprite.visible = false;
        ball.reflectionSprite = reflSprite;
      }

      this._pool.push(ball);
    }
  }

  /**
   * Spawn a ball from pool
   * @param {object} config - Ball configuration
   * @returns {BokehBall|null}
   */
  _spawnBall(config) {
    if (this._pool.length === 0) return null;

    const ball = this._pool.pop();
    ball.reset(config);

    // Calculate visual size from depth
    const zNormalized = Math.min(ball.z, 1.5) / 1.5;
    const depthScale = Math.pow(1 - zNormalized, 1.5);
    const visualRadius = ball.baseRadius * Math.max(0.05, depthScale);
    const scale = (visualRadius * 2) / 128;
    const alpha = 0.9 * Math.pow(1 - zNormalized, 1.2);

    ball.sprite.scale.set(scale);
    ball.sprite.alpha = alpha;
    this._ballContainer.addChild(ball.sprite);

    if (this._reflectionContainer && ball.reflectionSprite) {
      ball.reflectionSprite.scale.set(scale * 0.9, scale * 0.4);
      ball.reflectionSprite.alpha = alpha * 0.5;
      this._reflectionContainer.addChild(ball.reflectionSprite);
    }

    ball._poolIndex = this._active.length;
    this._active.push(ball);
    return ball;
  }

  /**
   * Return ball to pool (O(1) swap-and-pop)
   * @param {BokehBall} ball
   */
  _despawnBall(ball) {
    if (!ball.active) return;

    const idx = ball._poolIndex;
    if (idx < 0 || idx >= this._active.length || this._active[idx] !== ball) return;

    // Swap-and-pop
    const last = this._active[this._active.length - 1];
    this._active[idx] = last;
    last._poolIndex = idx;
    this._active.pop();

    // Remove from containers
    if (ball.sprite.parent) ball.sprite.parent.removeChild(ball.sprite);
    if (ball.reflectionSprite?.parent) ball.reflectionSprite.parent.removeChild(ball.reflectionSprite);

    ball.deactivate();
    ball._poolIndex = this._pool.length;
    this._pool.push(ball);
  }

  /**
   * Throw a burst of balls
   */
  _throwBalls() {
    const { width, colors, minRadius, maxRadius, throwBurst } = this.options;

    const burstCount = Math.floor(throwBurst * (0.7 + Math.random() * 0.6));

    for (let i = 0; i < burstCount; i++) {
      if (this._active.length >= this.options.ballCount) break;

      // Start position: top center area
      const x = width * 0.25 + Math.random() * width * 0.5;
      const y = -30 - Math.random() * 80;

      // Initial depth
      const z = Math.random() * 0.15;

      // Throw velocity
      const throwAngle = (Math.PI / 2) + (Math.random() - 0.5) * 0.7;
      const throwSpeed = 5 + Math.random() * 5;

      const vx = Math.cos(throwAngle) * throwSpeed * (Math.random() > 0.5 ? 1 : -1) * 1.5;
      const vy = Math.abs(Math.sin(throwAngle)) * throwSpeed;

      const baseRadius = minRadius + Math.random() * (maxRadius - minRadius);
      const color = colors[Math.floor(Math.random() * colors.length)];

      this._spawnBall({ x, y, vx, vy, z, baseRadius, color });
    }
  }

  /**
   * Start animation
   */
  start() {
    if (this._running || this._destroyed) return;
    this._running = true;
    this._boundUpdate = this._boundUpdate || this._update.bind(this);
    this.ticker.add(this._boundUpdate);
    this._lastThrowTime = performance.now();
    this.onStart.emit({ component: this });

    // Initial burst
    for (let i = 0; i < 3; i++) {
      this._throwBalls();
    }
  }

  /**
   * Stop animation
   */
  stop() {
    if (!this._running) return;
    this._running = false;
    this.ticker.remove(this._boundUpdate);
    this.onStop.emit({ component: this });
  }

  /**
   * Update loop (called by ticker)
   * @param {object} ticker - PixiJS ticker
   */
  _update(ticker) {
    const delta = ticker.deltaTime;
    const now = performance.now();
    const { gravity, floorY, width } = this.options;

    // Periodic throwing
    if (now - this._lastThrowTime > this.options.throwInterval) {
      this._throwBalls();
      this._lastThrowTime = now;
    }

    // Update balls
    for (let i = this._active.length - 1; i >= 0; i--) {
      const ball = this._active[i];
      if (!ball.active) continue;

      // Physics
      ball.vy += gravity * delta;
      ball.x += ball.vx * delta;
      ball.y += ball.vy * delta;

      // Move into distance
      const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
      const zSpeed = 0.003 + speed * 0.0008;
      ball.z += zSpeed * delta;

      // Ground collision
      if (ball.y >= floorY) {
        ball.y = floorY;
        ball.bounceCount++;
        ball.vy *= -0.6;
        ball.vx *= 0.88;
        ball.z += 0.02;
      }

      // Depth-based scaling
      const zNormalized = Math.min(ball.z, 1.5) / 1.5;
      const depthScale = Math.pow(1 - zNormalized, 1.5);
      const visualRadius = ball.baseRadius * Math.max(0.05, depthScale);
      const scale = (visualRadius * 2) / 128;
      const alpha = Math.max(0, 0.9 * Math.pow(1 - zNormalized, 1.2));

      ball.sprite.scale.set(scale);
      ball.sprite.alpha = alpha;

      if (ball.reflectionSprite) {
        ball.reflectionSprite.scale.set(scale * 0.9, scale * 0.4);
        ball.reflectionSprite.alpha = alpha * 0.5;
      }

      // Despawn when too far
      if (ball.z >= 1.5 || alpha < 0.03) {
        this._despawnBall(ball);
        continue;
      }

      // Out of horizontal bounds
      if (ball.x < -100 || ball.x > width + 100) {
        this._despawnBall(ball);
        continue;
      }

      // Update positions
      ball.sprite.x = ball.x;
      ball.sprite.y = ball.y;

      if (ball.reflectionSprite) {
        ball.reflectionSprite.x = ball.x;
        const distFromFloor = floorY - ball.y;
        ball.reflectionSprite.y = floorY + distFromFloor * 0.4 + 5;
      }
    }

    // Sort by depth (far balls behind)
    this._ballContainer.children.sort((a, b) => {
      const ballA = this._active.find(ball => ball.sprite === a);
      const ballB = this._active.find(ball => ball.sprite === b);
      if (!ballA || !ballB) return 0;
      return ballB.z - ballA.z;
    });
  }

  /**
   * Reset all balls to pool
   */
  reset() {
    while (this._active.length > 0) {
      this._despawnBall(this._active[0]);
    }
  }

  /**
   * Resize the effect
   * @param {number} width - New width
   * @param {number} height - New height
   */
  resize(width, height) {
    this.options.width = width;
    this.options.height = height;
    this.options.floorY = height * 0.75;
  }

  /**
   * Cleanup all resources
   */
  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;

    this.stop();
    this._boundUpdate = null;

    this.onDestroy.emit({ component: this });
    this.onStart.clear();
    this.onStop.clear();
    this.onDestroy.clear();

    // Destroy all ball sprites
    for (const ball of [...this._pool, ...this._active]) {
      ball.sprite?.destroy();
      ball.reflectionSprite?.destroy();
    }
    this._pool = [];
    this._active = [];

    // Destroy texture
    this._bokehTexture?.destroy(true);

    // Destroy display objects
    for (const obj of this._displayObjects) {
      obj.parent?.removeChild(obj);
      obj.destroy({ children: true });
    }
    this._displayObjects = [];
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export { Signal, createPixiContext, BokehBall, BokehBallThrow };
export default BokehBallThrow;
