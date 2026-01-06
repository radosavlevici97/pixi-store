/**
 * FerrofluidOracle - Mercury/ferrofluid metaball effect with magnetic field visualization
 * 
 * Pure composition - receives PixiContext via constructor
 * ?? ZERO instances of PIXI. in this class
 * 
 * Features:
 * - Metaball system with organic physics
 * - Threshold shader for liquid edge effect
 * - Magnetic field lines
 * - Metallic dust particles
 * - Click-based spike eruptions
 */

// ============================================================================
// SIGNAL CLASS (Canonical implementation)
// ============================================================================

class Signal {
  constructor() {
    this._listeners = new Set();
    this._onceListeners = new Set();
    this._iterationArray = [];
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
    this._iterationArray.length = 0;
    for (const fn of this._listeners) this._iterationArray.push(fn);
    for (const fn of this._onceListeners) this._iterationArray.push(fn);
    this._onceListeners.clear();

    for (const fn of this._iterationArray) {
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
  }

  get hasListeners() {
    return this._listeners.size > 0 || this._onceListeners.size > 0;
  }

  get listenerCount() {
    return this._listeners.size + this._onceListeners.size;
  }
}

// ============================================================================
// CONSTANTS
// ============================================================================

const COLORS = {
  void: 0x0A0A0B,
  mercury: 0xC0C5CE,
  violet: 0x8B5CF6,
  chrome: 0x4A5568,
  iridescent: [0xFF006E, 0x00F5D4, 0xFFBE0B]
};

// ============================================================================
// THRESHOLD SHADER (PixiJS v7 GLSL)
// ============================================================================

const thresholdShaderSrc = `
  precision mediump float;
  varying vec2 vTextureCoord;
  uniform sampler2D uSampler;
  uniform float uTime;
  uniform vec2 uMouse;
  
  void main() {
    vec4 color = texture2D(uSampler, vTextureCoord);
    float threshold = 0.5;
    
    // Create sharp edge
    float alpha = smoothstep(threshold - 0.1, threshold + 0.1, color.a);
    
    // Iridescent color based on position and time
    vec2 uv = vTextureCoord;
    float hue = uv.x * 0.5 + uv.y * 0.3 + uTime * 0.1;
    
    // Distance from mouse for highlight
    vec2 mouseDist = uv - uMouse;
    float highlight = 1.0 - smoothstep(0.0, 0.3, length(mouseDist));
    
    // Base mercury color with iridescent shift
    vec3 baseColor = vec3(0.75, 0.77, 0.81);
    vec3 iridescent = vec3(
      0.5 + 0.5 * sin(hue * 6.28 + 0.0),
      0.5 + 0.5 * sin(hue * 6.28 + 2.09),
      0.5 + 0.5 * sin(hue * 6.28 + 4.18)
    );
    
    // Mix colors
    vec3 finalColor = mix(baseColor, iridescent, 0.15 + highlight * 0.2);
    
    // Add specular highlight
    finalColor += vec3(highlight * 0.5);
    
    // Edge glow
    float edge = smoothstep(threshold - 0.15, threshold, color.a) - 
                 smoothstep(threshold, threshold + 0.15, color.a);
    finalColor += vec3(0.545, 0.361, 0.965) * edge * 2.0;
    
    gl_FragColor = vec4(finalColor * alpha, alpha);
  }
`;

// ============================================================================
// METABALL CLASS
// ============================================================================

class Metaball {
  constructor(x, y, radius, isCore = false) {
    this.x = x;
    this.y = y;
    this.baseX = x;
    this.baseY = y;
    this.radius = radius;
    this.baseRadius = radius;
    this.vx = 0;
    this.vy = 0;
    this.isCore = isCore;
    this.phase = Math.random() * Math.PI * 2;
    this.breathSpeed = 0.5 + Math.random() * 0.5;
    this.magneticResponse = 0.3 + Math.random() * 0.7;
  }

  update(mouseX, mouseY, mouseVel, deltaTime) {
    // Breathing animation
    this.phase += deltaTime * this.breathSpeed;
    const breathScale = 1 + Math.sin(this.phase) * 0.05;

    // Magnetic attraction/repulsion
    const dx = mouseX - this.x;
    const dy = mouseY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxDist = 300;

    if (dist < maxDist && dist > 0) {
      const force = (1 - dist / maxDist) * this.magneticResponse * 0.5;
      const mouseSpeed = Math.sqrt(mouseVel.x * mouseVel.x + mouseVel.y * mouseVel.y);

      // Attract when mouse is slow, repel when fast
      const direction = mouseSpeed > 5 ? -1 : 1;

      this.vx += (dx / dist) * force * direction;
      this.vy += (dy / dist) * force * direction;

      // Spike formation based on proximity
      this.radius = this.baseRadius * breathScale * (1 + (1 - dist / maxDist) * 0.3);
    } else {
      this.radius = this.baseRadius * breathScale;
    }

    // Return to base position with viscous damping
    const returnForce = 0.02;
    this.vx += (this.baseX - this.x) * returnForce;
    this.vy += (this.baseY - this.y) * returnForce;

    // Viscous damping
    this.vx *= 0.92;
    this.vy *= 0.92;

    this.x += this.vx;
    this.y += this.vy;
  }
}

// ============================================================================
// FIELD LINE CLASS
// ============================================================================

class FieldLine {
  constructor(ctx, container, screenWidth, screenHeight) {
    this.classes = ctx.classes;
    this.container = container;
    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;

    this.graphics = new this.classes.Graphics();
    this.points = [];
    this.x = 0;
    this.y = 0;
    this.alpha = 0;
    this.speed = 0;
    this.life = 0;

    this.reset();
    this.container.addChild(this.graphics);
  }

  reset() {
    // Start from edge of screen
    const side = Math.floor(Math.random() * 4);
    switch (side) {
      case 0: // top
        this.x = Math.random() * this.screenWidth;
        this.y = 0;
        break;
      case 1: // right
        this.x = this.screenWidth;
        this.y = Math.random() * this.screenHeight;
        break;
      case 2: // bottom
        this.x = Math.random() * this.screenWidth;
        this.y = this.screenHeight;
        break;
      case 3: // left
        this.x = 0;
        this.y = Math.random() * this.screenHeight;
        break;
    }
    this.points = [{ x: this.x, y: this.y }];
    this.alpha = 0.3 + Math.random() * 0.3;
    this.speed = 2 + Math.random() * 3;
    this.life = 1;
  }

  update(centerX, centerY) {
    // Move toward center with some noise
    const dx = centerX - this.x;
    const dy = centerY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 10) {
      const angle = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.5;
      this.x += Math.cos(angle) * this.speed;
      this.y += Math.sin(angle) * this.speed;
      this.points.push({ x: this.x, y: this.y });

      if (this.points.length > 50) {
        this.points.shift();
      }
    } else {
      this.life -= 0.02;
    }

    if (this.life <= 0 || this.points.length < 2) {
      this.reset();
    }

    // Draw
    this.graphics.clear();
    this.graphics.moveTo(this.points[0].x, this.points[0].y);
    for (let i = 1; i < this.points.length; i++) {
      this.graphics.lineTo(this.points[i].x, this.points[i].y);
    }
    this.graphics.stroke({ width: 1, color: COLORS.violet, alpha: this.alpha * this.life });
  }

  resize(screenWidth, screenHeight) {
    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;
  }

  destroy() {
    this.container.removeChild(this.graphics);
    this.graphics.destroy();
  }
}

// ============================================================================
// DUST PARTICLE CLASS
// ============================================================================

class DustParticle {
  constructor(ctx, container, screenWidth, screenHeight) {
    this.classes = ctx.classes;
    this.container = container;
    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;

    this.graphics = new this.classes.Graphics();
    this.x = 0;
    this.y = 0;
    this.size = 0;
    this.alpha = 0;
    this.vx = 0;
    this.vy = 0;
    this.phase = 0;
    this.twinkleSpeed = 0;

    this.reset();
    this.container.addChild(this.graphics);
  }

  reset() {
    this.x = Math.random() * this.screenWidth;
    this.y = Math.random() * this.screenHeight;
    this.size = 1 + Math.random() * 2;
    this.alpha = 0.2 + Math.random() * 0.4;
    this.vx = (Math.random() - 0.5) * 0.3;
    this.vy = (Math.random() - 0.5) * 0.3;
    this.phase = Math.random() * Math.PI * 2;
    this.twinkleSpeed = 1 + Math.random() * 2;
  }

  update(mouseX, mouseY, deltaTime) {
    this.phase += deltaTime * this.twinkleSpeed;

    // Magnetic influence
    const dx = mouseX - this.x;
    const dy = mouseY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 200 && dist > 0) {
      const force = (1 - dist / 200) * 0.1;
      this.vx += (dx / dist) * force;
      this.vy += (dy / dist) * force;
    }

    this.vx *= 0.98;
    this.vy *= 0.98;

    this.x += this.vx;
    this.y += this.vy;

    // Wrap around
    if (this.x < 0) this.x = this.screenWidth;
    if (this.x > this.screenWidth) this.x = 0;
    if (this.y < 0) this.y = this.screenHeight;
    if (this.y > this.screenHeight) this.y = 0;

    // Draw with twinkle
    const twinkle = 0.5 + 0.5 * Math.sin(this.phase);
    this.graphics.clear();
    this.graphics.circle(this.x, this.y, this.size);
    this.graphics.fill({ color: COLORS.mercury, alpha: this.alpha * twinkle });
  }

  resize(screenWidth, screenHeight) {
    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;
  }

  destroy() {
    this.container.removeChild(this.graphics);
    this.graphics.destroy();
  }
}

// ============================================================================
// SPIKE CLASS
// ============================================================================

class Spike {
  constructor(ctx, container, x, y) {
    this.classes = ctx.classes;
    this.container = container;

    this.graphics = new this.classes.Graphics();
    this.x = x;
    this.y = y;
    this.angle = Math.random() * Math.PI * 2;
    this.length = 30 + Math.random() * 50;
    this.maxLength = this.length;
    this.width = 3 + Math.random() * 5;
    this.life = 1;
    this.growSpeed = 0.1 + Math.random() * 0.1;
    this.currentLength = 0;
    this.phase = 0;
    this.alive = true;

    this.container.addChild(this.graphics);
  }

  update(deltaTime) {
    if (!this.alive) return false;

    this.phase += deltaTime * 5;

    // Grow then shrink
    if (this.currentLength < this.maxLength && this.life > 0.5) {
      this.currentLength += this.maxLength * this.growSpeed;
    } else {
      this.life -= 0.015;
      this.currentLength *= 0.95;
    }

    if (this.life <= 0) {
      this.alive = false;
      this.container.removeChild(this.graphics);
      return false;
    }

    // Draw spike
    this.graphics.clear();

    const endX = this.x + Math.cos(this.angle) * this.currentLength;
    const endY = this.y + Math.sin(this.angle) * this.currentLength;

    // Gradient along spike
    this.graphics.moveTo(this.x, this.y);
    this.graphics.lineTo(endX, endY);
    this.graphics.stroke({ width: this.width * this.life, color: COLORS.mercury, alpha: this.life });

    // Glow at tip
    this.graphics.circle(endX, endY, 3 * this.life);
    this.graphics.fill({ color: COLORS.violet, alpha: this.life * 0.5 });

    return true;
  }

  destroy() {
    if (this.graphics.parent) {
      this.container.removeChild(this.graphics);
    }
    this.graphics.destroy();
    this.alive = false;
  }
}

// ============================================================================
// FERROFLUID ORACLE - MAIN COMPONENT
// ============================================================================

class FerrofluidOracle {
  /**
   * Default configuration
   */
  static defaults = {
    metaballCount: { core: 1, orbital: 8, outer: 12 },
    fieldLineCount: 30,
    dustParticleCount: 150,
    blurStrength: 15,
    blurQuality: 10,
    autoStart: true,
  };

  /**
   * @param {PixiContext} ctx - Context from createPixiContext()
   * @param {Object} options - Configuration options
   */
  constructor(ctx, options = {}) {
    // Validate context
    if (!ctx?.classes) {
      throw new Error('FerrofluidOracle: ctx (PixiContext) is required');
    }
    if (!options.container) {
      throw new Error('FerrofluidOracle: options.container is required');
    }

    // Store context references
    this.ticker = ctx.ticker;
    this.renderer = ctx.renderer;
    this.classes = ctx.classes;
    this.create = ctx.create;
    this.ctx = ctx;

    // Store container reference
    this.container = options.container;

    // Merge options with defaults
    this.options = { ...FerrofluidOracle.defaults, ...options };

    // Screen dimensions
    this._screenWidth = options.width || 800;
    this._screenHeight = options.height || 600;
    this._centerX = this._screenWidth / 2;
    this._centerY = this._screenHeight / 2;

    // Signals
    this.onStart = new Signal();
    this.onStop = new Signal();
    this.onUpdate = new Signal();
    this.onSpikeEruption = new Signal();

    // State
    this._running = false;
    this._destroyed = false;
    this._boundUpdate = null;
    this._time = 0;

    // Mouse tracking
    this._mouse = { x: this._centerX, y: this._centerY };
    this._targetMouse = { x: this._centerX, y: this._centerY };
    this._mouseVelocity = { x: 0, y: 0 };
    this._lastMouse = { x: this._centerX, y: this._centerY };

    // Collections
    this._metaballs = [];
    this._fieldLines = [];
    this._dustParticles = [];
    this._spikes = [];

    // Display objects
    this._metaballContainer = null;
    this._metaballGraphics = null;
    this._metaballSprite = null;
    this._fieldLinesContainer = null;
    this._dustContainer = null;
    this._spikeContainer = null;
    this._renderTexture = null;
    this._thresholdFilter = null;
    this._blurFilter = null;

    // Initialize
    this.setup();

    if (this.options.autoStart) {
      this.start();
    }
  }

  /**
   * Initialize visual elements
   */
  setup() {
    // Create metaball container with blur filter
    this._metaballContainer = new this.classes.Container();
    this._metaballGraphics = new this.classes.Graphics();
    this._metaballContainer.addChild(this._metaballGraphics);

    // Create blur filter for metaball threshold effect
    this._blurFilter = new this.classes.BlurFilter(
      this.options.blurStrength,
      this.options.blurQuality
    );
    this._metaballContainer.filters = [this._blurFilter];

    // Create render texture for metaballs
    this._renderTexture = this.classes.RenderTexture.create({
      width: this._screenWidth,
      height: this._screenHeight,
    });

    // Create sprite to display rendered metaballs
    this._metaballSprite = new this.classes.Sprite(this._renderTexture);

    // Create threshold shader filter (PixiJS v7 syntax)
    this._thresholdFilter = new this.classes.Filter(null, thresholdShaderSrc, {
      uTime: 0,
      uMouse: [0.5, 0.5]
    });
    this._metaballSprite.filters = [this._thresholdFilter];

    this.container.addChild(this._metaballSprite);

    // Create field lines container
    this._fieldLinesContainer = new this.classes.Container();
    this.container.addChild(this._fieldLinesContainer);

    // Create dust container
    this._dustContainer = new this.classes.Container();
    this.container.addChild(this._dustContainer);

    // Create spike container
    this._spikeContainer = new this.classes.Container();
    this.container.addChild(this._spikeContainer);

    // Initialize metaballs
    this._createMetaballs();

    // Initialize field lines
    this._createFieldLines();

    // Initialize dust particles
    this._createDustParticles();
  }

  /**
   * Create metaballs in organic formation
   */
  _createMetaballs() {
    const { core, orbital, outer } = this.options.metaballCount;

    // Core metaball
    for (let i = 0; i < core; i++) {
      this._metaballs.push(new Metaball(this._centerX, this._centerY, 120, true));
    }

    // Orbital metaballs
    for (let i = 0; i < orbital; i++) {
      const angle = (i / orbital) * Math.PI * 2;
      const dist = 80 + Math.random() * 40;
      this._metaballs.push(
        new Metaball(
          this._centerX + Math.cos(angle) * dist,
          this._centerY + Math.sin(angle) * dist,
          40 + Math.random() * 30
        )
      );
    }

    // Outer satellite metaballs
    for (let i = 0; i < outer; i++) {
      const angle = (i / outer) * Math.PI * 2 + Math.random() * 0.3;
      const dist = 150 + Math.random() * 80;
      this._metaballs.push(
        new Metaball(
          this._centerX + Math.cos(angle) * dist,
          this._centerY + Math.sin(angle) * dist,
          20 + Math.random() * 25
        )
      );
    }
  }

  /**
   * Create field lines
   */
  _createFieldLines() {
    for (let i = 0; i < this.options.fieldLineCount; i++) {
      this._fieldLines.push(
        new FieldLine(this.ctx, this._fieldLinesContainer, this._screenWidth, this._screenHeight)
      );
    }
  }

  /**
   * Create dust particles
   */
  _createDustParticles() {
    for (let i = 0; i < this.options.dustParticleCount; i++) {
      this._dustParticles.push(
        new DustParticle(this.ctx, this._dustContainer, this._screenWidth, this._screenHeight)
      );
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
    this.onStart.emit({ effect: this });
  }

  /**
   * Stop animation
   */
  stop() {
    if (!this._running) return;
    this._running = false;

    if (this._boundUpdate) {
      this.ticker.remove(this._boundUpdate);
    }
    this.onStop.emit({ effect: this });
  }

  /**
   * Main update loop
   */
  _update(delta) {
    const deltaTime = delta / 60;
    this._time += deltaTime;

    // Smooth mouse following
    this._mouse.x += (this._targetMouse.x - this._mouse.x) * 0.1;
    this._mouse.y += (this._targetMouse.y - this._mouse.y) * 0.1;

    // Calculate mouse velocity
    this._mouseVelocity.x = this._mouse.x - this._lastMouse.x;
    this._mouseVelocity.y = this._mouse.y - this._lastMouse.y;
    this._lastMouse.x = this._mouse.x;
    this._lastMouse.y = this._mouse.y;

    // Update metaballs
    this._updateMetaballs(deltaTime);

    // Render metaballs to texture
    this.renderer.render(this._metaballContainer, { renderTexture: this._renderTexture });

    // Update threshold shader uniforms
    this._thresholdFilter.uniforms.uTime = this._time;
    this._thresholdFilter.uniforms.uMouse = [
      this._mouse.x / this._screenWidth,
      this._mouse.y / this._screenHeight
    ];

    // Update field lines
    for (const line of this._fieldLines) {
      line.update(this._centerX, this._centerY);
    }

    // Update dust particles
    for (const particle of this._dustParticles) {
      particle.update(this._mouse.x, this._mouse.y, deltaTime);
    }

    // Update spikes (filter removes dead ones)
    this._spikes = this._spikes.filter(spike => spike.update(deltaTime));

    this.onUpdate.emit({ time: this._time, deltaTime });
  }

  /**
   * Update metaballs and render to graphics
   */
  _updateMetaballs(deltaTime) {
    this._metaballGraphics.clear();

    for (const ball of this._metaballs) {
      ball.update(this._mouse.x, this._mouse.y, this._mouseVelocity, deltaTime);

      // Draw metaball (will be blurred and thresholded)
      this._metaballGraphics.circle(ball.x, ball.y, ball.radius);
      this._metaballGraphics.fill({ color: 0xFFFFFF, alpha: 0.8 });
    }
  }

  /**
   * Set mouse position
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   */
  setMouse(x, y) {
    this._targetMouse.x = x;
    this._targetMouse.y = y;
  }

  /**
   * Create spike eruption at position
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {number} [count=8] - Number of spikes
   */
  createSpikeEruption(x, y, count = 8) {
    for (let i = 0; i < count; i++) {
      this._spikes.push(new Spike(this.ctx, this._spikeContainer, x, y));
    }
    this.onSpikeEruption.emit({ x, y, count });
  }

  /**
   * Resize the effect
   * @param {number} width - New width
   * @param {number} height - New height
   */
  resize(width, height) {
    this._screenWidth = width;
    this._screenHeight = height;
    this._centerX = width / 2;
    this._centerY = height / 2;

    // Resize render texture
    if (this._renderTexture) {
      this._renderTexture.resize(width, height);
    }

    // Resize field lines
    for (const line of this._fieldLines) {
      line.resize(width, height);
    }

    // Resize dust particles
    for (const particle of this._dustParticles) {
      particle.resize(width, height);
    }
  }

  /**
   * Get current mouse velocity (for UI readouts)
   */
  get mouseSpeed() {
    return Math.sqrt(
      this._mouseVelocity.x * this._mouseVelocity.x +
        this._mouseVelocity.y * this._mouseVelocity.y
    );
  }

  /**
   * Get current time
   */
  get time() {
    return this._time;
  }

  /**
   * Get running state
   */
  get running() {
    return this._running;
  }

  /**
   * Cleanup resources
   */
  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;

    this.stop();
    this._boundUpdate = null;

    // Clear signals
    this.onStart.clear();
    this.onStop.clear();
    this.onUpdate.clear();
    this.onSpikeEruption.clear();

    // Destroy spikes
    for (const spike of this._spikes) {
      spike.destroy();
    }
    this._spikes.length = 0;

    // Destroy field lines
    for (const line of this._fieldLines) {
      line.destroy();
    }
    this._fieldLines.length = 0;

    // Destroy dust particles
    for (const particle of this._dustParticles) {
      particle.destroy();
    }
    this._dustParticles.length = 0;

    // Clear metaballs
    this._metaballs.length = 0;

    // Destroy render texture
    if (this._renderTexture) {
      this._renderTexture.destroy(true);
      this._renderTexture = null;
    }

    // Destroy containers
    if (this._metaballSprite) {
      this.container.removeChild(this._metaballSprite);
      this._metaballSprite.destroy();
    }
    if (this._metaballContainer) {
      this._metaballContainer.destroy({ children: true });
    }
    if (this._fieldLinesContainer) {
      this.container.removeChild(this._fieldLinesContainer);
      this._fieldLinesContainer.destroy();
    }
    if (this._dustContainer) {
      this.container.removeChild(this._dustContainer);
      this._dustContainer.destroy();
    }
    if (this._spikeContainer) {
      this.container.removeChild(this._spikeContainer);
      this._spikeContainer.destroy();
    }
  }
}

// ============================================================================
// PIXI CONTEXT FACTORY (for standalone usage)
// ============================================================================

/**
 * Creates a PixiContext for PixiJS v7
 * @param {object} pixiModule - PIXI namespace (global or imported)
 * @param {PIXI.Application} app - Initialized PIXI application
 * @param {object} [config] - Optional overrides
 * @returns {PixiContext} Immutable context object
 */
function createPixiContext(pixiModule, app, config = {}) {
  if (!pixiModule) {
    throw new Error('PixiContext: pixiModule is required');
  }
  if (!app?.stage) {
    throw new Error('PixiContext: app with stage is required');
  }

  return Object.freeze({
    app,
    stage: app.stage,
    ticker: config.ticker ?? app.ticker,
    renderer: app.renderer,
    classes: Object.freeze({
      Container: config.Container ?? pixiModule.Container,
      Graphics: config.Graphics ?? pixiModule.Graphics,
      Sprite: config.Sprite ?? pixiModule.Sprite,
      Text: config.Text ?? pixiModule.Text,
      TilingSprite: config.TilingSprite ?? pixiModule.TilingSprite,
      ParticleContainer: config.ParticleContainer ?? pixiModule.ParticleContainer,
      Point: config.Point ?? pixiModule.Point,
      Rectangle: config.Rectangle ?? pixiModule.Rectangle,
      BlurFilter: config.BlurFilter ?? pixiModule.BlurFilter,
      ColorMatrixFilter: config.ColorMatrixFilter ?? pixiModule.ColorMatrixFilter,
      Filter: config.Filter ?? pixiModule.Filter,
      RenderTexture: config.RenderTexture ?? pixiModule.RenderTexture,
    }),
    create: Object.freeze({
      container: () => new (config.Container ?? pixiModule.Container)(),
      graphics: () => new (config.Graphics ?? pixiModule.Graphics)(),
      sprite: (texture) => new (config.Sprite ?? pixiModule.Sprite)(texture),
      text: (opts) => new (config.Text ?? pixiModule.Text)(opts),
      point: (x = 0, y = 0) => new (config.Point ?? pixiModule.Point)(x, y),
      rectangle: (x, y, w, h) => new (config.Rectangle ?? pixiModule.Rectangle)(x, y, w, h),
    }),
  });
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  FerrofluidOracle,
  Metaball,
  FieldLine,
  DustParticle,
  Spike,
  Signal,
  createPixiContext,
  COLORS,
  thresholdShaderSrc,
};

export default FerrofluidOracle;