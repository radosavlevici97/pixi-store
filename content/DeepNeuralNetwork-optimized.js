/**
 * DeepNeuralNetwork - OPTIMIZED VERSION
 * 
 * Performance improvements:
 * 1. Pre-rendered node glows to RenderTexture (was: 4000+ circles/frame → now: 120 sprites)
 * 2. Spatial hash grid for connections (was: O(n²) → now: O(n))
 * 3. Reduced particle count with larger particles (was: 500 → now: 150)
 * 4. Reduced ring count (was: 24 → now: 12)
 * 5. Batched graphics operations
 * 6. Visibility culling
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
  out vec2 vFilterCoord;

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
    vFilterCoord = vTextureCoord * uInputSize.xy / uOutputFrame.zw;
  }
`;

const DEPTH_FRAGMENT = `
  precision highp float;

  in vec2 vTextureCoord;
  in vec2 vFilterCoord;
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
// NEURAL NODE (Optimized - uses sprite instead of graphics)
// ============================================================================

class NeuralNode {
  constructor(ctx, config, textureCache) {
    this.classes = ctx.classes;
    this.config = config;
    this.textureCache = textureCache;
    
    // Single sprite instead of 5 graphics objects
    this.sprite = new this.classes.Sprite();
    this.sprite.anchor.set(0.5);
    
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
    
    // Get pre-rendered texture
    const baseTextureSize = 30; // Reference size for texture
    const cached = this.textureCache.getTexture(this.color, this.glowColor, baseTextureSize);
    this.sprite.texture = cached.texture;
    this._textureBaseSize = baseTextureSize;
    this._textureTotalSize = cached.size;
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
    
    // Update sprite (much faster than redrawing graphics)
    this.sprite.x = screenX;
    this.sprite.y = screenY;
    this.sprite.alpha = finalAlpha;
    
    // Scale sprite to match desired size
    const targetScale = (size / this._textureBaseSize);
    this.sprite.scale.set(targetScale);
    
    this.sprite.visible = finalAlpha > 0.01;
  }
  
  destroy() {
    this.sprite.destroy();
  }
}

// ============================================================================
// DEPTH PARTICLE (Optimized - batched data)
// ============================================================================

class ParticleSystem {
  constructor(ctx, config, count) {
    this.classes = ctx.classes;
    this.config = config;
    this.count = count;
    
    // Structure of Arrays for cache-friendly iteration
    this.x = new Float32Array(count);
    this.y = new Float32Array(count);
    this.z = new Float32Array(count);
    this.size = new Float32Array(count);
    this.speed = new Float32Array(count);
    this.brightness = new Float32Array(count);
    
    // Screen positions (calculated each frame)
    this.screenX = new Float32Array(count);
    this.screenY = new Float32Array(count);
    this.screenSize = new Float32Array(count);
    this.screenAlpha = new Float32Array(count);
    
    // Initialize
    for (let i = 0; i < count; i++) {
      this._resetParticle(i, true);
    }
    
    this.graphics = new this.classes.Graphics();
  }
  
  _resetParticle(i, initial = false) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 300 + Math.random() * 2000;
    
    this.x[i] = Math.cos(angle) * radius;
    this.y[i] = Math.sin(angle) * radius * 0.7;
    this.z[i] = initial ? 50 + Math.random() * this.config.farZ : this.config.farZ + Math.random() * 100;
    this.size[i] = 1 + Math.random() * 3; // Larger particles
    this.speed[i] = 0.3 + Math.random() * 1;
    this.brightness[i] = 0.3 + Math.random() * 0.7;
  }
  
  update(mouseOffsetX, mouseOffsetY, centerX, centerY) {
    const fov = this.config.fov;
    const fadeFarZ = this.config.fadeFarZ;
    const farZ = this.config.farZ;
    
    for (let i = 0; i < this.count; i++) {
      this.z[i] -= this.speed[i];
      
      if (this.z[i] < 30) {
        this._resetParticle(i);
      }
      
      const scale = fov / (this.z[i] + fov);
      const parallax = Math.pow(scale, 1.3) * 80;
      
      this.screenX[i] = centerX + this.x[i] * scale + mouseOffsetX * parallax;
      this.screenY[i] = centerY + this.y[i] * scale + mouseOffsetY * parallax;
      this.screenSize[i] = this.size[i] * scale;
      
      let alpha = this.brightness[i];
      if (this.z[i] < 100) {
        alpha *= this.z[i] / 100;
      }
      if (this.z[i] > fadeFarZ) {
        alpha *= 1 - (this.z[i] - fadeFarZ) / (farZ - fadeFarZ);
      }
      this.screenAlpha[i] = Math.max(0, alpha * scale * 2);
    }
  }
  
  draw() {
    this.graphics.clear();
    
    for (let i = 0; i < this.count; i++) {
      const alpha = this.screenAlpha[i];
      if (alpha > 0.01) {
        const x = this.screenX[i];
        const y = this.screenY[i];
        const size = this.screenSize[i];
        
        // Single circle with glow color (reduced from 2 circles per particle)
        this.graphics
          .circle(x, y, size * 2)
          .fill({ color: 0x4488FF, alpha: alpha * 0.5 });
      }
    }
  }
  
  destroy() {
    this.graphics.destroy();
  }
}

// ============================================================================
// RING SYSTEM (Optimized - reduced count)
// ============================================================================

class RingSystem {
  constructor(ctx, config, count) {
    this.classes = ctx.classes;
    this.config = config;
    this.count = count;
    
    this.z = new Float32Array(count);
    this.baseRadius = new Float32Array(count);
    this.rotationSpeed = new Float32Array(count);
    
    this.screenX = new Float32Array(count);
    this.screenY = new Float32Array(count);
    this.screenRadius = new Float32Array(count);
    this.screenAlpha = new Float32Array(count);
    
    const step = (config.farZ - 150) / count;
    for (let i = 0; i < count; i++) {
      this.z[i] = 150 + i * step;
      this.baseRadius[i] = 600 + Math.random() * 400;
      this.rotationSpeed[i] = (Math.random() - 0.5) * 0.005;
    }
    
    this.graphics = new this.classes.Graphics();
  }
  
  update(time, mouseOffsetX, mouseOffsetY, centerX, centerY) {
    const fov = this.config.fov;
    const fadeFarZ = this.config.fadeFarZ;
    const farZ = this.config.farZ;
    
    for (let i = 0; i < this.count; i++) {
      this.z[i] -= 0.5;
      
      if (this.z[i] < 50) {
        this.z[i] = farZ;
      }
      
      const scale = fov / (this.z[i] + fov);
      const parallax = Math.pow(scale, 1.2) * 60;
      
      this.screenX[i] = centerX + mouseOffsetX * parallax;
      this.screenY[i] = centerY + mouseOffsetY * parallax;
      this.screenRadius[i] = this.baseRadius[i] * scale;
      
      let alpha = 0.15;
      if (this.z[i] < 150) alpha *= this.z[i] / 150;
      if (this.z[i] > fadeFarZ) {
        alpha *= 1 - (this.z[i] - fadeFarZ) / (farZ - fadeFarZ);
      }
      this.screenAlpha[i] = Math.max(0, alpha);
    }
  }
  
  draw() {
    this.graphics.clear();
    
    for (let i = 0; i < this.count; i++) {
      const alpha = this.screenAlpha[i];
      const radius = this.screenRadius[i];
      
      if (alpha > 0.01 && radius > 10) {
        const x = this.screenX[i];
        const y = this.screenY[i];
        
        // Single ring (reduced from 2)
        this.graphics
          .circle(x, y, radius)
          .stroke({ width: 2, color: 0x2a5a8c, alpha: alpha * 0.6 });
      }
    }
  }
  
  destroy() {
    this.graphics.destroy();
  }
}

// ============================================================================
// DEEP NEURAL NETWORK (Main Class - Optimized)
// ============================================================================

class DeepNeuralNetwork {
  static defaults = {
    numNodes: CONFIG.numNodes,
    numParticles: CONFIG.numParticles,
    numRings: CONFIG.numRings,
    autoStart: true,
    showCursor: true,
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
    
    this._screenWidth = this.app.screen.width;
    this._screenHeight = this.app.screen.height;
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
    // Create depth filter
    const glProgram = this.classes.GlProgram.from({
      vertex: DEPTH_VERTEX,
      fragment: DEPTH_FRAGMENT,
    });
    
    this._depthFilter = new this.classes.Filter({
      glProgram,
      resources: {
        depthUniforms: {
          uTime: { value: 0, type: 'f32' },
          uMouse: { value: new Float32Array([0.5, 0.5]), type: 'vec2<f32>' },
        },
      },
    });
    
    this.container.filters = [this._depthFilter];
    
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
    this.container.addChild(this._connectionGraphics);
    
    // Node container
    this._nodeContainer = new this.classes.Container();
    this.container.addChild(this._nodeContainer);
    
    // Create nodes with cached textures
    this._nodes = [];
    for (let i = 0; i < this.options.numNodes; i++) {
      const node = new NeuralNode(this.ctx, CONFIG, this._textureCache);
      this._nodes.push(node);
      this._nodeContainer.addChild(node.sprite);
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
    
    // Update shader
    this._depthFilter.resources.depthUniforms.uniforms.uTime = this._time;
    this._depthFilter.resources.depthUniforms.uniforms.uMouse[0] = this._mouseX / this._screenWidth;
    this._depthFilter.resources.depthUniforms.uniforms.uMouse[1] = this._mouseY / this._screenHeight;
    
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
      this._nodeContainer.setChildIndex(this._nodes[i].sprite, i);
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
    this._depthFilter.destroy();
    
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
