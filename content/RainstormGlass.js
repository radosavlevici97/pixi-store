/**
 * RainstormGlass - Realistic rain droplets on glass with refraction effect
 * 
 * Features:
 * - Physics-based droplet simulation with gravity and surface tension
 * - Droplet merging with momentum conservation
 * - Procedural city lights background with bokeh
 * - Displacement-based refraction through droplets
 * - Lightning effects with screen shake
 * - Interactive droplet spawning
 * - Object pooling for performance
 * 
 * @example
 * const ctx = createPixiContext(PIXI, { gsap, PixiPlugin }, app);
 * const rainstorm = new RainstormGlass(ctx, {
 *   container: app.stage,
 *   width: 800,
 *   height: 600,
 *   autoStart: true
 * });
 */

// =============================================================================
// RAINDROP DATA CLASS
// =============================================================================

class Raindrop {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.radius = 3;
    this.mass = 1;
    this.life = 1;
    this.maxLife = 1;
    this.active = false;
    this.stuck = false;
    this.stuckTimer = 0;
    this.trail = [];
    this.trailMaxLength = 20;
    this.merged = false;
  }
  
  reset() {
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.radius = 3;
    this.mass = 1;
    this.life = 1;
    this.maxLife = 1;
    this.active = false;
    this.stuck = false;
    this.stuckTimer = 0;
    this.trail = [];
    this.merged = false;
  }
}

// =============================================================================
// DEFAULTS
// =============================================================================

const DEFAULTS = {
  backgroundTexture: null,
  width: 800,
  height: 600,
  maxDroplets: 400,
  spawnRate: 2,
  gravity: 0.15,
  terminalVelocity: 8,
  surfaceTension: 0.3,
  refractionStrength: 0.02,
  blurAmount: 30,
  enableLightning: true,
  lightningInterval: [180, 600],
  enableInteraction: true,
  minDropletRadius: 2,
  maxDropletRadius: 8,
  mergeDistance: 1.8,
  autoStart: false
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

class RainstormGlass {
  /**
   * Static defaults for option merging
   */
  static defaults = DEFAULTS;
  
  /**
   * @param {Object} ctx - PixiContext with classes, ticker, renderer, gsap
   * @param {Object} options - Configuration options
   * @param {PIXI.Container} options.container - Parent container to add effect to
   * @param {number} [options.width=800] - Effect width
   * @param {number} [options.height=600] - Effect height
   * @param {number} [options.maxDroplets=400] - Maximum pooled droplets
   * @param {number} [options.spawnRate=2] - Droplets spawned per frame
   * @param {number} [options.gravity=0.15] - Gravity acceleration
   * @param {number} [options.terminalVelocity=8] - Max fall speed
   * @param {number} [options.surfaceTension=0.3] - Horizontal wobble amount
   * @param {number} [options.refractionStrength=0.02] - Displacement strength
   * @param {number} [options.blurAmount=30] - Background blur strength
   * @param {boolean} [options.enableLightning=true] - Enable lightning flashes
   * @param {number[]} [options.lightningInterval=[180,600]] - Lightning timing range
   * @param {boolean} [options.enableInteraction=true] - Enable mouse/touch interaction
   * @param {boolean} [options.autoStart=false] - Start animation immediately
   */
  constructor(ctx, options = {}) {
    // Validate context
    if (!ctx?.classes) {
      throw new Error('RainstormGlass: ctx.classes is required');
    }
    if (!ctx?.ticker) {
      throw new Error('RainstormGlass: ctx.ticker is required');
    }
    if (!ctx?.renderer) {
      throw new Error('RainstormGlass: ctx.renderer is required');
    }
    
    // Store context references
    this.classes = ctx.classes;
    this.ticker = ctx.ticker;
    this.renderer = ctx.renderer;
    this.gsap = ctx.gsap;
    
    // Merge options with defaults
    this.options = { ...RainstormGlass.defaults, ...options };
    
    // Validate required options
    if (!this.options.container) {
      throw new Error('RainstormGlass: options.container is required');
    }
    
    this.container = this.options.container;
    
    // Internal state
    this._destroyed = false;
    this._running = false;
    this._boundUpdate = null;
    this._time = 0;
    this._lightningTimer = 0;
    this._lightningCooldown = this._randomRange(
      this.options.lightningInterval[0],
      this.options.lightningInterval[1]
    );
    
    // Display objects tracking
    this._displayObjects = [];
    
    // Object pool
    this._dropletPool = [];
    this._activeDroplets = [];
    this._spatialGrid = new Map();
    
    // Initialize pool
    this._initPool();
    
    // Setup display objects
    this._setup();
    
    // Auto-start if configured
    if (this.options.autoStart) {
      this.start();
    }
  }
  
  _initPool() {
    for (let i = 0; i < this.options.maxDroplets; i++) {
      this._dropletPool.push(new Raindrop());
    }
  }
  
  _spawnDroplet() {
    if (this._dropletPool.length === 0) return null;
    const drop = this._dropletPool.pop();
    drop.reset();
    drop.active = true;
    this._activeDroplets.push(drop);
    return drop;
  }
  
  _despawnDroplet(drop) {
    if (!drop.active) return;
    drop.active = false;
    const idx = this._activeDroplets.indexOf(drop);
    if (idx > -1) {
      this._activeDroplets.splice(idx, 1);
      this._dropletPool.push(drop);
    }
  }
  
  _setup() {
    const { Container, Graphics, BlurFilter, DisplacementFilter, RenderTexture, Sprite, Rectangle } = this.classes;
    const { width, height } = this.options;
    
    // Layer containers
    this._backgroundLayer = new Container();
    this._dropletLayer = new Container();
    this._overlayLayer = new Container();
    
    this.container.addChild(this._backgroundLayer);
    this.container.addChild(this._dropletLayer);
    this.container.addChild(this._overlayLayer);
    
    this._displayObjects.push(
      this._backgroundLayer,
      this._dropletLayer,
      this._overlayLayer
    );
    
    // Setup components
    this._setupBackground();
    this._setupDropletMap();
    this._setupRefractionFilter();
    this._setupLightningOverlay();
    
    if (this.options.enableInteraction) {
      this._setupInteraction();
    }
    
    // Main droplet graphics
    this._dropletGraphics = new Graphics();
    this._dropletLayer.addChild(this._dropletGraphics);
  }
  
  _setupBackground() {
    const { Graphics, BlurFilter } = this.classes;
    const { blurAmount } = this.options;
    
    this._backgroundSprite = this._createProceduralBackground();
    
    this._blurFilter = new BlurFilter({
      strength: blurAmount / 10,
      quality: 4
    });
    this._backgroundSprite.filters = [this._blurFilter];
    
    this._backgroundLayer.addChild(this._backgroundSprite);
  }
  
  _createProceduralBackground() {
    const { Graphics } = this.classes;
    const { width, height } = this.options;
    const graphics = new Graphics();
    
    // Dark gradient background
    graphics.rect(0, 0, width, height);
    graphics.fill(0x0a1628);
    
    // Add subtle gradient overlay
    for (let i = 0; i < height; i += 2) {
      const alpha = (i / height) * 0.3;
      graphics.rect(0, i, width, 2);
      graphics.fill({ color: 0x1a2a3a, alpha });
    }
    
    // City lights bokeh
    const colors = [0xffb347, 0xff6b9d, 0x4ecdc4, 0xffe66d, 0xa8d5e5, 0xff8c42, 0x9b59b6];
    
    // Large blurred lights
    for (let i = 0; i < 60; i++) {
      const x = Math.random() * width;
      const y = height * 0.25 + Math.random() * height * 0.75;
      const radius = 8 + Math.random() * 35;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const alpha = 0.15 + Math.random() * 0.4;
      
      graphics.circle(x, y, radius);
      graphics.fill({ color, alpha });
    }
    
    // Medium lights
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * width;
      const y = height * 0.4 + Math.random() * height * 0.6;
      const radius = 4 + Math.random() * 12;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const alpha = 0.3 + Math.random() * 0.5;
      
      graphics.circle(x, y, radius);
      graphics.fill({ color, alpha });
    }
    
    // Sharp point lights
    for (let i = 0; i < 50; i++) {
      const x = Math.random() * width;
      const y = height * 0.3 + Math.random() * height * 0.7;
      
      graphics.circle(x, y, 1 + Math.random() * 3);
      graphics.fill({ color: 0xffffff, alpha: 0.6 + Math.random() * 0.4 });
    }
    
    // Window-like rectangles
    for (let i = 0; i < 30; i++) {
      const x = Math.random() * width;
      const y = height * 0.5 + Math.random() * height * 0.5;
      const w = 2 + Math.random() * 6;
      const h = 3 + Math.random() * 8;
      const color = colors[Math.floor(Math.random() * 3)]; // Warmer colors
      const alpha = 0.3 + Math.random() * 0.4;
      
      graphics.rect(x, y, w, h);
      graphics.fill({ color, alpha });
    }
    
    return graphics;
  }
  
  _setupDropletMap() {
    const { RenderTexture, Graphics } = this.classes;
    const { width, height } = this.options;
    
    this._dropletRenderTexture = RenderTexture.create({
      width: Math.floor(width / 2),
      height: Math.floor(height / 2),
      resolution: 1
    });
    
    this._dropletMapGraphics = new Graphics();
  }
  
  _setupRefractionFilter() {
    const { Sprite, DisplacementFilter } = this.classes;
    
    this._displacementSprite = new Sprite(this._dropletRenderTexture);
    this._displacementSprite.scale.set(2);
    this.container.addChild(this._displacementSprite);
    this._displacementSprite.visible = false;
    
    this._displacementFilter = new DisplacementFilter({
      sprite: this._displacementSprite,
      scale: { x: this.options.refractionStrength * 100, y: this.options.refractionStrength * 100 }
    });
    
    this._backgroundLayer.filters = [
      this._blurFilter,
      this._displacementFilter
    ];
  }
  
  _setupLightningOverlay() {
    const { Graphics } = this.classes;
    const { width, height } = this.options;
    
    this._lightningOverlay = new Graphics();
    this._lightningOverlay.rect(0, 0, width, height);
    this._lightningOverlay.fill({ color: 0xffffff, alpha: 1 });
    this._lightningOverlay.alpha = 0;
    
    this._overlayLayer.addChild(this._lightningOverlay);
  }
  
  _setupInteraction() {
    const { Rectangle } = this.classes;
    
    this.container.eventMode = 'static';
    this.container.hitArea = new Rectangle(
      0, 0, 
      this.options.width, 
      this.options.height
    );
    
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerDown = this._onPointerDown.bind(this);
    
    this.container.on('pointermove', this._onPointerMove);
    this.container.on('pointerdown', this._onPointerDown);
  }
  
  _onPointerMove(event) {
    if (!this._running) return;
    
    const pos = event.global;
    const localPos = this.container.toLocal(pos);
    
    if (Math.random() > 0.6) {
      this.spawnDropletAt(localPos.x, localPos.y, {
        radius: 2 + Math.random() * 4,
        vx: (Math.random() - 0.5) * 0.8,
        vy: Math.random() * 0.8
      });
    }
  }
  
  _onPointerDown(event) {
    if (!this._running) return;
    
    const pos = event.global;
    const localPos = this.container.toLocal(pos);
    
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const speed = 1.5 + Math.random() * 2;
      this.spawnDropletAt(localPos.x, localPos.y, {
        radius: 3 + Math.random() * 5,
        vx: Math.cos(angle) * speed * 0.4,
        vy: Math.sin(angle) * speed * 0.3 + 0.8
      });
    }
  }
  
  /**
   * Start the animation
   */
  start() {
    if (this._destroyed || this._running) return this;
    this._running = true;
    
    this._boundUpdate = this._boundUpdate || this._update.bind(this);
    this.ticker.add(this._boundUpdate);
    
    return this;
  }
  
  /**
   * Stop the animation
   */
  stop() {
    if (!this._running) return this;
    this._running = false;
    
    if (this._boundUpdate) {
      this.ticker.remove(this._boundUpdate);
    }
    
    return this;
  }
  
  _update(ticker) {
    if (this._destroyed) return;
    
    const delta = ticker.deltaTime;
    this._time += delta;
    
    this._updateSpawning(delta);
    this._updateDropletPhysics(delta);
    this._updateMerging();
    
    if (this.options.enableLightning) {
      this._updateLightning(delta);
    }
    
    this._renderDropletMap();
    this._renderDroplets();
  }
  
  _updateSpawning(delta) {
    const { width, spawnRate } = this.options;
    
    for (let i = 0; i < Math.ceil(spawnRate); i++) {
      if (Math.random() < (spawnRate - Math.floor(spawnRate) + 0.5)) {
        this.spawnDropletAt(
          Math.random() * width,
          -10 - Math.random() * 50,
          {
            radius: this._randomRange(
              this.options.minDropletRadius,
              this.options.maxDropletRadius
            ),
            vy: 1 + Math.random() * 2
          }
        );
      }
    }
  }
  
  /**
   * Spawn a droplet at specific coordinates
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {Object} props - Droplet properties
   * @param {number} [props.radius] - Droplet radius
   * @param {number} [props.vx] - Initial X velocity
   * @param {number} [props.vy] - Initial Y velocity
   * @returns {Raindrop|null} The spawned droplet or null if pool is empty
   */
  spawnDropletAt(x, y, props = {}) {
    const drop = this._spawnDroplet();
    if (!drop) return null;
    
    drop.x = x;
    drop.y = y;
    drop.vx = props.vx ?? (Math.random() - 0.5) * 0.2;
    drop.vy = props.vy ?? 0;
    drop.radius = props.radius ?? this._randomRange(
      this.options.minDropletRadius,
      this.options.maxDropletRadius
    );
    drop.mass = drop.radius * drop.radius;
    drop.maxLife = 400 + Math.random() * 300;
    drop.life = drop.maxLife;
    
    return drop;
  }
  
  _updateDropletPhysics(delta) {
    const { gravity, terminalVelocity, surfaceTension, width, height } = this.options;
    
    for (let i = this._activeDroplets.length - 1; i >= 0; i--) {
      const drop = this._activeDroplets[i];
      
      if (drop.merged) continue;
      
      drop.life -= delta;
      
      if (drop.life <= 0 || drop.y > height + 50) {
        this._despawnDroplet(drop);
        continue;
      }
      
      if (drop.stuck) {
        drop.stuckTimer -= delta;
        if (drop.stuckTimer <= 0) {
          drop.stuck = false;
        }
        continue;
      }
      
      if (Math.random() < 0.001 * (1 / drop.radius)) {
        drop.stuck = true;
        drop.stuckTimer = 20 + Math.random() * 40;
        continue;
      }
      
      drop.vy += gravity * delta;
      
      if (drop.vy > terminalVelocity) {
        drop.vy = terminalVelocity;
      }
      
      drop.vx += (Math.random() - 0.5) * surfaceTension * delta;
      drop.vx *= 0.98;
      
      drop.x += drop.vx * delta;
      drop.y += drop.vy * delta;
      
      if (drop.trail.length === 0 || 
          this._distance(drop.x, drop.y, drop.trail[0].x, drop.trail[0].y) > 2) {
        drop.trail.unshift({ x: drop.x, y: drop.y, r: drop.radius * 0.5 });
        if (drop.trail.length > drop.trailMaxLength) {
          drop.trail.pop();
        }
      }
      
      if (drop.x < drop.radius) {
        drop.x = drop.radius;
        drop.vx *= -0.5;
      }
      if (drop.x > width - drop.radius) {
        drop.x = width - drop.radius;
        drop.vx *= -0.5;
      }
    }
  }
  
  _updateMerging() {
    const { mergeDistance, maxDropletRadius } = this.options;
    const cellSize = maxDropletRadius * 4;
    
    // Reuse spatial hash grid
    const grid = this._spatialGrid;
    grid.clear();
    
    for (const drop of this._activeDroplets) {
      if (!drop.active || drop.merged) continue;
      
      const cellX = Math.floor(drop.x / cellSize);
      const cellY = Math.floor(drop.y / cellSize);
      const key = `${cellX},${cellY}`;
      
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(drop);
    }
    
    // Check only neighboring cells
    for (const [key, cellDrops] of grid) {
      const [cx, cy] = key.split(',').map(Number);
      
      const neighbors = [];
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const neighborKey = `${cx + dx},${cy + dy}`;
          if (grid.has(neighborKey)) {
            neighbors.push(...grid.get(neighborKey));
          }
        }
      }
      
      for (const a of cellDrops) {
        if (!a.active || a.merged) continue;
        
        for (const b of neighbors) {
          if (a === b || !b.active || b.merged) continue;
          
          const distSq = this._distanceSquared(a.x, a.y, b.x, b.y);
          const minDist = (a.radius + b.radius) * mergeDistance;
          const minDistSq = minDist * minDist;
          
          if (distSq < minDistSq) {
            this._mergeDroplets(a, b);
          }
        }
      }
    }
    
    for (let i = this._activeDroplets.length - 1; i >= 0; i--) {
      if (this._activeDroplets[i].merged) {
        this._despawnDroplet(this._activeDroplets[i]);
      }
    }
  }
  
  _mergeDroplets(a, b) {
    const totalMass = a.mass + b.mass;
    
    a.vx = (a.vx * a.mass + b.vx * b.mass) / totalMass;
    a.vy = (a.vy * a.mass + b.vy * b.mass) / totalMass;
    
    a.x = (a.x * a.mass + b.x * b.mass) / totalMass;
    a.y = (a.y * a.mass + b.y * b.mass) / totalMass;
    
    a.radius = Math.sqrt(a.radius * a.radius + b.radius * b.radius);
    a.mass = a.radius * a.radius;
    
    if (a.radius > this.options.maxDropletRadius * 2.5) {
      a.radius = this.options.maxDropletRadius * 2.5;
    }
    
    a.trail = [...a.trail, ...b.trail].slice(0, a.trailMaxLength);
    a.stuck = false;
    
    b.merged = true;
  }
  
  _updateLightning(delta) {
    this._lightningTimer += delta;
    
    if (this._lightningTimer >= this._lightningCooldown) {
      this.triggerLightning();
      this._lightningTimer = 0;
      this._lightningCooldown = this._randomRange(
        this.options.lightningInterval[0],
        this.options.lightningInterval[1]
      );
    }
    
    if (this._lightningOverlay.alpha > 0) {
      this._lightningOverlay.alpha *= 0.82;
      if (this._lightningOverlay.alpha < 0.01) {
        this._lightningOverlay.alpha = 0;
      }
    }
    
    // Smooth return from shake
    this.container.x *= 0.8;
    this.container.y *= 0.8;
  }
  
  /**
   * Trigger a lightning flash effect
   */
  triggerLightning() {
    this._lightningOverlay.alpha = 0.7 + Math.random() * 0.3;
    
    const shakeX = (Math.random() - 0.5) * 12;
    const shakeY = (Math.random() - 0.5) * 6;
    this.container.x = shakeX;
    this.container.y = shakeY;
  }
  
  _renderDropletMap() {
    const graphics = this._dropletMapGraphics;
    graphics.clear();
    
    const scale = 0.5;
    
    for (const drop of this._activeDroplets) {
      if (!drop.active || drop.merged) continue;
      
      const alpha = Math.min(1, drop.life / drop.maxLife);
      const x = drop.x * scale;
      const y = drop.y * scale;
      const r = drop.radius * scale;
      
      // Displacement gradient
      graphics.circle(x, y, r * 2);
      graphics.fill({ color: 0x808080, alpha: alpha * 0.6 });
      
      graphics.circle(x, y, r);
      graphics.fill({ color: 0xaaaaaa, alpha: alpha * 0.8 });
      
      // Trail displacement
      for (let i = 0; i < drop.trail.length; i++) {
        const t = drop.trail[i];
        const trailAlpha = (1 - i / drop.trail.length) * 0.25 * alpha;
        graphics.circle(t.x * scale, t.y * scale, t.r * scale);
        graphics.fill({ color: 0x808080, alpha: trailAlpha });
      }
    }
    
    this.renderer.render({
      container: graphics,
      target: this._dropletRenderTexture,
      clear: true
    });
  }
  
  _renderDroplets() {
    const graphics = this._dropletGraphics;
    graphics.clear();
    
    for (const drop of this._activeDroplets) {
      if (!drop.active || drop.merged) continue;
      
      const alpha = Math.min(1, drop.life / drop.maxLife);
      
      // Trail
      for (let i = drop.trail.length - 1; i >= 0; i--) {
        const t = drop.trail[i];
        const trailAlpha = (1 - i / drop.trail.length) * 0.12 * alpha;
        
        graphics.circle(t.x, t.y, t.r);
        graphics.fill({ color: 0xa8d5e5, alpha: trailAlpha });
      }
      
      // Droplet body
      graphics.circle(drop.x, drop.y, drop.radius);
      graphics.fill({ color: 0xa8d5e5, alpha: 0.15 * alpha });
      
      // Edge highlight
      graphics.circle(drop.x, drop.y, drop.radius);
      graphics.stroke({ color: 0xffffff, alpha: 0.35 * alpha, width: 1 });
      
      // Specular highlight
      const hlX = drop.x - drop.radius * 0.35;
      const hlY = drop.y - drop.radius * 0.35;
      graphics.circle(hlX, hlY, drop.radius * 0.25);
      graphics.fill({ color: 0xffffff, alpha: 0.6 * alpha });
    }
  }
  
  /**
   * Reset the effect - clears all droplets and restarts
   */
  reset() {
    this.stop();
    
    while (this._activeDroplets.length > 0) {
      this._despawnDroplet(this._activeDroplets[0]);
    }
    
    this._time = 0;
    this._lightningTimer = 0;
    this._lightningOverlay.alpha = 0;
    this.container.x = 0;
    this.container.y = 0;
    
    if (this._dropletGraphics) {
      this._dropletGraphics.clear();
    }
    
    this.start();
    
    return this;
  }
  
  /**
   * Cleanup all resources
   */
  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    
    this.stop();
    this._boundUpdate = null;
    
    // Remove interaction listeners
    if (this.options.enableInteraction) {
      this.container.off('pointermove', this._onPointerMove);
      this.container.off('pointerdown', this._onPointerDown);
    }
    
    // Destroy render texture
    if (this._dropletRenderTexture) {
      this._dropletRenderTexture.destroy(true);
    }
    
    // Destroy display objects
    for (const obj of this._displayObjects) {
      if (obj.parent) {
        obj.parent.removeChild(obj);
      }
      obj.destroy({ children: true });
    }
    this._displayObjects = [];
    
    // Clear pools
    this._dropletPool = [];
    this._activeDroplets = [];
    this._spatialGrid.clear();
  }
  
  // =========================================================================
  // UTILITY METHODS
  // =========================================================================
  
  _distance(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  }
  
  _distanceSquared(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return dx * dx + dy * dy;
  }
  
  _randomRange(min, max) {
    return min + Math.random() * (max - min);
  }
  
  // =========================================================================
  // GETTERS & SETTERS
  // =========================================================================
  
  get running() { return this._running; }
  get dropletCount() { return this._activeDroplets.length; }
  
  get spawnRate() { return this.options.spawnRate; }
  set spawnRate(value) { this.options.spawnRate = value; }
  
  get gravity() { return this.options.gravity; }
  set gravity(value) { this.options.gravity = value; }
  
  get refractionStrength() { return this.options.refractionStrength; }
  set refractionStrength(value) {
    this.options.refractionStrength = value;
    if (this._displacementFilter) {
      this._displacementFilter.scale.x = value * 100;
      this._displacementFilter.scale.y = value * 100;
    }
  }
  
  get blurAmount() { return this.options.blurAmount; }
  set blurAmount(value) {
    this.options.blurAmount = value;
    if (this._blurFilter) {
      this._blurFilter.strength = value / 10;
    }
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export { RainstormGlass, Raindrop, DEFAULTS };
export default RainstormGlass;
