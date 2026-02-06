/**
 * DeepNeuralNetwork - OPTIMIZED VERSION
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  farZ: 2500,
  nearZ: 30,
  fadeNearZ: 120,
  fadeFarZ: 2000,
  fov: 350,
  spawnRadius: 3000,
  parallaxStrength: 200,
  nodeSpeed: 1.2,
  numNodes: 120,
  numParticles: 150,        // Reduced from 500
  connectionMaxDist: 350,
  spatialCellSize: 400,     // For spatial hashing
  numRings: 12,             // Reduced from 24
};

const COLORS = [
  { main: 0x00D4FF, glow: 0x0066AA },
  { main: 0x00FFAA, glow: 0x00AA66 },
  { main: 0xFF00AA, glow: 0xAA0066 },
  { main: 0xAA88FF, glow: 0x6644AA },
  { main: 0x00AAFF, glow: 0x0055AA },
  { main: 0xFF6600, glow: 0xAA4400 },
  { main: 0xFFFF00, glow: 0xAAAA00 },
];

// ============================================================================
// DEPTH SHADER (PixiJS v8 GLSL ES 3.0)
// ============================================================================

const DEPTH_VERTEX = `
  in vec2 aPosition;
  out vec2 vTextureCoord;

  uniform vec4 uInputSize;
  uniform vec4 uOutputFrame;
  uniform vec4 uOutputTexture;

  vec4 filterVertexPosition(void) {
    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0 / uOutputTexture.y * uOutputTexture.z) - 1.0;
    return vec4(position, 0.0, 1.0);
  }

  vec2 filterTextureCoord(void) {
    return aPosition * (uOutputFrame.zw * uInputSize.zw);
  }

  void main(void) {
    gl_Position = filterVertexPosition();
    vTextureCoord = filterTextureCoord();
  }
`;

const DEPTH_FRAGMENT = `
  precision highp float;

  in vec2 vTextureCoord;
  out vec4 finalColor;

  uniform sampler2D uTexture;
  uniform float uTime;
  uniform vec2 uMouse;

  void main() {
    vec2 uv = vTextureCoord;
    vec2 center = vec2(0.5);
    float dist = distance(uv, center);
    
    float aberration = dist * 0.012;
    
    float r = texture(uTexture, uv + vec2(aberration * 0.8, aberration * 0.2)).r;
    float g = texture(uTexture, uv).g;
    float b = texture(uTexture, uv - vec2(aberration * 0.5, -aberration * 0.3)).b;
    
    float vignette = 1.0 - pow(dist * 1.3, 2.0);
    vignette = max(0.0, vignette);
    
    vec3 color = vec3(r, g, b) * vignette;
    
    vec3 fogColor = vec3(0.0, 0.05, 0.12);
    color = mix(fogColor, color, vignette * 0.9 + 0.1);
    
    float centerGlow = 1.0 - smoothstep(0.0, 0.5, dist);
    color += vec3(0.02, 0.04, 0.08) * centerGlow;
    
    finalColor = vec4(color, 1.0);
  }
`;

// ============================================================================
// SPATIAL HASH (O(1) neighbor lookup)
// ============================================================================

class SpatialHash {
  constructor(cellSize) {
    this.cellSize = cellSize;
    this.cells = new Map();
  }
  
  clear() {
    this.cells.clear();
  }
  
  _key(x, y) {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    return `${cx},${cy}`;
  }
  
  insert(node) {
    const key = this._key(node.screenX, node.screenY);
    if (!this.cells.has(key)) {
      this.cells.set(key, []);
    }
    this.cells.get(key).push(node);
  }
  
  getNearby(x, y) {
    const results = [];
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    
    // Check 3x3 grid of cells
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const key = `${cx + dx},${cy + dy}`;
        const cell = this.cells.get(key);
        if (cell) {
          for (let i = 0; i < cell.length; i++) {
            results.push(cell[i]);
          }
        }
      }
    }
    return results;
  }
}

// ============================================================================
// NODE TEXTURE CACHE (Pre-rendered glows)
// ============================================================================

class NodeTextureCache {
  constructor(ctx) {
    this.classes = ctx.classes;
    this.renderer = ctx.renderer;
    this.cache = new Map();
  }
  
  getTexture(color, glowColor, size) {
    const key = `${color}-${glowColor}-${Math.round(size)}`;
    
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }
    
    // Create texture with padding for glow
    const padding = size * 4;
    const textureSize = size + padding * 2;
    
    const graphics = new this.classes.Graphics();
    const center = textureSize / 2;
    
    // Draw glow layers (same visual as before, but only once)
    const glowLayers = 8; // Reduced from 12 for texture
    for (let i = glowLayers; i >= 0; i--) {
      const t = i / glowLayers;
      const radius = size * (1 + t * 4);
      const alpha = 0.02 * (1 - t) * (1 - t);
      graphics.circle(center, center, radius).fill({ color: glowColor, alpha });
    }
    
    const innerLayers = 6; // Reduced from 8
    for (let i = innerLayers; i >= 0; i--) {
      const t = i / innerLayers;
      const radius = size * (0.5 + t * 1.2);
      const alpha = 0.08 * (1 - t);
      graphics.circle(center, center, radius).fill({ color: color, alpha });
    }
    
    const coreLayers = 4; // Reduced from 6
    for (let i = coreLayers; i >= 0; i--) {
      const t = i / coreLayers;
      const radius = size * (0.3 + t * 0.7);
      const alpha = 0.15 + 0.6 * (1 - t);
      graphics.circle(center, center, radius).fill({ color: color, alpha });
    }
    
    const centerLayers = 3; // Reduced from 4
    for (let i = centerLayers; i >= 0; i--) {
      const t = i / centerLayers;
      const radius = size * (0.15 + t * 0.25);
      const alpha = 0.5 + 0.5 * (1 - t);
      graphics.circle(center, center, radius).fill({ color: 0xFFFFFF, alpha });
    }
    
    // Render to texture
    const renderTexture = this.classes.RenderTexture.create({
      width: textureSize,
      height: textureSize,
      resolution: 1,
    });
    
    this.renderer.render({ container: graphics, target: renderTexture });
    graphics.destroy();
    
    this.cache.set(key, { texture: renderTexture, size: textureSize });
    return this.cache.get(key);
  }
  
  destroy() {
    for (const { texture } of this.cache.values()) {
      texture.destroy(true);
    }
    this.cache.clear();
  }
}

// ============================================================================
// NEURAL NODE (Using pre-built graphics layers like bioluminescent-ocean)
// ============================================================================

class NeuralNode {
  constructor(ctx, config, textureCache) {
    this.classes = ctx.classes;
    this.config = config;
    this.textureCache = textureCache;

    // Create container to hold all glow layers
    this.container = new this.classes.Container();
    this.container.blendMode = 'add';

    // Pre-create static glow layers (instead of redrawing each frame)
    // This matches the pattern used in bioluminescent-ocean
    this._glowLayers = [];
    this._createGlowLayers();

    this.x3d = 0;
    this.y3d = 0;
    this.z3d = 0;
    this.screenX = 0;
    this.screenY = 0;
    this.screenScale = 0;
    this.screenAlpha = 0;
    this.currentSize = 0;

    this.reset(true);
  }

  _createGlowLayers() {
    // Create 5 glow layers from outer to inner (similar to working demo)
    // Each layer is a separate Graphics object for proper blending
    // Use WHITE base color so tint works correctly (tint multiplies color)

    // Outer glow (largest, most transparent)
    const glowOuter = new this.classes.Graphics();
    glowOuter.circle(0, 0, 50);
    glowOuter.fill({ color: 0xFFFFFF, alpha: 0.03 });
    this._glowLayers.push(glowOuter);
    this.container.addChild(glowOuter);

    // Mid glow
    const glowMid = new this.classes.Graphics();
    glowMid.circle(0, 0, 35);
    glowMid.fill({ color: 0xFFFFFF, alpha: 0.05 });
    this._glowLayers.push(glowMid);
    this.container.addChild(glowMid);

    // Inner glow
    const glowInner = new this.classes.Graphics();
    glowInner.circle(0, 0, 20);
    glowInner.fill({ color: 0xFFFFFF, alpha: 0.12 });
    this._glowLayers.push(glowInner);
    this.container.addChild(glowInner);

    // Core
    const core = new this.classes.Graphics();
    core.circle(0, 0, 10);
    core.fill({ color: 0xFFFFFF, alpha: 0.6 });
    this._glowLayers.push(core);
    this.container.addChild(core);

    // Center (brightest) - stays white
    const center = new this.classes.Graphics();
    center.circle(0, 0, 4);
    center.fill({ color: 0xFFFFFF, alpha: 0.9 });
    this._glowLayers.push(center);
    this.container.addChild(center);
  }

  _updateGlowColors() {
    // Update glow layer colors based on node's color scheme
    // Tint multiplies the base color (white), so we get the exact color we want
    if (this._glowLayers.length >= 5) {
      this._glowLayers[0].tint = this.glowColor;
      this._glowLayers[1].tint = this.glowColor;
      this._glowLayers[2].tint = this.color;
      this._glowLayers[3].tint = this.color;
      // Keep center white (no tint)
    }
  }

  reset(initial = false) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 300 + Math.random() * this.config.spawnRadius;

    this.x3d = Math.cos(angle) * radius * 0.9;
    this.y3d = Math.sin(angle) * radius * 0.7;

    if (initial) {
      const depthRange = this.config.farZ - this.config.nearZ;
      this.z3d = this.config.nearZ + Math.random() * depthRange;
    } else {
      this.z3d = this.config.farZ + Math.random() * 300;
    }

    this.baseSize = 15 + Math.random() * 50;
    const colorSet = COLORS[Math.floor(Math.random() * COLORS.length)];
    this.color = colorSet.main;
    this.glowColor = colorSet.glow;
    this.pulsePhase = Math.random() * Math.PI * 2;
    this.pulseSpeed = 0.6 + Math.random() * 2;
    this.speed = this.config.nodeSpeed * (0.5 + Math.random() * 0.8);
    this.driftX = (Math.random() - 0.5) * 0.4;
    this.driftY = (Math.random() - 0.5) * 0.4;

    // Apply color tints
    this._updateGlowColors();
  }

  getDepthAlpha() {
    let alpha = 1;

    if (this.z3d < this.config.fadeNearZ) {
      alpha = Math.max(0, this.z3d / this.config.fadeNearZ);
      alpha = alpha * alpha;
    }

    if (this.z3d > this.config.fadeFarZ) {
      alpha = Math.min(1, 1 - (this.z3d - this.config.fadeFarZ) / (this.config.farZ - this.config.fadeFarZ));
      alpha = Math.max(0, alpha);
    }

    return alpha;
  }

  getEdgeAlpha(screenX, screenY, screenWidth, screenHeight) {
    const marginX = screenWidth * 0.15;
    const marginY = screenHeight * 0.15;

    let alpha = 1;

    if (screenX < marginX) {
      alpha *= screenX / marginX;
    } else if (screenX > screenWidth - marginX) {
      alpha *= (screenWidth - screenX) / marginX;
    }

    if (screenY < marginY) {
      alpha *= screenY / marginY;
    } else if (screenY > screenHeight - marginY) {
      alpha *= (screenHeight - screenY) / marginY;
    }

    return Math.max(0, Math.min(1, alpha));
  }

  update(time, mouseOffsetX, mouseOffsetY, centerX, centerY, screenWidth, screenHeight) {
    this.z3d -= this.speed;
    this.x3d += this.driftX;
    this.y3d += this.driftY;

    if (this.z3d < 20) {
      this.reset();
    }

    const scale = this.config.fov / (this.z3d + this.config.fov);
    const parallaxFactor = Math.pow(scale, 1.5) * this.config.parallaxStrength;

    const screenX = centerX + this.x3d * scale + mouseOffsetX * parallaxFactor;
    const screenY = centerY + this.y3d * scale + mouseOffsetY * parallaxFactor;

    const depthAlpha = this.getDepthAlpha();
    const edgeAlpha = this.getEdgeAlpha(screenX, screenY, screenWidth, screenHeight);
    const finalAlpha = depthAlpha * edgeAlpha;

    const pulse = Math.sin(time * this.pulseSpeed + this.pulsePhase) * 0.25 + 1;
    const size = this.baseSize * scale * pulse;

    this.screenX = screenX;
    this.screenY = screenY;
    this.screenScale = scale;
    this.screenAlpha = finalAlpha;
    this.currentSize = size;

    // Update container transform properties (like bioluminescent-ocean pattern)
    this.container.x = screenX;
    this.container.y = screenY;
    this.container.alpha = finalAlpha;
    this.container.visible = finalAlpha > 0.01;

    // Scale the container instead of redrawing
    // Base graphics are sized for scale=1, so we apply the dynamic scale here
    const scaleMultiplier = size / 25; // 25 is our base size (center layer is 4, outer is 50)
    this.container.scale.set(scaleMultiplier);
  }

  destroy() {
    for (const layer of this._glowLayers) {
      layer.destroy();
    }
    this._glowLayers = [];
    this.container.destroy();
  }
}

// ============================================================================
// DEPTH PARTICLE (Using pre-built graphics like bioluminescent-ocean)
// ============================================================================

class ParticleSystem {
  constructor(ctx, config, count) {
    this.classes = ctx.classes;
    this.config = config;
    this.count = count;

    // Container to hold all particle graphics
    this.container = new this.classes.Container();

    // Pre-create all particles as individual graphics (like bioluminescent-ocean)
    this._particles = [];
    for (let i = 0; i < count; i++) {
      const p = new this.classes.Graphics();
      // Draw a small glowing circle at origin
      p.circle(0, 0, 4);
      p.fill({ color: 0x4488FF, alpha: 0.6 });
      p.blendMode = 'add';

      // Store particle data on the graphics object
      p._x3d = 0;
      p._y3d = 0;
      p._z3d = 0;
      p._baseSize = 1 + Math.random() * 3;
      p._speed = 0.3 + Math.random() * 1;
      p._brightness = 0.3 + Math.random() * 0.7;

      this._resetParticle(p, true);
      this._particles.push(p);
      this.container.addChild(p);
    }

    // Expose container as graphics for backward compatibility with _setup
    this.graphics = this.container;
  }

  _resetParticle(p, initial = false) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 300 + Math.random() * 2000;

    p._x3d = Math.cos(angle) * radius;
    p._y3d = Math.sin(angle) * radius * 0.7;
    p._z3d = initial ? 50 + Math.random() * this.config.farZ : this.config.farZ + Math.random() * 100;
  }

  update(mouseOffsetX, mouseOffsetY, centerX, centerY) {
    const fov = this.config.fov;
    const fadeFarZ = this.config.fadeFarZ;
    const farZ = this.config.farZ;

    for (const p of this._particles) {
      p._z3d -= p._speed;

      if (p._z3d < 30) {
        this._resetParticle(p, false);
      }

      const scale = fov / (p._z3d + fov);
      const parallax = Math.pow(scale, 1.3) * 80;

      // Update position via transform
      p.x = centerX + p._x3d * scale + mouseOffsetX * parallax;
      p.y = centerY + p._y3d * scale + mouseOffsetY * parallax;

      // Update scale
      p.scale.set(p._baseSize * scale);

      // Calculate alpha
      let alpha = p._brightness;
      if (p._z3d < 100) {
        alpha *= p._z3d / 100;
      }
      if (p._z3d > fadeFarZ) {
        alpha *= 1 - (p._z3d - fadeFarZ) / (farZ - fadeFarZ);
      }
      p.alpha = Math.max(0, alpha * scale * 2);
      p.visible = p.alpha > 0.01;
    }
  }

  draw() {
    // No-op: particles are updated via transforms in update()
  }

  destroy() {
    for (const p of this._particles) {
      p.destroy();
    }
    this._particles = [];
    this.container.destroy();
  }
}

// ============================================================================
// RING SYSTEM (Using pre-built graphics)
// ============================================================================

class RingSystem {
  constructor(ctx, config, count) {
    this.classes = ctx.classes;
    this.config = config;
    this.count = count;

    // Container for all rings
    this.container = new this.classes.Container();

    // Pre-create all rings as individual graphics
    this._rings = [];
    const step = (config.farZ - 150) / count;

    for (let i = 0; i < count; i++) {
      const ring = new this.classes.Graphics();
      // Draw ring at origin with base radius of 100 (will be scaled)
      ring.circle(0, 0, 100);
      ring.stroke({ width: 2, color: 0x2a5a8c, alpha: 0.6 });
      ring.blendMode = 'add';

      // Store ring data
      ring._z3d = 150 + i * step;
      ring._baseRadius = 600 + Math.random() * 400;

      this._rings.push(ring);
      this.container.addChild(ring);
    }

    // Expose container as graphics for backward compatibility
    this.graphics = this.container;
  }

  update(time, mouseOffsetX, mouseOffsetY, centerX, centerY) {
    const fov = this.config.fov;
    const fadeFarZ = this.config.fadeFarZ;
    const farZ = this.config.farZ;

    for (const ring of this._rings) {
      ring._z3d -= 0.5;

      if (ring._z3d < 50) {
        ring._z3d = farZ;
      }

      const scale = fov / (ring._z3d + fov);
      const parallax = Math.pow(scale, 1.2) * 60;

      // Update position
      ring.x = centerX + mouseOffsetX * parallax;
      ring.y = centerY + mouseOffsetY * parallax;

      // Update scale (base radius is 100, so scale to desired radius)
      const screenRadius = ring._baseRadius * scale;
      ring.scale.set(screenRadius / 100);

      // Calculate alpha
      let alpha = 0.15;
      if (ring._z3d < 150) alpha *= ring._z3d / 150;
      if (ring._z3d > fadeFarZ) {
        alpha *= 1 - (ring._z3d - fadeFarZ) / (farZ - fadeFarZ);
      }
      ring.alpha = Math.max(0, alpha);
      ring.visible = ring.alpha > 0.01 && screenRadius > 10;
    }
  }

  draw() {
    // No-op: rings are updated via transforms in update()
  }

  destroy() {
    for (const ring of this._rings) {
      ring.destroy();
    }
    this._rings = [];
    this.container.destroy();
  }
}

// ============================================================================
// DEEP NEURAL NETWORK (Main Class - Optimized)
// ============================================================================

class DeepNeuralNetwork {
  static defaults = {
    width: 800,
    height: 600,
    numNodes: CONFIG.numNodes,
    numParticles: CONFIG.numParticles,
    numRings: CONFIG.numRings,
    autoStart: true,
    showCursor: false, // Default to false for demo compatibility
  };
  
  constructor(ctx, options = {}) {
    if (!ctx?.classes) throw new Error('DeepNeuralNetwork: ctx.classes required');
    if (!ctx?.ticker) throw new Error('DeepNeuralNetwork: ctx.ticker required');
    if (!options.container) throw new Error('DeepNeuralNetwork: options.container required');
    
    this.ticker = ctx.ticker;
    this.classes = ctx.classes;
    this.app = ctx.app;
    this.renderer = ctx.renderer;
    this.ctx = ctx;
    
    this.options = { ...DeepNeuralNetwork.defaults, ...options };
    this.container = this.options.container;
    
    this._destroyed = false;
    this._running = false;
    this._time = 0;

    // Use passed dimensions (options) rather than app.screen for consistency
    this._screenWidth = this.options.width || this.app.screen.width;
    this._screenHeight = this.options.height || this.app.screen.height;
    this._centerX = this._screenWidth / 2;
    this._centerY = this._screenHeight / 2;
    
    this._mouseX = this._centerX;
    this._mouseY = this._centerY;
    this._targetMouseX = this._centerX;
    this._targetMouseY = this._centerY;
    
    this._boundUpdate = this._update.bind(this);
    this._boundMouseMove = this._onMouseMove.bind(this);
    this._boundTouchMove = this._onTouchMove.bind(this);
    this._boundResize = this._onResize.bind(this);
    
    // Spatial hash for O(1) neighbor lookup
    this._spatialHash = new SpatialHash(CONFIG.spatialCellSize);
    
    this._setup();
    
    if (this.options.autoStart) {
      this.start();
    }
  }
  
  _setup() {
    // NOTE: Depth filter disabled for now - it may cause rendering issues in some environments
    // The component works perfectly without it (just no vignette/chromatic aberration post-effect)
    this._depthFilter = null;

    // Texture cache for pre-rendered node glows
    this._textureCache = new NodeTextureCache(this.ctx);
    
    // Ring system (optimized)
    this._ringSystem = new RingSystem(this.ctx, CONFIG, this.options.numRings);
    this.container.addChild(this._ringSystem.graphics);
    
    // Particle system (optimized with TypedArrays)
    this._particleSystem = new ParticleSystem(this.ctx, CONFIG, this.options.numParticles);
    this.container.addChild(this._particleSystem.graphics);
    
    // Connection graphics (single batched graphics)
    this._connectionGraphics = new this.classes.Graphics();
    this._connectionGraphics.blendMode = 'add'; // Additive blending for glow effect
    this.container.addChild(this._connectionGraphics);
    
    // Node container (nodes have their own blendMode set)
    this._nodeContainer = new this.classes.Container();
    this.container.addChild(this._nodeContainer);
    
    // Create nodes (using direct graphics rendering)
    this._nodes = [];
    for (let i = 0; i < this.options.numNodes; i++) {
      const node = new NeuralNode(this.ctx, CONFIG, this._textureCache);
      this._nodes.push(node);
      this._nodeContainer.addChild(node.container);
    }
    
    // Cursor
    this._cursorGraphics = new this.classes.Graphics();
    if (this.options.showCursor) {
      this.container.addChild(this._cursorGraphics);
    }
    
    window.addEventListener('mousemove', this._boundMouseMove);
    window.addEventListener('touchmove', this._boundTouchMove, { passive: false });
    window.addEventListener('resize', this._boundResize);
  }
  
  _onMouseMove(e) {
    this._targetMouseX = e.clientX;
    this._targetMouseY = e.clientY;
  }

  _onTouchMove(e) {
    e.preventDefault();
    this._targetMouseX = e.touches[0].clientX;
    this._targetMouseY = e.touches[0].clientY;
  }

  /**
   * Set mouse position for interactive response (used by demoRunner)
   * @param {number} x - X position in component coordinates
   * @param {number} y - Y position in component coordinates
   * @param {number} [influence=1] - Influence strength (unused, for API compatibility)
   */
  setMousePosition(x, y, influence = 1) {
    this._targetMouseX = x;
    this._targetMouseY = y;
    return this;
  }
  
  _onResize() {
    this._screenWidth = this.app.screen.width;
    this._screenHeight = this.app.screen.height;
    this._centerX = this._screenWidth / 2;
    this._centerY = this._screenHeight / 2;
  }
  
  _update(ticker) {
    if (this._destroyed || !this._running) return;
    
    this._time += 0.016 * ticker.deltaTime;
    
    this._mouseX += (this._targetMouseX - this._mouseX) * 0.06;
    this._mouseY += (this._targetMouseY - this._mouseY) * 0.06;
    
    const mouseOffsetX = (this._mouseX - this._centerX) / this._centerX;
    const mouseOffsetY = (this._mouseY - this._centerY) / this._centerY;
    
    // Update shader (if available)
    if (this._depthFilter) {
      this._depthFilter.resources.depthUniforms.uniforms.uTime = this._time;
      this._depthFilter.resources.depthUniforms.uniforms.uMouse[0] = this._mouseX / this._screenWidth;
      this._depthFilter.resources.depthUniforms.uniforms.uMouse[1] = this._mouseY / this._screenHeight;
    }
    
    // Update and draw rings
    this._ringSystem.update(this._time, mouseOffsetX, mouseOffsetY, this._centerX, this._centerY);
    this._ringSystem.draw();
    
    // Update and draw particles
    this._particleSystem.update(mouseOffsetX, mouseOffsetY, this._centerX, this._centerY);
    this._particleSystem.draw();
    
    // Update nodes and rebuild spatial hash
    this._spatialHash.clear();
    for (const node of this._nodes) {
      node.update(this._time, mouseOffsetX, mouseOffsetY, this._centerX, this._centerY, this._screenWidth, this._screenHeight);
      if (node.screenAlpha > 0.05) {
        this._spatialHash.insert(node);
      }
    }
    
    // Sort nodes by Z (only for rendering order)
    this._nodes.sort((a, b) => b.z3d - a.z3d);
    for (let i = 0; i < this._nodes.length; i++) {
      this._nodeContainer.setChildIndex(this._nodes[i].container, i);
    }
    
    // Draw connections using spatial hash
    this._drawConnections();
    
    // Draw cursor
    if (this.options.showCursor) {
      this._drawCursor();
    }
  }
  
  _drawConnections() {
    this._connectionGraphics.clear();
    
    const maxDist = CONFIG.connectionMaxDist;
    const maxDistSq = maxDist * maxDist;
    const processed = new Set();
    
    for (let i = 0; i < this._nodes.length; i++) {
      const nodeA = this._nodes[i];
      if (nodeA.screenAlpha < 0.05) continue;
      
      // Get nearby nodes from spatial hash (O(1) instead of O(n))
      const nearby = this._spatialHash.getNearby(nodeA.screenX, nodeA.screenY);
      
      for (let j = 0; j < nearby.length; j++) {
        const nodeB = nearby[j];
        if (nodeA === nodeB) continue;
        
        // Avoid duplicate connections
        const pairKey = nodeA.z3d < nodeB.z3d ? `${i}-${this._nodes.indexOf(nodeB)}` : `${this._nodes.indexOf(nodeB)}-${i}`;
        if (processed.has(pairKey)) continue;
        processed.add(pairKey);
        
        const dx = nodeB.screenX - nodeA.screenX;
        const dy = nodeB.screenY - nodeA.screenY;
        const distSq = dx * dx + dy * dy;
        const dz = Math.abs(nodeA.z3d - nodeB.z3d);
        
        if (distSq < maxDistSq && dz < 500) {
          const dist = Math.sqrt(distSq);
          const distAlpha = 1 - dist / maxDist;
          const zAlpha = 1 - dz / 500;
          const combinedAlpha = distAlpha * zAlpha * 0.85;
          const avgAlpha = (nodeA.screenAlpha + nodeB.screenAlpha) / 2;
          const finalAlpha = combinedAlpha * avgAlpha;
          
          if (finalAlpha < 0.02) continue;
          
          const avgScale = (nodeA.screenScale + nodeB.screenScale) / 2;
          const lineWidth = Math.max(1, avgScale * 5);
          
          // Single line with glow (reduced from 3 lines)
          this._connectionGraphics
            .moveTo(nodeA.screenX, nodeA.screenY)
            .lineTo(nodeB.screenX, nodeB.screenY)
            .stroke({ width: lineWidth * 1.5, color: nodeA.color, alpha: finalAlpha * 0.6 });
          
          // Data pulse (only for strong connections)
          if (finalAlpha > 0.15) {
            const pulseSpeed = 2 + (i + j) % 3;
            const pulsePos = (Math.sin(this._time * pulseSpeed + i * 0.7 + j * 0.3) + 1) / 2;
            const pulseX = nodeA.screenX + dx * pulsePos;
            const pulseY = nodeA.screenY + dy * pulsePos;
            
            this._connectionGraphics
              .circle(pulseX, pulseY, 2 + avgScale * 4)
              .fill({ color: 0xFFFFFF, alpha: finalAlpha });
          }
        }
      }
    }
  }
  
  _drawCursor() {
    this._cursorGraphics.clear();
    this._cursorGraphics.x = this._mouseX;
    this._cursorGraphics.y = this._mouseY;
    
    const pulse = Math.sin(this._time * 3) * 0.2 + 1;
    
    this._cursorGraphics
      .circle(0, 0, 12 * pulse)
      .stroke({ width: 1.5, color: 0x00D4FF, alpha: 0.7 });
    
    this._cursorGraphics
      .circle(0, 0, 22 * pulse)
      .stroke({ width: 1, color: 0x00D4FF, alpha: 0.3 });
    
    this._cursorGraphics
      .circle(0, 0, 3)
      .fill({ color: 0x00D4FF, alpha: 0.5 });
  }
  
  start() {
    if (this._destroyed || this._running) return this;
    this._running = true;
    this.ticker.add(this._boundUpdate);
    return this;
  }
  
  stop() {
    if (!this._running) return this;
    this._running = false;
    this.ticker.remove(this._boundUpdate);
    return this;
  }
  
  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    
    this.stop();
    
    window.removeEventListener('mousemove', this._boundMouseMove);
    window.removeEventListener('touchmove', this._boundTouchMove);
    window.removeEventListener('resize', this._boundResize);
    
    for (const node of this._nodes) {
      node.destroy();
    }
    this._nodes = [];
    
    this._textureCache.destroy();
    this._particleSystem.destroy();
    this._ringSystem.destroy();
    this._connectionGraphics.destroy();
    this._cursorGraphics.destroy();
    this._nodeContainer.destroy();
    
    this.container.filters = null;
    if (this._depthFilter) {
      this._depthFilter.destroy();
    }
    
    this._boundUpdate = null;
    this._boundMouseMove = null;
    this._boundTouchMove = null;
    this._boundResize = null;
  }
}

// ============================================================================
// PIXI CONTEXT FACTORY
// ============================================================================

function createPixiContext(pixiModule, gsapModule, app, config = {}) {
  if (!pixiModule) {
    throw new Error('PixiContext: pixiModule is required');
  }
  if (!app?.stage) {
    throw new Error('PixiContext: app with stage is required');
  }

  const { gsap, PixiPlugin } = gsapModule || {};
  if (gsap && PixiPlugin && !gsap.plugins?.pixi) {
    gsap.registerPlugin(PixiPlugin);
    PixiPlugin.registerPIXI(pixiModule);
  }

  return Object.freeze({
    app,
    stage: app.stage,
    ticker: config.ticker ?? app.ticker,
    renderer: app.renderer,
    gsap: gsap || null,
    classes: Object.freeze({
      Container: config.Container ?? pixiModule.Container,
      Graphics: config.Graphics ?? pixiModule.Graphics,
      Sprite: config.Sprite ?? pixiModule.Sprite,
      Text: config.Text ?? pixiModule.Text,
      Point: config.Point ?? pixiModule.Point,
      Rectangle: config.Rectangle ?? pixiModule.Rectangle,
      Filter: config.Filter ?? pixiModule.Filter,
      GlProgram: config.GlProgram ?? pixiModule.GlProgram,
      RenderTexture: config.RenderTexture ?? pixiModule.RenderTexture,
    }),
    create: Object.freeze({
      container: () => new (config.Container ?? pixiModule.Container)(),
      graphics: () => new (config.Graphics ?? pixiModule.Graphics)(),
      point: (x = 0, y = 0) => new (config.Point ?? pixiModule.Point)(x, y),
    }),
  });
}

// ============================================================================
// EXPORTS
// ============================================================================

export { DeepNeuralNetwork, createPixiContext, CONFIG, COLORS };
export default DeepNeuralNetwork;
