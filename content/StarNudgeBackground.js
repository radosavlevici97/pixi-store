/**
 * StarNudgeBackground - Golden Bokeh Paradise Background Animation
 * 
 * A multi-layered, parallax bokeh particle system designed for the Star Nudge
 * slot game. Features floating golden orbs at multiple depths with breathing
 * animations, win-responsive intensity, and smooth organic movement.
 * 
 * Pure composition - receives PixiContext via constructor, NEVER extends PIXI.
 * Uses ctx.classes for all PIXI instantiation (no direct PIXI. usage).
 * 
 * @author Claude AI
 * @version 2.0.0 (PixiContext refactor)
 * @license MIT
 * 
 * Features:
 * - 3 parallax depth layers (far, mid, near)
 * - Object pooling for optimal performance
 * - Delta-time based animation
 * - Breathing/pulsing animation on each orb
 * - Win intensity system (idle, win, big win modes)
 * - Seamless edge wrapping
 * - Configurable density, speed, and color palette
 */

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG = {
  // Dimensions
  width: 1920,
  height: 1080,
  
  // Layer configuration
  layers: [
    { depth: 3, count: 15, minSize: 80, maxSize: 180, speed: 0.15, alpha: 0.15 },  // Far (blurry, slow)
    { depth: 2, count: 25, minSize: 40, maxSize: 100, speed: 0.25, alpha: 0.25 },  // Mid
    { depth: 1, count: 20, minSize: 20, maxSize: 60, speed: 0.4, alpha: 0.35 },    // Near (sharp, fast)
  ],
  
  // Colors (warm golden palette from Star Nudge)
  colors: [
    0xFFD700,  // Gold
    0xFFB020,  // Deep amber
    0xFFA500,  // Orange
    0xFFE4B5,  // Moccasin (light gold)
    0xFFF8DC,  // Cornsilk (cream)
  ],
  
  // Animation
  baseSpeedX: 0.3,           // Horizontal drift speed
  baseSpeedY: -0.1,          // Vertical drift (negative = upward)
  breatheSpeed: 0.02,        // Pulse/breathing speed
  breatheAmount: 0.15,       // Scale variation (±15%)
  wobbleAmount: 30,          // Horizontal wobble amplitude
  wobbleSpeed: 0.008,        // Wobble frequency
  
  // Intensity modes
  idleIntensity: 1.0,
  winIntensity: 1.5,
  bigWinIntensity: 2.5,
  
  // Performance
  autoStart: true,
};

// ============================================================================
// STAR NUDGE BACKGROUND CLASS
// ============================================================================

class StarNudgeBackground {
  /**
   * Static defaults for external access
   */
  static defaults = DEFAULT_CONFIG;

  /**
   * @param {PixiContext} ctx - PixiContext with classes, ticker, create, gsap
   * @param {Object} options - Configuration options
   * @param {Container} options.container - Container to add particles to
   * @param {Texture} [options.bokehTexture] - Custom bokeh texture (optional, generates if not provided)
   * @param {number} [options.width=1920] - Background width
   * @param {number} [options.height=1080] - Background height
   * @param {boolean} [options.autoStart=true] - Start animation automatically
   */
  constructor(ctx, options = {}) {
    // Validate required context
    if (!ctx?.classes) {
      throw new Error('StarNudgeBackground: ctx.classes is required (PixiContext)');
    }
    if (!ctx?.ticker) {
      throw new Error('StarNudgeBackground: ctx.ticker is required (PixiContext)');
    }
    
    // Store context references
    this.classes = ctx.classes;
    this.ticker = ctx.ticker;
    this.create = ctx.create;
    this.gsap = ctx.gsap;
    
    // Validate required options
    if (!options.container) {
      throw new Error('StarNudgeBackground: options.container is required');
    }
    
    // Store container reference
    this.container = options.container;
    
    // Merge options with defaults
    this.options = { ...DEFAULT_CONFIG, ...options };
    
    // State flags
    this._running = false;
    this._destroyed = false;
    this._boundUpdate = null;
    this._burstTimeout = null;
    this._intensity = this.options.idleIntensity;
    this._targetIntensity = this.options.idleIntensity;
    this._time = 0;
    
    // Layer containers and particle pools
    this._layerContainers = [];
    this._particles = [];  // All particles flat for easy iteration
    
    // Pre-create reusable objects
    this._tempPoint = { x: 0, y: 0 };
    
    // Initialize
    this._createBokehTexture();
    this._setup();
    
    // Auto-start if configured
    if (this.options.autoStart) {
      this.start();
    }
  }
  
  /**
   * Generate a soft radial gradient bokeh texture programmatically
   * This avoids external asset dependencies
   * @private
   */
  _createBokehTexture() {
    if (this.options.bokehTexture) {
      this._bokehTexture = this.options.bokehTexture;
      return;
    }
    
    // Create a canvas to draw the bokeh
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    // Create radial gradient (soft circle with feathered edges)
    const gradient = ctx.createRadialGradient(
      size / 2, size / 2, 0,           // Inner circle
      size / 2, size / 2, size / 2     // Outer circle
    );
    
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.8)');
    gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0.3)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    
    // Create texture from canvas using classes.Texture if available
    // Note: Texture.from is a static method, so we access it via the class
    if (this.classes.Texture?.from) {
      this._bokehTexture = this.classes.Texture.from(canvas);
    } else {
      // Fallback: texture should be passed via options in production
      throw new Error('StarNudgeBackground: bokehTexture must be provided via options or ctx.classes.Texture must be available');
    }
  }
  
  /**
   * Initialize all visual elements and particle pools
   * @private
   */
  _setup() {
    const { width, height, layers, colors } = this.options;
    
    // Create layer containers (back to front for proper z-ordering)
    for (let i = 0; i < layers.length; i++) {
      const layerConfig = layers[i];
      const layerContainer = new this.classes.Container();
      
      // Apply blur based on depth (far = more blur) - PixiJS v8 syntax
      if (layerConfig.depth > 1) {
        const blurAmount = (layerConfig.depth - 1) * 4;
        layerContainer.filters = [new this.classes.BlurFilter({ strength: blurAmount })];
      }
      
      this._layerContainers.push(layerContainer);
      this.container.addChild(layerContainer);
      
      // Create particles for this layer
      for (let j = 0; j < layerConfig.count; j++) {
        const particle = this._createParticle(layerConfig, colors, i);
        layerContainer.addChild(particle.sprite);
        this._particles.push(particle);
      }
    }
  }
  
  /**
   * Create a single particle with all animation properties
   * @private
   */
  _createParticle(layerConfig, colors, layerIndex) {
    const { width, height } = this.options;
    
    // Create sprite using context classes
    const sprite = new this.classes.Sprite(this._bokehTexture);
    sprite.anchor.set(0.5);
    sprite.blendMode = 'add';  // Additive blending for light accumulation
    
    // Random size within layer range
    const size = layerConfig.minSize + Math.random() * (layerConfig.maxSize - layerConfig.minSize);
    const baseScale = size / 128;  // 128 is our texture size
    sprite.scale.set(baseScale);
    
    // Random position
    sprite.x = Math.random() * width;
    sprite.y = Math.random() * height;
    
    // Random color from palette
    const color = colors[Math.floor(Math.random() * colors.length)];
    sprite.tint = color;
    
    // Base alpha from layer config
    sprite.alpha = layerConfig.alpha * (0.7 + Math.random() * 0.3);
    
    // Create particle data object
    const particle = {
      sprite,
      layerIndex,
      layerConfig,
      baseScale,
      baseAlpha: sprite.alpha,
      
      // Movement
      vx: (Math.random() - 0.5) * 2,  // Random horizontal variance
      vy: (Math.random() - 0.5) * 2,  // Random vertical variance
      
      // Animation phase offsets (for organic feel)
      breatheOffset: Math.random() * Math.PI * 2,
      wobbleOffset: Math.random() * Math.PI * 2,
      
      // Starting position for wrap calculation
      startX: sprite.x,
      startY: sprite.y,
    };
    
    return particle;
  }
  
  /**
   * Start animation loop
   */
  start() {
    if (this._destroyed || this._running) return this;
    this._running = true;
    
    this._boundUpdate = this._boundUpdate || this._update.bind(this);
    this.ticker.add(this._boundUpdate);
    
    return this;
  }
  
  /**
   * Main update loop - called every frame
   * @param {Ticker} ticker
   * @private
   */
  _update(ticker) {
    if (this._destroyed || !this._running) return;
    
    const delta = ticker.deltaTime;
    const { width, height, baseSpeedX, baseSpeedY, breatheSpeed, breatheAmount, wobbleAmount, wobbleSpeed } = this.options;
    
    // Update global time
    this._time += delta;
    
    // Smooth intensity transitions
    this._intensity += (this._targetIntensity - this._intensity) * 0.05 * delta;
    
    // Update each particle
    for (let i = 0; i < this._particles.length; i++) {
      const p = this._particles[i];
      const sprite = p.sprite;
      const config = p.layerConfig;
      
      // Calculate layer-specific speed (deeper = slower)
      const depthFactor = 1 / config.depth;
      const intensityFactor = this._intensity;
      
      // Horizontal movement with wobble
      sprite.x += (baseSpeedX * config.speed + p.vx * 0.1) * depthFactor * intensityFactor * delta;
      sprite.x += Math.sin(this._time * wobbleSpeed * 0.5 + p.wobbleOffset) * 0.3 * delta;
      
      // Vertical movement (slow upward drift)
      sprite.y += (baseSpeedY * config.speed + p.vy * 0.1) * depthFactor * intensityFactor * delta;
      
      // Edge wrapping with buffer zone
      const buffer = config.maxSize;
      if (sprite.x > width + buffer) sprite.x = -buffer;
      if (sprite.x < -buffer) sprite.x = width + buffer;
      if (sprite.y > height + buffer) sprite.y = -buffer;
      if (sprite.y < -buffer) sprite.y = height + buffer;
      
      // Breathing/pulsing scale animation
      const breathe = Math.sin(this._time * breatheSpeed + p.breatheOffset);
      const scaleVariation = 1 + breathe * breatheAmount * intensityFactor;
      sprite.scale.set(p.baseScale * scaleVariation);
      
      // Alpha pulsing (subtle)
      const alphaPulse = 1 + breathe * 0.1;
      sprite.alpha = p.baseAlpha * alphaPulse * Math.min(intensityFactor, 1.5);
    }
  }
  
  /**
   * Stop animation loop
   */
  stop() {
    if (!this._running) return this;
    this._running = false;
    
    if (this._boundUpdate) {
      this.ticker.remove(this._boundUpdate);
    }
    
    return this;
  }
  
  /**
   * Reset to initial state
   */
  reset() {
    this.stop();
    this._time = 0;
    this._intensity = this.options.idleIntensity;
    this._targetIntensity = this.options.idleIntensity;
    
    // Reset particle positions
    const { width, height } = this.options;
    for (const p of this._particles) {
      p.sprite.x = Math.random() * width;
      p.sprite.y = Math.random() * height;
      p.sprite.scale.set(p.baseScale);
      p.sprite.alpha = p.baseAlpha;
    }
    
    return this;
  }
  
  /**
   * Set animation intensity (for win celebrations)
   * @param {string} mode - 'idle', 'win', or 'bigWin'
   */
  setMode(mode) {
    switch (mode) {
      case 'win':
        this._targetIntensity = this.options.winIntensity;
        break;
      case 'bigWin':
        this._targetIntensity = this.options.bigWinIntensity;
        break;
      case 'idle':
      default:
        this._targetIntensity = this.options.idleIntensity;
    }
    return this;
  }
  
  /**
   * Set custom intensity value
   * @param {number} value - Intensity multiplier (1.0 = normal)
   */
  setIntensity(value) {
    this._targetIntensity = value;
    return this;
  }
  
  /**
   * Burst effect - briefly increase intensity then return to current mode
   * @param {number} [duration=1000] - Duration in milliseconds
   */
  burst(duration = 1000) {
    const previousTarget = this._targetIntensity;
    this._targetIntensity = this.options.bigWinIntensity;
    
    // Clear any existing burst timeout
    if (this._burstTimeout) {
      clearTimeout(this._burstTimeout);
    }
    
    this._burstTimeout = setTimeout(() => {
      this._targetIntensity = previousTarget;
      this._burstTimeout = null;
    }, duration);
    
    return this;
  }
  
  /**
   * Update background dimensions (for responsive layouts)
   * @param {number} width 
   * @param {number} height 
   */
  resize(width, height) {
    this.options.width = width;
    this.options.height = height;
    
    // Redistribute particles
    for (const p of this._particles) {
      if (p.sprite.x > width) p.sprite.x = Math.random() * width;
      if (p.sprite.y > height) p.sprite.y = Math.random() * height;
    }
    
    return this;
  }
  
  // Getters
  get running() { return this._running; }
  get intensity() { return this._intensity; }
  get particleCount() { return this._particles.length; }
  
  /**
   * Clean up - remove all children and release resources
   */
  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    
    this.stop();
    this._boundUpdate = null;
    
    // Clear any pending burst timeout
    if (this._burstTimeout) {
      clearTimeout(this._burstTimeout);
      this._burstTimeout = null;
    }
    
    // Kill any GSAP tweens if gsap is available
    if (this.gsap) {
      for (const p of this._particles) {
        this.gsap.killTweensOf(p.sprite);
      }
    }
    
    // Remove all layer containers and their children
    for (const container of this._layerContainers) {
      // Clear filters
      if (container.filters) {
        container.filters.forEach(f => f.destroy?.());
        container.filters = null;
      }
      
      // Remove from parent
      if (container.parent) {
        container.parent.removeChild(container);
      }
      container.destroy({ children: true });
    }
    
    this._layerContainers = [];
    this._particles = [];
    
    // Destroy generated texture if we created it
    if (!this.options.bokehTexture && this._bokehTexture) {
      this._bokehTexture.destroy(true);
      this._bokehTexture = null;
    }
    
    // Nullify references
    this.classes = null;
    this.ticker = null;
    this.create = null;
    this.gsap = null;
    this.container = null;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export { StarNudgeBackground, DEFAULT_CONFIG };
export default StarNudgeBackground;
