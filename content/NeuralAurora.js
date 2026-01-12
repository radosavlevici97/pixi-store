/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * NEURAL AURORA - Competition-Winning PixiJS v8 Visualization
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * A stunning visualization where thoughts manifest as aurora borealis.
 * Synapses fire as ribbons of light weave across a dark mental landscape.
 * Ideas emerge as glowing orbs that drift upward, connecting via luminous threads.
 * 
 * Components:
 *   1. AuroraRibbon - Flowing sine-wave aurora ribbons with gradient colors
 *   2. NeuralNetwork - Interconnected nodes with pulsing energy connections
 *   3. ThoughtParticles - Rising thought orbs with trail effects
 *   4. SynapticSparks - Ambient particle system for synaptic activity
 *   5. NeuralAuroraScene - Master orchestrator combining all components
 * 
 * Theme Palette:
 *   - Deep Mental Black: #0d0d1a
 *   - Aurora Green: #00ff87
 *   - Thought Magenta: #ff00ff
 *   - Spark Cyan: #00ffff
 *   - Neural Purple: #9370db
 * 
 * Architecture: PixiContext dependency injection pattern
 * 
 * @version 2.0.0
 * @author Claude AI
 * @license MIT
 */

// ═══════════════════════════════════════════════════════════════════════════════
// AURORA RIBBON COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * AuroraRibbon - Creates soft flowing aurora bands
 * Pure composition - receives dependencies via PixiContext
 * 
 * Technical approach:
 * - Draws filled band shapes that flow like aurora curtains
 * - Multiple layered bands with different phases create depth
 * - Soft alpha with ADD blend mode for luminous glow
 * - Smooth bezier curves for organic movement
 * 
 * @param {PixiContext} ctx - PixiContext with classes, ticker, gsap
 * @param {Object} options - Configuration options
 * @param {PIXI.Container} options.container - Container to add ribbon to
 * @param {number} [options.width=800] - Canvas width
 * @param {number} [options.height=600] - Canvas height
 * @param {number} [options.bandCount=4] - Number of aurora bands
 * @param {number} [options.baseY=300] - Vertical center position
 * @param {number} [options.amplitude=60] - Wave amplitude
 * @param {number} [options.speed=0.012] - Animation speed
 * @param {number[]} [options.colors] - Array of band colors (hex)
 */
class AuroraRibbon {
  static defaults = {
    width: 800,
    height: 600,
    bandCount: 4,
    baseY: 300,
    amplitude: 60,
    speed: 0.012,
    colors: [0x00ff87, 0x00ccff, 0x9966ff, 0x00ffaa],
    bandHeight: 80,
  };

  constructor(ctx, options = {}) {
    // Validate context
    if (!ctx?.classes) throw new Error('AuroraRibbon: ctx.classes is required');
    if (!ctx?.ticker) throw new Error('AuroraRibbon: ctx.ticker is required');

    // Store context references
    this.ticker = ctx.ticker;
    this.classes = ctx.classes;
    this.gsap = ctx.gsap;

    // Merge options with defaults
    this.options = { ...AuroraRibbon.defaults, ...options };

    // Validate required options
    if (!this.options.container) {
      throw new Error('AuroraRibbon: options.container is required');
    }
    this.container = this.options.container;

    // State
    this._destroyed = false;
    this._running = false;
    this._boundUpdate = null;
    this._time = 0;

    this._auroraContainer = null;
    this._bands = [];

    this._setup();
  }

  _setup() {
    this._auroraContainer = new this.classes.Container();
    this._auroraContainer.blendMode = 'add';
    this.container.addChild(this._auroraContainer);

    // Create aurora bands - each is a Graphics object
    for (let i = 0; i < this.options.bandCount; i++) {
      const graphics = new this.classes.Graphics();
      graphics.alpha = 0.15 + (i % 2) * 0.05; // Subtle alpha variation

      this._bands.push({
        graphics,
        phase: (i / this.options.bandCount) * Math.PI * 2,
        frequency: 0.6 + i * 0.15,
        yOffset: (i - this.options.bandCount / 2) * 50,
        color: this.options.colors[i % this.options.colors.length],
        speedMult: 0.8 + (i % 3) * 0.2,
      });

      this._auroraContainer.addChild(graphics);
    }
  }

  _calculateY(x, band, time) {
    const normalizedX = x / this.options.width;
    const t = time * band.speedMult;

    // Smooth flowing waves
    const wave1 = Math.sin(normalizedX * Math.PI * 2 * band.frequency + t + band.phase);
    const wave2 = Math.sin(normalizedX * Math.PI * 3 + t * 0.7 + band.phase) * 0.3;
    const wave3 = Math.sin(normalizedX * Math.PI * 0.8 + t * 0.4) * 0.2;

    return this.options.baseY + band.yOffset + (wave1 + wave2 + wave3) * this.options.amplitude;
  }

  _drawBand(band, time) {
    const g = band.graphics;
    g.clear();

    const segments = 60;
    const segmentWidth = this.options.width / segments;
    const bandHeight = this.options.bandHeight;

    // Build path points
    const topPoints = [];
    const bottomPoints = [];

    for (let i = 0; i <= segments; i++) {
      const x = i * segmentWidth;
      const centerY = this._calculateY(x, band, time);

      // Vary the height along the band for organic feel
      const heightVar = 0.7 + Math.sin(time * 0.5 + x * 0.01 + band.phase) * 0.3;
      const halfHeight = (bandHeight * heightVar) / 2;

      topPoints.push({ x, y: centerY - halfHeight });
      bottomPoints.push({ x, y: centerY + halfHeight });
    }

    // Draw filled band shape
    g.moveTo(topPoints[0].x, topPoints[0].y);

    // Top edge - smooth curve
    for (let i = 1; i < topPoints.length; i++) {
      const prev = topPoints[i - 1];
      const curr = topPoints[i];
      const cpX = (prev.x + curr.x) / 2;
      g.quadraticCurveTo(prev.x, prev.y, cpX, (prev.y + curr.y) / 2);
    }
    g.lineTo(topPoints[topPoints.length - 1].x, topPoints[topPoints.length - 1].y);

    // Right edge
    g.lineTo(bottomPoints[bottomPoints.length - 1].x, bottomPoints[bottomPoints.length - 1].y);

    // Bottom edge - smooth curve (reverse)
    for (let i = bottomPoints.length - 2; i >= 0; i--) {
      const prev = bottomPoints[i + 1];
      const curr = bottomPoints[i];
      const cpX = (prev.x + curr.x) / 2;
      g.quadraticCurveTo(prev.x, prev.y, cpX, (prev.y + curr.y) / 2);
    }
    g.lineTo(bottomPoints[0].x, bottomPoints[0].y);

    // Close and fill
    g.closePath();
    g.fill({ color: band.color, alpha: 0.4 });

    // Add a brighter core line
    g.setStrokeStyle({ width: 2, color: band.color, alpha: 0.3 });
    g.moveTo(0, this._calculateY(0, band, time));
    for (let i = 1; i <= segments; i++) {
      const x = i * segmentWidth;
      const y = this._calculateY(x, band, time);
      g.lineTo(x, y);
    }
    g.stroke();
  }

  start() {
    if (this._destroyed || this._running) return this;
    this._running = true;
    this._boundUpdate = this._boundUpdate || this._update.bind(this);
    this.ticker.add(this._boundUpdate);
    return this;
  }

  _update(ticker) {
    const delta = ticker.deltaTime;
    this._time += this.options.speed * delta;

    for (const band of this._bands) {
      this._drawBand(band, this._time);
    }
  }

  stop() {
    if (!this._running) return this;
    this._running = false;
    if (this._boundUpdate) {
      this.ticker.remove(this._boundUpdate);
    }
    return this;
  }

  reset() {
    this.stop();
    this._time = 0;
    for (const band of this._bands) {
      band.graphics.clear();
    }
    return this;
  }

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;

    this.stop();
    this._boundUpdate = null;

    for (const band of this._bands) {
      if (band.graphics.parent) {
        band.graphics.parent.removeChild(band.graphics);
      }
      band.graphics.destroy();
    }
    this._bands = [];

    if (this._auroraContainer?.parent) {
      this._auroraContainer.parent.removeChild(this._auroraContainer);
    }
    this._auroraContainer?.destroy();
    this._auroraContainer = null;
  }

  // Setters for dynamic control
  set amplitude(value) { this.options.amplitude = value; }
  set speed(value) { this.options.speed = value; }
  get running() { return this._running; }
}


// ═══════════════════════════════════════════════════════════════════════════════
// NEURAL NETWORK COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * NeuralNetwork - Creates an animated network of interconnected neural nodes
 * Pure composition - receives dependencies via PixiContext
 * 
 * Technical approach:
 * - Pre-creates all node sprites and connection graphics
 * - Nodes pulse with varying phases for organic feel
 * - Connections use bezier curves with animated alpha
 * - Energy pulses travel along connections
 * 
 * @param {PixiContext} ctx - PixiContext with classes, ticker, gsap
 * @param {Object} options - Configuration options
 * @param {PIXI.Container} options.container - Container to add network to
 * @param {PIXI.Texture} options.nodeTexture - Texture for node sprites
 * @param {number} [options.nodeCount=15] - Number of neural nodes
 * @param {number} [options.width=800] - Canvas width
 * @param {number} [options.height=600] - Canvas height
 * @param {number} [options.connectionDistance=200] - Max distance for connections
 */
class NeuralNetwork {
  static defaults = {
    nodeCount: 15,
    width: 800,
    height: 600,
    connectionDistance: 200,
    pulseSpeed: 0.03,
    nodeColors: [0x00ff87, 0x00ffff, 0xff00ff, 0x9370db],
    minNodeSize: 0.3,
    maxNodeSize: 0.8,
  };

  constructor(ctx, options = {}) {
    // Validate context
    if (!ctx?.classes) throw new Error('NeuralNetwork: ctx.classes is required');
    if (!ctx?.ticker) throw new Error('NeuralNetwork: ctx.ticker is required');

    // Store context references
    this.ticker = ctx.ticker;
    this.classes = ctx.classes;
    this.gsap = ctx.gsap;

    // Merge options with defaults
    this.options = { ...NeuralNetwork.defaults, ...options };

    // Validate required options
    if (!this.options.container) {
      throw new Error('NeuralNetwork: options.container is required');
    }
    if (!this.options.nodeTexture) {
      throw new Error('NeuralNetwork: options.nodeTexture is required');
    }
    this.container = this.options.container;

    // State
    this._destroyed = false;
    this._running = false;
    this._boundUpdate = null;
    this._time = 0;

    // Storage
    this._nodes = [];
    this._connections = [];
    this._connectionGraphics = null;
    this._nodeContainer = null;
    this._energyPulses = [];

    this._setup();
  }

  _setup() {
    // Create containers
    this._connectionGraphics = new this.classes.Graphics();
    this._connectionGraphics.blendMode = 'add';
    this.container.addChild(this._connectionGraphics);

    this._nodeContainer = new this.classes.Container();
    this._nodeContainer.blendMode = 'add';
    this.container.addChild(this._nodeContainer);

    // Create nodes at random positions
    for (let i = 0; i < this.options.nodeCount; i++) {
      const node = this._createNode(i);
      this._nodes.push(node);
    }

    // Calculate connections between nearby nodes
    this._calculateConnections();

    // Initialize energy pulses pool
    for (let i = 0; i < 20; i++) {
      this._energyPulses.push({
        active: false,
        connection: null,
        progress: 0,
        speed: 0,
        color: 0
      });
    }
  }

  _createNode(index) {
    const sprite = new this.classes.Sprite(this.options.nodeTexture);
    sprite.anchor.set(0.5);
    sprite.x = Math.random() * this.options.width;
    sprite.y = Math.random() * this.options.height;

    const colorIndex = index % this.options.nodeColors.length;
    sprite.tint = this.options.nodeColors[colorIndex];

    const baseScale = this.options.minNodeSize +
                      Math.random() * (this.options.maxNodeSize - this.options.minNodeSize);
    sprite.scale.set(baseScale);
    sprite.alpha = 0.6;

    this._nodeContainer.addChild(sprite);

    return {
      sprite: sprite,
      baseScale: baseScale,
      phase: Math.random() * Math.PI * 2,
      pulseFreq: 0.5 + Math.random() * 0.5,
      color: this.options.nodeColors[colorIndex],
      connections: []
    };
  }

  _calculateConnections() {
    const maxDist = this.options.connectionDistance;
    const maxDistSq = maxDist * maxDist;

    for (let i = 0; i < this._nodes.length; i++) {
      for (let j = i + 1; j < this._nodes.length; j++) {
        const nodeA = this._nodes[i];
        const nodeB = this._nodes[j];

        const dx = nodeB.sprite.x - nodeA.sprite.x;
        const dy = nodeB.sprite.y - nodeA.sprite.y;
        const distSq = dx * dx + dy * dy;

        if (distSq < maxDistSq) {
          const connection = {
            nodeA: nodeA,
            nodeB: nodeB,
            distance: Math.sqrt(distSq),
            strength: 1 - (Math.sqrt(distSq) / maxDist)
          };
          this._connections.push(connection);
          nodeA.connections.push(connection);
          nodeB.connections.push(connection);
        }
      }
    }
  }

  _triggerEnergyPulse() {
    if (this._connections.length === 0) return;

    // Find inactive pulse
    const pulse = this._energyPulses.find(p => !p.active);
    if (!pulse) return;

    // Random connection
    const connection = this._connections[Math.floor(Math.random() * this._connections.length)];

    pulse.active = true;
    pulse.connection = connection;
    pulse.progress = 0;
    pulse.speed = 0.02 + Math.random() * 0.02;
    pulse.color = connection.nodeA.color;
    pulse.reverse = Math.random() > 0.5;
  }

  _drawConnections() {
    const g = this._connectionGraphics;
    g.clear();

    // Draw base connections
    for (const conn of this._connections) {
      const alpha = 0.15 + conn.strength * 0.2;

      g.setStrokeStyle({
        width: 1 + conn.strength * 2,
        color: conn.nodeA.color,
        alpha: alpha
      });

      // Calculate control point for bezier curve (slight arc)
      const midX = (conn.nodeA.sprite.x + conn.nodeB.sprite.x) / 2;
      const midY = (conn.nodeA.sprite.y + conn.nodeB.sprite.y) / 2;
      const offsetY = (conn.nodeA.sprite.x - conn.nodeB.sprite.x) * 0.1;

      g.moveTo(conn.nodeA.sprite.x, conn.nodeA.sprite.y);
      g.quadraticCurveTo(midX, midY + offsetY, conn.nodeB.sprite.x, conn.nodeB.sprite.y);
      g.stroke();
    }

    // Draw energy pulses
    for (const pulse of this._energyPulses) {
      if (!pulse.active) continue;

      const conn = pulse.connection;
      const t = pulse.reverse ? 1 - pulse.progress : pulse.progress;

      // Calculate position along bezier
      const startX = conn.nodeA.sprite.x;
      const startY = conn.nodeA.sprite.y;
      const endX = conn.nodeB.sprite.x;
      const endY = conn.nodeB.sprite.y;
      const midX = (startX + endX) / 2;
      const midY = (startY + endY) / 2 + (startX - endX) * 0.1;

      // Quadratic bezier formula
      const u = 1 - t;
      const px = u * u * startX + 2 * u * t * midX + t * t * endX;
      const py = u * u * startY + 2 * u * t * midY + t * t * endY;

      // Draw pulse glow
      g.circle(px, py, 8);
      g.fill({ color: pulse.color, alpha: 0.8 });

      g.circle(px, py, 15);
      g.fill({ color: pulse.color, alpha: 0.3 });
    }
  }

  start() {
    if (this._destroyed || this._running) return this;
    this._running = true;
    this._boundUpdate = this._boundUpdate || this._update.bind(this);
    this.ticker.add(this._boundUpdate);
    return this;
  }

  _update(ticker) {
    const delta = ticker.deltaTime;
    this._time += this.options.pulseSpeed * delta;

    // Update node pulsing
    for (const node of this._nodes) {
      const pulse = Math.sin(this._time * node.pulseFreq + node.phase);
      const scale = node.baseScale * (0.9 + pulse * 0.2);
      node.sprite.scale.set(scale);
      node.sprite.alpha = 0.5 + pulse * 0.3;
    }

    // Update energy pulses
    for (const pulse of this._energyPulses) {
      if (!pulse.active) continue;

      pulse.progress += pulse.speed * delta;
      if (pulse.progress >= 1) {
        pulse.active = false;
      }
    }

    // Randomly trigger new pulses
    if (Math.random() < 0.05 * delta) {
      this._triggerEnergyPulse();
    }

    // Redraw connections
    this._drawConnections();
  }

  stop() {
    if (!this._running) return this;
    this._running = false;
    if (this._boundUpdate) {
      this.ticker.remove(this._boundUpdate);
    }
    return this;
  }

  /**
   * Trigger burst of energy from a specific position
   * @param {number} x - X position
   * @param {number} y - Y position
   */
  triggerBurst(x, y) {
    // Find nearest node
    let nearest = null;
    let nearestDist = Infinity;

    for (const node of this._nodes) {
      const dx = node.sprite.x - x;
      const dy = node.sprite.y - y;
      const dist = dx * dx + dy * dy;
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = node;
      }
    }

    // Trigger pulses on all connections of nearest node
    if (nearest) {
      for (const conn of nearest.connections) {
        this._triggerEnergyPulse();
      }
    }
  }

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;

    this.stop();
    this._boundUpdate = null;

    for (const node of this._nodes) {
      if (node.sprite.parent) node.sprite.parent.removeChild(node.sprite);
      node.sprite.destroy();
    }
    this._nodes = [];
    this._connections = [];

    if (this._connectionGraphics?.parent) {
      this._connectionGraphics.parent.removeChild(this._connectionGraphics);
    }
    this._connectionGraphics?.destroy();

    if (this._nodeContainer?.parent) {
      this._nodeContainer.parent.removeChild(this._nodeContainer);
    }
    this._nodeContainer?.destroy();
  }

  get running() { return this._running; }
}


// ═══════════════════════════════════════════════════════════════════════════════
// THOUGHT PARTICLES COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * ThoughtParticles - Rising thought orbs that drift upward with trail effects
 * Pure composition with object pooling for performance
 * 
 * Technical approach:
 * - Object pooling for thought sprites
 * - Each thought has velocity, target, and trail
 * - Thoughts can spawn connected to each other
 * 
 * @param {PixiContext} ctx - PixiContext with classes, ticker, gsap
 * @param {Object} options - Configuration options
 * @param {PIXI.Container} options.container - Container to add particles to
 * @param {PIXI.Texture} options.texture - Texture for thought orbs
 * @param {number} [options.maxCount=30] - Maximum active thoughts
 * @param {number} [options.width=800] - Canvas width
 * @param {number} [options.height=600] - Canvas height
 */
class ThoughtParticles {
  static defaults = {
    maxCount: 30,
    width: 800,
    height: 600,
    spawnRate: 0.03,
    colors: [0x00ff87, 0x00ffff, 0xff00ff, 0x9370db],
    minSize: 0.2,
    maxSize: 0.6,
    riseSpeed: 0.5,
  };

  constructor(ctx, options = {}) {
    // Validate context
    if (!ctx?.classes) throw new Error('ThoughtParticles: ctx.classes is required');
    if (!ctx?.ticker) throw new Error('ThoughtParticles: ctx.ticker is required');

    // Store context references
    this.ticker = ctx.ticker;
    this.classes = ctx.classes;
    this.gsap = ctx.gsap;

    // Merge options with defaults
    this.options = { ...ThoughtParticles.defaults, ...options };

    // Validate required options
    if (!this.options.container) {
      throw new Error('ThoughtParticles: options.container is required');
    }
    if (!this.options.texture) {
      throw new Error('ThoughtParticles: options.texture is required');
    }
    this.container = this.options.container;

    // State
    this._destroyed = false;
    this._running = false;
    this._boundUpdate = null;

    // Object pools
    this._pool = [];
    this._active = [];

    // Connection graphics
    this._connectionGraphics = null;

    this._init();
  }

  _init() {
    // Pre-create thought sprites
    for (let i = 0; i < this.options.maxCount; i++) {
      const thought = this._createThought();
      this._pool.push(thought);
    }

    // Create connection graphics
    this._connectionGraphics = new this.classes.Graphics();
    this._connectionGraphics.blendMode = 'add';
    this.container.addChild(this._connectionGraphics);
  }

  _createThought() {
    const sprite = new this.classes.Sprite(this.options.texture);
    sprite.anchor.set(0.5);
    sprite.visible = false;
    sprite.blendMode = 'add';

    // Attach data directly to sprite
    sprite._data = {
      vx: 0,
      vy: 0,
      targetY: 0,
      life: 0,
      maxLife: 0,
      color: 0,
      baseScale: 0,
      connectedTo: null,
      connectionStrength: 0
    };

    this.container.addChild(sprite);
    return sprite;
  }

  _spawn(x, y, connectedTo = null) {
    if (this._pool.length === 0) return null;

    const thought = this._pool.pop();
    const data = thought._data;

    // Initialize position
    thought.x = x ?? Math.random() * this.options.width;
    thought.y = y ?? this.options.height + 50;
    thought.visible = true;
    thought.alpha = 0;

    // Random properties
    const colorIdx = Math.floor(Math.random() * this.options.colors.length);
    thought.tint = this.options.colors[colorIdx];
    data.color = this.options.colors[colorIdx];

    data.baseScale = this.options.minSize + Math.random() * (this.options.maxSize - this.options.minSize);
    thought.scale.set(data.baseScale);

    // Movement
    data.vx = (Math.random() - 0.5) * 0.5;
    data.vy = -this.options.riseSpeed - Math.random() * 0.3;
    data.targetY = -100;

    // Life
    data.maxLife = 200 + Math.random() * 200;
    data.life = data.maxLife;

    // Connection
    data.connectedTo = connectedTo;
    data.connectionStrength = connectedTo ? 1 : 0;

    this._active.push(thought);
    return thought;
  }

  _despawn(thought) {
    thought.visible = false;
    thought._data.connectedTo = null;

    const idx = this._active.indexOf(thought);
    if (idx > -1) {
      // O(1) swap-and-pop instead of O(n) splice
      const last = this._active[this._active.length - 1];
      this._active[idx] = last;
      this._active.pop();
      this._pool.push(thought);
    }
  }

  _drawConnections() {
    const g = this._connectionGraphics;
    g.clear();

    for (const thought of this._active) {
      const data = thought._data;
      if (!data.connectedTo || !data.connectedTo.visible) continue;

      const other = data.connectedTo;
      const alpha = data.connectionStrength * thought.alpha * 0.5;

      g.setStrokeStyle({
        width: 2,
        color: data.color,
        alpha: alpha
      });

      g.moveTo(thought.x, thought.y);
      g.lineTo(other.x, other.y);
      g.stroke();
    }
  }

  start() {
    if (this._destroyed || this._running) return this;
    this._running = true;
    this._boundUpdate = this._boundUpdate || this._update.bind(this);
    this.ticker.add(this._boundUpdate);
    return this;
  }

  _update(ticker) {
    const delta = ticker.deltaTime;

    // Update active thoughts
    for (let i = this._active.length - 1; i >= 0; i--) {
      const thought = this._active[i];
      const data = thought._data;

      data.life -= delta;

      if (data.life <= 0) {
        this._despawn(thought);
        continue;
      }

      // Movement with gentle drift
      data.vx += (Math.random() - 0.5) * 0.01 * delta;
      data.vx *= 0.99; // Damping

      thought.x += data.vx * delta;
      thought.y += data.vy * delta;

      // Alpha based on life
      const lifeRatio = data.life / data.maxLife;
      if (lifeRatio > 0.9) {
        // Fade in
        thought.alpha = (1 - lifeRatio) * 10;
      } else if (lifeRatio < 0.2) {
        // Fade out
        thought.alpha = lifeRatio * 5;
      } else {
        thought.alpha = 1;
      }

      // Pulse scale
      const pulse = Math.sin(data.life * 0.05) * 0.1 + 1;
      thought.scale.set(data.baseScale * pulse);

      // Fade connection
      if (data.connectedTo) {
        data.connectionStrength *= 0.995;
        if (data.connectionStrength < 0.1) {
          data.connectedTo = null;
        }
      }
    }

    // Spawn new thoughts
    if (Math.random() < this.options.spawnRate * delta) {
      // Sometimes spawn connected to existing thought
      if (this._active.length > 0 && Math.random() < 0.3) {
        const parent = this._active[Math.floor(Math.random() * this._active.length)];
        this._spawn(parent.x + (Math.random() - 0.5) * 100, parent.y + 50, parent);
      } else {
        this._spawn();
      }
    }

    // Draw connections
    this._drawConnections();
  }

  stop() {
    if (!this._running) return this;
    this._running = false;
    if (this._boundUpdate) {
      this.ticker.remove(this._boundUpdate);
    }
    return this;
  }

  /**
   * Burst spawn thoughts at position
   * @param {number} x - X position
   * @param {number} y - Y position  
   * @param {number} [count=5] - Number to spawn
   */
  burst(x, y, count = 5) {
    for (let i = 0; i < count; i++) {
      const offsetX = (Math.random() - 0.5) * 100;
      const offsetY = (Math.random() - 0.5) * 50;
      this._spawn(x + offsetX, y + offsetY);
    }
  }

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;

    this.stop();
    this._boundUpdate = null;

    for (const thought of [...this._pool, ...this._active]) {
      if (thought.parent) thought.parent.removeChild(thought);
      thought.destroy();
    }
    this._pool = [];
    this._active = [];

    if (this._connectionGraphics?.parent) {
      this._connectionGraphics.parent.removeChild(this._connectionGraphics);
    }
    this._connectionGraphics?.destroy();
  }

  get running() { return this._running; }
  get activeCount() { return this._active.length; }
}


// ═══════════════════════════════════════════════════════════════════════════════
// SYNAPTIC SPARKS COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * SynapticSparks - Ambient particle system for synaptic activity
 * High-performance pooled particles representing neural firing
 * 
 * @param {PixiContext} ctx - PixiContext with classes, ticker, gsap
 * @param {Object} options - Configuration options
 * @param {PIXI.Container} options.container - Container for sparks
 * @param {PIXI.Texture} options.texture - Spark texture
 * @param {number} [options.maxCount=200] - Maximum sparks
 */
class SynapticSparks {
  static defaults = {
    maxCount: 200,
    width: 800,
    height: 600,
    spawnRate: 2,
    colors: [0x00ff87, 0x00ffff, 0xff00ff],
  };

  constructor(ctx, options = {}) {
    // Validate context
    if (!ctx?.classes) throw new Error('SynapticSparks: ctx.classes is required');
    if (!ctx?.ticker) throw new Error('SynapticSparks: ctx.ticker is required');

    // Store context references
    this.ticker = ctx.ticker;
    this.classes = ctx.classes;
    this.gsap = ctx.gsap;

    // Merge options with defaults
    this.options = { ...SynapticSparks.defaults, ...options };

    // Validate required options
    if (!this.options.container) {
      throw new Error('SynapticSparks: options.container is required');
    }
    if (!this.options.texture) {
      throw new Error('SynapticSparks: options.texture is required');
    }
    this.container = this.options.container;

    // State
    this._destroyed = false;
    this._running = false;
    this._boundUpdate = null;
    this._pool = [];
    this._active = [];
    this._sparkContainer = null;

    this._init();
  }

  _init() {
    // Create container with ADD blend
    this._sparkContainer = new this.classes.Container();
    this._sparkContainer.blendMode = 'add';
    this.container.addChild(this._sparkContainer);

    // Pre-create all sparks
    for (let i = 0; i < this.options.maxCount; i++) {
      const spark = new this.classes.Sprite(this.options.texture);
      spark.anchor.set(0.5);
      spark.visible = false;
      spark.scale.set(0.1 + Math.random() * 0.2);

      // Attach data
      spark._vx = 0;
      spark._vy = 0;
      spark._life = 0;
      spark._decay = 0;

      this._sparkContainer.addChild(spark);
      this._pool.push(spark);
    }
  }

  _spawn(x, y, vx, vy) {
    if (this._pool.length === 0) return null;

    const spark = this._pool.pop();
    spark.visible = true;
    spark.x = x ?? Math.random() * this.options.width;
    spark.y = y ?? Math.random() * this.options.height;
    spark.alpha = 0.8 + Math.random() * 0.2;

    spark.tint = this.options.colors[Math.floor(Math.random() * this.options.colors.length)];

    spark._vx = vx ?? (Math.random() - 0.5) * 3;
    spark._vy = vy ?? (Math.random() - 0.5) * 3;
    spark._life = 30 + Math.random() * 60;
    spark._decay = 0.98;

    this._active.push(spark);
    return spark;
  }

  _despawn(spark) {
    spark.visible = false;
    const idx = this._active.indexOf(spark);
    if (idx > -1) {
      // O(1) swap-and-pop instead of O(n) splice
      const last = this._active[this._active.length - 1];
      this._active[idx] = last;
      this._active.pop();
      this._pool.push(spark);
    }
  }

  start() {
    if (this._destroyed || this._running) return this;
    this._running = true;
    this._boundUpdate = this._boundUpdate || this._update.bind(this);
    this.ticker.add(this._boundUpdate);
    return this;
  }

  _update(ticker) {
    const delta = ticker.deltaTime;

    // Update active sparks
    for (let i = this._active.length - 1; i >= 0; i--) {
      const spark = this._active[i];

      spark._life -= delta;
      if (spark._life <= 0) {
        this._despawn(spark);
        continue;
      }

      // Movement with decay
      spark.x += spark._vx * delta;
      spark.y += spark._vy * delta;
      spark._vx *= spark._decay;
      spark._vy *= spark._decay;

      // Fade based on remaining life
      spark.alpha = Math.min(1, spark._life / 20);
    }

    // Spawn new sparks
    const spawnCount = Math.floor(this.options.spawnRate * delta);
    for (let i = 0; i < spawnCount; i++) {
      this._spawn();
    }
  }

  stop() {
    if (!this._running) return this;
    this._running = false;
    if (this._boundUpdate) {
      this.ticker.remove(this._boundUpdate);
    }
    return this;
  }

  /**
   * Create burst of sparks at position
   */
  burst(x, y, count = 20) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 4;
      this._spawn(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed);
    }
  }

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;

    this.stop();
    this._boundUpdate = null;

    for (const spark of [...this._pool, ...this._active]) {
      if (spark.parent) spark.parent.removeChild(spark);
      spark.destroy();
    }
    this._pool = [];
    this._active = [];

    if (this._sparkContainer?.parent) {
      this._sparkContainer.parent.removeChild(this._sparkContainer);
    }
    this._sparkContainer?.destroy();
  }

  get running() { return this._running; }
}


// ═══════════════════════════════════════════════════════════════════════════════
// NEURAL AURORA SCENE - MASTER ORCHESTRATOR
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * NeuralAuroraScene - Master component that orchestrates all sub-components
 * Creates complete "thoughts manifest as aurora" experience
 * 
 * @param {PixiContext} ctx - PixiContext with classes, ticker, gsap, renderer
 * @param {Object} options - Configuration options
 * @param {PIXI.Container} options.container - Main container
 * @param {number} [options.width=800] - Canvas width
 * @param {number} [options.height=600] - Canvas height
 */
class NeuralAuroraScene {
  /**
   * Lifecycle descriptor for demoRunner.
   * Declares that async setup() must be called before start().
   */
  static lifecycle = {
    setup: true
  };

  static defaults = {
    width: 800,
    height: 600,
    backgroundColor: 0x0d0d1a,
  };

  constructor(ctx, options = {}) {
    // Validate context
    if (!ctx?.classes) throw new Error('NeuralAuroraScene: ctx.classes is required');
    if (!ctx?.ticker) throw new Error('NeuralAuroraScene: ctx.ticker is required');
    if (!ctx?.renderer) throw new Error('NeuralAuroraScene: ctx.renderer is required');

    // Store context references
    this.ctx = ctx;
    this.ticker = ctx.ticker;
    this.classes = ctx.classes;
    this.gsap = ctx.gsap;
    this.renderer = ctx.renderer;

    // Merge options with defaults
    this.options = { ...NeuralAuroraScene.defaults, ...options };

    // Validate required options
    if (!this.options.container) {
      throw new Error('NeuralAuroraScene: options.container is required');
    }
    this.container = this.options.container;

    // State
    this._destroyed = false;
    this._running = false;

    // Sub-component references
    this._background = null;
    this._auroraRibbon = null;
    this._neuralNetwork = null;
    this._thoughtParticles = null;
    this._synapticSparks = null;

    // Layer containers
    this._backgroundLayer = null;
    this._auroraLayer = null;
    this._networkLayer = null;
    this._particleLayer = null;
    this._sparkLayer = null;

    // Textures (created procedurally)
    this._textures = {};
  }

  /**
   * Initialize the scene - must be called after construction
   * Creates all textures and sub-components
   */
  async setup() {
    // Create procedural textures
    this._createTextures();

    // Render textures
    this._renderTextures();

    // Create background
    this._createBackground();

    // Create layer containers (back to front)
    this._backgroundLayer = new this.classes.Container();
    this._auroraLayer = new this.classes.Container();
    this._networkLayer = new this.classes.Container();
    this._particleLayer = new this.classes.Container();
    this._sparkLayer = new this.classes.Container();

    this.container.addChild(this._backgroundLayer);
    this.container.addChild(this._auroraLayer);
    this.container.addChild(this._networkLayer);
    this.container.addChild(this._particleLayer);
    this.container.addChild(this._sparkLayer);

    // Initialize sub-components with PixiContext
    this._auroraRibbon = new AuroraRibbon(this.ctx, {
      container: this._auroraLayer,
      width: this.options.width,
      height: this.options.height,
      baseY: this.options.height * 0.5,
      amplitude: this.options.height * 0.08,
      bandCount: 4,
      bandHeight: 60,
      speed: 0.01
    });

    this._neuralNetwork = new NeuralNetwork(this.ctx, {
      container: this._networkLayer,
      nodeTexture: this._textures.node,
      width: this.options.width,
      height: this.options.height,
      nodeCount: 12,
      connectionDistance: 250
    });

    this._thoughtParticles = new ThoughtParticles(this.ctx, {
      container: this._particleLayer,
      texture: this._textures.thought,
      width: this.options.width,
      height: this.options.height,
      maxCount: 25,
      spawnRate: 0.02
    });

    this._synapticSparks = new SynapticSparks(this.ctx, {
      container: this._sparkLayer,
      texture: this._textures.spark,
      width: this.options.width,
      height: this.options.height,
      maxCount: 150,
      spawnRate: 1.5
    });

    return this;
  }

  /**
   * Create procedural textures for all components
   * @private
   */
  _createTextures() {
    // Node texture - soft glowing circle
    const nodeGraphics = new this.classes.Graphics();
    nodeGraphics.circle(32, 32, 24);
    nodeGraphics.fill({ color: 0xffffff, alpha: 0.3 });
    nodeGraphics.circle(32, 32, 16);
    nodeGraphics.fill({ color: 0xffffff, alpha: 0.6 });
    nodeGraphics.circle(32, 32, 8);
    nodeGraphics.fill({ color: 0xffffff, alpha: 1 });

    const nodeTexture = this.classes.RenderTexture.create({
      width: 64,
      height: 64
    });

    this._textures.nodeGraphics = nodeGraphics;
    this._textures.nodeTexture = nodeTexture;
    this._textures.node = nodeTexture;

    // Thought texture - larger soft glow
    const thoughtGraphics = new this.classes.Graphics();
    thoughtGraphics.circle(48, 48, 40);
    thoughtGraphics.fill({ color: 0xffffff, alpha: 0.2 });
    thoughtGraphics.circle(48, 48, 28);
    thoughtGraphics.fill({ color: 0xffffff, alpha: 0.4 });
    thoughtGraphics.circle(48, 48, 16);
    thoughtGraphics.fill({ color: 0xffffff, alpha: 0.7 });
    thoughtGraphics.circle(48, 48, 8);
    thoughtGraphics.fill({ color: 0xffffff, alpha: 1 });

    const thoughtTexture = this.classes.RenderTexture.create({
      width: 96,
      height: 96
    });

    this._textures.thoughtGraphics = thoughtGraphics;
    this._textures.thoughtTexture = thoughtTexture;
    this._textures.thought = thoughtTexture;

    // Spark texture - tiny bright dot
    const sparkGraphics = new this.classes.Graphics();
    sparkGraphics.circle(8, 8, 6);
    sparkGraphics.fill({ color: 0xffffff, alpha: 0.5 });
    sparkGraphics.circle(8, 8, 3);
    sparkGraphics.fill({ color: 0xffffff, alpha: 1 });

    const sparkTexture = this.classes.RenderTexture.create({
      width: 16,
      height: 16
    });

    this._textures.sparkGraphics = sparkGraphics;
    this._textures.sparkTexture = sparkTexture;
    this._textures.spark = sparkTexture;
  }

  /**
   * Render textures using the renderer from context
   * @private
   */
  _renderTextures() {
    if (this._textures.nodeGraphics) {
      this.renderer.render({
        container: this._textures.nodeGraphics,
        target: this._textures.nodeTexture
      });
    }
    if (this._textures.thoughtGraphics) {
      this.renderer.render({
        container: this._textures.thoughtGraphics,
        target: this._textures.thoughtTexture
      });
    }
    if (this._textures.sparkGraphics) {
      this.renderer.render({
        container: this._textures.sparkGraphics,
        target: this._textures.sparkTexture
      });
    }
  }

  /**
   * Create dark gradient background
   * @private
   */
  _createBackground() {
    this._background = new this.classes.Graphics();
    this._background.rect(0, 0, this.options.width, this.options.height);
    this._background.fill({ color: this.options.backgroundColor });
    this.container.addChild(this._background);
  }

  /**
   * Start all animations
   */
  start() {
    if (this._destroyed || this._running) return this;
    this._running = true;

    this._auroraRibbon?.start();
    this._neuralNetwork?.start();
    this._thoughtParticles?.start();
    this._synapticSparks?.start();

    return this;
  }

  /**
   * Stop all animations
   */
  stop() {
    if (!this._running) return this;
    this._running = false;

    this._auroraRibbon?.stop();
    this._neuralNetwork?.stop();
    this._thoughtParticles?.stop();
    this._synapticSparks?.stop();

    return this;
  }

  /**
   * Handle interaction - trigger effects at position
   * @param {number} x - X position
   * @param {number} y - Y position
   */
  interact(x, y) {
    // Trigger burst effects
    this._neuralNetwork?.triggerBurst(x, y);
    this._thoughtParticles?.burst(x, y, 3);
    this._synapticSparks?.burst(x, y, 30);
  }

  /**
   * Clean up all resources
   */
  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;

    this.stop();

    this._auroraRibbon?.destroy();
    this._neuralNetwork?.destroy();
    this._thoughtParticles?.destroy();
    this._synapticSparks?.destroy();

    // Destroy texture graphics
    if (this._textures.nodeGraphics) {
      this._textures.nodeGraphics.destroy();
    }
    if (this._textures.thoughtGraphics) {
      this._textures.thoughtGraphics.destroy();
    }
    if (this._textures.sparkGraphics) {
      this._textures.sparkGraphics.destroy();
    }

    // Destroy render textures
    if (this._textures.nodeTexture) {
      this._textures.nodeTexture.destroy(true);
    }
    if (this._textures.thoughtTexture) {
      this._textures.thoughtTexture.destroy(true);
    }
    if (this._textures.sparkTexture) {
      this._textures.sparkTexture.destroy(true);
    }
    this._textures = {};

    // Remove background
    if (this._background?.parent) {
      this._background.parent.removeChild(this._background);
    }
    this._background?.destroy();

    // Remove layer containers
    const layers = [
      this._backgroundLayer,
      this._auroraLayer,
      this._networkLayer,
      this._particleLayer,
      this._sparkLayer
    ];

    for (const layer of layers) {
      if (layer?.parent) layer.parent.removeChild(layer);
      layer?.destroy();
    }
  }

  get running() { return this._running; }
}


// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export {
  AuroraRibbon,
  NeuralNetwork,
  ThoughtParticles,
  SynapticSparks,
  NeuralAuroraScene
};

export default NeuralAuroraScene;
