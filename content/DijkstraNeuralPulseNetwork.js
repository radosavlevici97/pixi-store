/**
 * DijkstraNeuralPulseNetwork - Interactive Dijkstra's algorithm visualization
 * 
 * Visualizes pathfinding with animated nodes, edges, pulses, and particles.
 * Uses PixiJS v8 via PixiContext dependency injection.
 * Uses GSAP for duration-based animations, ticker for continuous physics.
 * 
 * @example
 * // Create context
 * gsap.registerPlugin(PixiPlugin);
 * PixiPlugin.registerPIXI(PIXI);
 * const ctx = createPixiContext(PIXI, { gsap, PixiPlugin }, app);
 * 
 * // Create visualization
 * const viz = new DijkstraNeuralPulseNetwork(ctx, {
 *   container: app.stage,
 *   width: 650,
 *   height: 420
 * });
 */

// ============================================================================
// CONSTANTS
// ============================================================================

const COLORS = {
  BG: 0x1a1a2e,
  IDLE: 0x2d3a4a,
  QUEUED: 0x00d9ff,
  VISITED: 0xff006e,
  PATH: 0xffd60a,
  SOURCE: 0x00ff88,
  TARGET: 0xff4444,
  EDGE: 0x3a4a5a,
  EDGE_ACTIVE: 0x00d9ff,
  EDGE_PATH: 0xffd60a,
  TEXT: 0xffffff,
  NEW: 0x9b59b6
};

const STATE_COLORS = {
  idle: COLORS.IDLE,
  queued: COLORS.QUEUED,
  visited: COLORS.VISITED,
  path: COLORS.PATH,
  source: COLORS.SOURCE,
  target: COLORS.TARGET
};

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
    for (const fn of this._listeners) this._iterationSnapshot.push(fn);
    for (const fn of this._onceListeners) this._iterationSnapshot.push(fn);
    this._onceListeners.clear();
    for (const fn of this._iterationSnapshot) {
      try { fn(data); } catch (err) { console.error('[Signal] Listener error:', err); }
    }
  }

  clear() {
    this._listeners.clear();
    this._onceListeners.clear();
    this._iterationSnapshot.length = 0;
  }
}

// ============================================================================
// PRIORITY QUEUE
// ============================================================================

class PriorityQueue {
  constructor() {
    this._heap = [];
  }

  get empty() {
    return this._heap.length === 0;
  }

  add(item, priority) {
    this._heap.push({ item, priority });
    this._bubbleUp(this._heap.length - 1);
  }

  pop() {
    if (this.empty) return null;
    const min = this._heap[0];
    const end = this._heap.pop();
    if (this._heap.length > 0) {
      this._heap[0] = end;
      this._bubbleDown(0);
    }
    return min.item;
  }

  clear() {
    this._heap = [];
  }

  _bubbleUp(i) {
    const el = this._heap[i];
    while (i > 0) {
      const pi = (i - 1) >> 1;
      if (el.priority >= this._heap[pi].priority) break;
      this._heap[i] = this._heap[pi];
      i = pi;
    }
    this._heap[i] = el;
  }

  _bubbleDown(i) {
    const len = this._heap.length;
    const el = this._heap[i];
    while (true) {
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      let swap = null;
      if (l < len && this._heap[l].priority < el.priority) swap = l;
      if (r < len && this._heap[r].priority < (swap === null ? el.priority : this._heap[swap].priority)) swap = r;
      if (swap === null) break;
      this._heap[i] = this._heap[swap];
      i = swap;
    }
    this._heap[i] = el;
  }
}

// ============================================================================
// GRAPH GENERATOR
// ============================================================================

class GraphGenerator {
  static generate(nodeCount, width, height, padding = 40) {
    const nodes = [];
    const edges = [];
    const labels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

    const cols = Math.ceil(Math.sqrt(nodeCount * 1.5));
    const rows = Math.ceil(nodeCount / cols);
    const cellW = (width - padding * 2) / cols;
    const cellH = (height - padding * 2) / rows;

    for (let i = 0; i < nodeCount; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const jitterX = (Math.random() - 0.5) * cellW * 0.6;
      const jitterY = (Math.random() - 0.5) * cellH * 0.6;

      nodes.push({
        id: labels[i],
        x: padding + col * cellW + cellW / 2 + jitterX,
        y: padding + row * cellH + cellH / 2 + jitterY
      });
    }

    nodes.sort((a, b) => a.x - b.x);
    nodes.forEach((n, i) => (n.id = labels[i]));

    const sourceId = nodes[0].id;
    const targetId = nodes[nodes.length - 1].id;

    // MST for connectivity
    const connected = new Set([0]);
    const notConnected = new Set(nodes.map((_, i) => i).filter(i => i !== 0));

    while (notConnected.size > 0) {
      let bestEdge = null;
      let bestDist = Infinity;

      for (const from of connected) {
        for (const to of notConnected) {
          const dx = nodes[from].x - nodes[to].x;
          const dy = nodes[from].y - nodes[to].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const score = dist * (0.5 + Math.random());
          if (score < bestDist) {
            bestDist = score;
            bestEdge = { from, to, dist };
          }
        }
      }

      if (bestEdge) {
        connected.add(bestEdge.to);
        notConnected.delete(bestEdge.to);
        const weight = Math.max(1, Math.min(6, Math.round(bestEdge.dist / 50) + Math.floor(Math.random() * 2)));
        edges.push([nodes[bestEdge.from].id, nodes[bestEdge.to].id, weight]);
      }
    }

    // Extra edges
    const extraEdges = Math.floor(nodeCount * 0.8);
    const edgeSet = new Set(edges.map(e => `${e[0]}-${e[1]}`));

    for (let i = 0; i < extraEdges; i++) {
      const from = Math.floor(Math.random() * nodes.length);
      const to = Math.floor(Math.random() * nodes.length);
      if (from === to) continue;

      const key1 = `${nodes[from].id}-${nodes[to].id}`;
      const key2 = `${nodes[to].id}-${nodes[from].id}`;
      if (edgeSet.has(key1) || edgeSet.has(key2)) continue;

      const dx = nodes[from].x - nodes[to].x;
      const dy = nodes[from].y - nodes[to].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > (width + height) / 3) continue;

      const weight = Math.max(1, Math.min(6, Math.round(dist / 50) + Math.floor(Math.random() * 2)));
      edges.push([nodes[from].id, nodes[to].id, weight]);
      edgeSet.add(key1);
    }

    return { nodes, edges, sourceId, targetId };
  }
}

// ============================================================================
// NODE COMPONENT
// ============================================================================

class DijkstraNode {
  static defaults = {
    radius: 14
  };

  constructor(ctx, options = {}) {
    if (!ctx?.classes) throw new Error('DijkstraNode: ctx (PixiContext) is required');
    if (!options.container) throw new Error('DijkstraNode: options.container is required');

    this.ticker = ctx.ticker;
    this.classes = ctx.classes;
    this.gsap = ctx.gsap;
    this.container = options.container;

    this.options = { ...DijkstraNode.defaults, ...options };
    this.id = this.options.id;
    this.x = this.options.x;
    this.y = this.options.y;
    this.radius = this.options.radius;
    this.label = this.options.label;

    this._state = 'idle';
    this.dist = Infinity;
    this.prev = null;
    this._pulseTime = 0;
    this._running = false;
    this._boundUpdate = null;
    this._destroyed = false;
    this._displayObjects = [];

    this._setup();
  }

  _setup() {
    this._glow = new this.classes.Graphics();
    this._body = new this.classes.Graphics();
    this._core = new this.classes.Graphics();

    [this._glow, this._body, this._core].forEach(g => {
      g.x = this.x;
      g.y = this.y;
      this.container.addChild(g);
      this._displayObjects.push(g);
    });

    this._draw(COLORS.IDLE, false, 0);

    const fontSize = Math.max(7, Math.min(9, this.radius * 0.7));
    this._labelText = new this.classes.Text({
      text: this.label,
      style: { fontFamily: 'Arial', fontSize, fontWeight: 'bold', fill: COLORS.TEXT }
    });
    this._labelText.anchor.set(0.5);
    this._labelText.x = this.x;
    this._labelText.y = this.y;
    this.container.addChild(this._labelText);
    this._displayObjects.push(this._labelText);

    this._distText = new this.classes.Text({
      text: '∞',
      style: { fontFamily: 'Arial', fontSize: Math.max(6, fontSize - 1), fill: COLORS.QUEUED }
    });
    this._distText.anchor.set(0.5, 0);
    this._distText.x = this.x;
    this._distText.y = this.y + this.radius + 2;
    this._distText.alpha = 0.8;
    this.container.addChild(this._distText);
    this._displayObjects.push(this._distText);
  }

  _draw(col, stroke, glowAlpha) {
    this._body.clear()
      .circle(0, 0, this.radius)
      .fill({ color: col, alpha: 0.9 });
    if (stroke) {
      this._body.stroke({ width: 2, color: 0xffffff, alpha: 0.3 });
    }

    this._core.clear()
      .circle(0, 0, this.radius * 0.35)
      .fill({ color: stroke ? 0xffffff : 0x5a6a7a, alpha: 0.9 });

    this._glow.clear()
      .circle(0, 0, this.radius * 1.6)
      .fill({ color: col, alpha: glowAlpha });
  }

  setState(state) {
    this._state = state;
    const col = STATE_COLORS[state] || COLORS.IDLE;
    this._draw(col, state !== 'idle', state === 'idle' ? 0 : 0.3);
    if (state !== 'idle') {
      this._pulseTime = 0;
      this.start();
    }
  }

  setDist(d) {
    this.dist = d;
    this._distText.text = d === Infinity ? '∞' : d.toString();
  }

  start() {
    if (this._running || this._destroyed) return;
    this._running = true;
    this._boundUpdate = this._boundUpdate || this._update.bind(this);
    this.ticker.add(this._boundUpdate);
  }

  _update(ticker) {
    this._pulseTime += ticker.deltaTime * 0.1;
    const p = 1 + Math.sin(this._pulseTime * 3) * 0.06;
    this._body.scale.set(p);
    this._core.scale.set(p);
    if (this._state !== 'idle') {
      this._glow.alpha = 0.2 + Math.sin(this._pulseTime * 2) * 0.1;
    }
    if (this._pulseTime > 15) this.stop();
  }

  stop() {
    if (!this._running) return;
    this._running = false;
    this.ticker.remove(this._boundUpdate);
  }

  reset() {
    this.stop();
    this._state = 'idle';
    this.dist = Infinity;
    this.prev = null;
    this._pulseTime = 0;
    this._body.scale.set(1);
    this._core.scale.set(1);
    this.setState('idle');
    this.setDist(Infinity);
  }

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    this.stop();
    this._boundUpdate = null;

    for (const obj of this._displayObjects) {
      if (obj.parent) obj.parent.removeChild(obj);
      obj.destroy();
    }
    this._displayObjects = [];
  }
}

// ============================================================================
// EDGE COMPONENT
// ============================================================================

class DijkstraEdge {
  constructor(ctx, options = {}) {
    if (!ctx?.classes) throw new Error('DijkstraEdge: ctx (PixiContext) is required');
    if (!options.container) throw new Error('DijkstraEdge: options.container is required');

    this.ticker = ctx.ticker;
    this.classes = ctx.classes;
    this.gsap = ctx.gsap;
    this.container = options.container;

    this.from = options.from;
    this.to = options.to;
    this.weight = options.weight;

    this._state = 'idle';
    this._progress = 0;
    this._running = false;
    this._boundUpdate = null;
    this._callback = null;
    this._destroyed = false;
    this._displayObjects = [];

    this._setup();
  }

  _setup() {
    this._glow = new this.classes.Graphics();
    this._line = new this.classes.Graphics();
    this._pulse = new this.classes.Graphics();
    this._pulse.circle(0, 0, 4).fill({ color: COLORS.QUEUED, alpha: 0.9 });
    this._pulse.visible = false;

    [this._glow, this._line, this._pulse].forEach(g => {
      this.container.addChild(g);
      this._displayObjects.push(g);
    });

    this._drawLine(COLORS.EDGE, 1.5, 0.4, 0);

    const mx = (this.from.x + this.to.x) / 2;
    const my = (this.from.y + this.to.y) / 2;
    const ang = Math.atan2(this.to.y - this.from.y, this.to.x - this.from.x);
    const off = 7;

    this._weightText = new this.classes.Text({
      text: this.weight.toString(),
      style: { fontFamily: 'Arial', fontSize: 7, fill: 0x667788 }
    });
    this._weightText.anchor.set(0.5);
    this._weightText.x = mx + Math.cos(ang - Math.PI / 2) * off;
    this._weightText.y = my + Math.sin(ang - Math.PI / 2) * off;
    this._weightText.alpha = 0.6;
    this.container.addChild(this._weightText);
    this._displayObjects.push(this._weightText);
  }

  _drawLine(col, w, a, glowAlpha) {
    const x1 = this.from.x, y1 = this.from.y;
    const x2 = this.to.x, y2 = this.to.y;

    this._line.clear()
      .moveTo(x1, y1)
      .lineTo(x2, y2)
      .stroke({ width: w, color: col, alpha: a });

    this._glow.clear()
      .moveTo(x1, y1)
      .lineTo(x2, y2)
      .stroke({ width: 5, color: col, alpha: glowAlpha });
  }

  setState(state) {
    this._state = state;
    const col = state === 'path' ? COLORS.EDGE_PATH : state === 'active' ? COLORS.EDGE_ACTIVE : COLORS.EDGE;
    const w = state === 'path' ? 2.5 : state === 'active' ? 2 : 1.5;
    this._drawLine(col, w, state === 'idle' ? 0.4 : 1, state === 'idle' ? 0 : 0.2);
    this._weightText.style.fill = state === 'idle' ? 0x667788 : col;
    if (state === 'active') {
      this._progress = 0;
      this._pulse.visible = true;
      this.start();
    }
  }

  sendPulse(callback) {
    this._progress = 0;
    this._pulse.visible = true;
    this._callback = callback;
    this.start();
  }

  start() {
    if (this._running || this._destroyed) return;
    this._running = true;
    this._boundUpdate = this._boundUpdate || this._update.bind(this);
    this.ticker.add(this._boundUpdate);
  }

  _update(ticker) {
    this._progress += ticker.deltaTime * 0.05;
    if (this._progress <= 1) {
      this._pulse.x = this.from.x + (this.to.x - this.from.x) * this._progress;
      this._pulse.y = this.from.y + (this.to.y - this.from.y) * this._progress;
      this._pulse.alpha = 1 - this._progress * 0.5;
      this._pulse.scale.set(1 + Math.sin(this._progress * Math.PI) * 0.3);
    } else {
      this._pulse.visible = false;
      this.stop();
      if (this._callback) {
        this._callback();
        this._callback = null;
      }
    }
  }

  stop() {
    if (!this._running) return;
    this._running = false;
    this.ticker.remove(this._boundUpdate);
  }

  reset() {
    this.stop();
    this._state = 'idle';
    this._progress = 0;
    this._pulse.visible = false;
    this.setState('idle');
  }

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    this.stop();
    this._boundUpdate = null;

    for (const obj of this._displayObjects) {
      if (obj.parent) obj.parent.removeChild(obj);
      obj.destroy();
    }
    this._displayObjects = [];
  }
}

// ============================================================================
// PARTICLES COMPONENT (Object Pool)
// ============================================================================

class DijkstraParticles {
  static defaults = {
    poolSize: 300
  };

  constructor(ctx, options = {}) {
    if (!ctx?.classes) throw new Error('DijkstraParticles: ctx (PixiContext) is required');
    if (!options.container) throw new Error('DijkstraParticles: options.container is required');

    this.ticker = ctx.ticker;
    this.classes = ctx.classes;
    this.container = options.container;

    this.options = { ...DijkstraParticles.defaults, ...options };

    this._pool = [];
    this._active = [];
    this._running = false;
    this._boundUpdate = null;
    this._destroyed = false;

    this._setup();
  }

  _setup() {
    for (let i = 0; i < this.options.poolSize; i++) {
      const p = new this.classes.Graphics();
      p.circle(0, 0, 2).fill({ color: COLORS.QUEUED, alpha: 0.8 });
      p.visible = false;
      p._vx = 0;
      p._vy = 0;
      p._life = 0;
      p._maxLife = 0;
      p._poolIndex = i;
      this._pool.push(p);
      this.container.addChild(p);
    }
  }

  burst(x, y, count = 8, color = COLORS.QUEUED) {
    for (let i = 0; i < count; i++) {
      if (this._pool.length === 0) break;

      const p = this._pool.pop();
      const angle = (Math.PI * 2 / count) * i + Math.random() * 0.3;
      const speed = 0.6 + Math.random() * 1.2;

      p.x = x;
      p.y = y;
      p._vx = Math.cos(angle) * speed;
      p._vy = Math.sin(angle) * speed;
      p._life = p._maxLife = 20 + Math.random() * 15;
      p.visible = true;
      p.alpha = 0.8;
      p.scale.set(1);
      p.clear().circle(0, 0, 1 + Math.random() * 1.5).fill({ color, alpha: 0.9 });

      p._poolIndex = this._active.length;
      this._active.push(p);
    }

    if (!this._running && this._active.length > 0) {
      this.start();
    }
  }

  start() {
    if (this._running || this._destroyed) return;
    this._running = true;
    this._boundUpdate = this._boundUpdate || this._update.bind(this);
    this.ticker.add(this._boundUpdate);
  }

  _update(ticker) {
    const delta = ticker.deltaTime;

    for (let i = this._active.length - 1; i >= 0; i--) {
      const p = this._active[i];
      p._life -= delta;

      if (p._life <= 0) {
        // O(1) swap-and-pop
        p.visible = false;
        const last = this._active[this._active.length - 1];
        if (last !== p) {
          this._active[i] = last;
          last._poolIndex = i;
        }
        this._active.pop();
        this._pool.push(p);
        continue;
      }

      p.x += p._vx * delta;
      p.y += p._vy * delta;
      const ratio = p._life / p._maxLife;
      p.alpha = ratio * 0.7;
      p.scale.set(0.3 + ratio * 0.7);
      p._vx *= 0.96;
      p._vy *= 0.96;
    }

    if (this._active.length === 0) {
      this.stop();
    }
  }

  stop() {
    if (!this._running) return;
    this._running = false;
    this.ticker.remove(this._boundUpdate);
  }

  reset() {
    while (this._active.length > 0) {
      const p = this._active.pop();
      p.visible = false;
      this._pool.push(p);
    }
  }

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    this.stop();
    this._boundUpdate = null;

    for (const p of this._pool) {
      if (p.parent) p.parent.removeChild(p);
      p.destroy();
    }
    for (const p of this._active) {
      if (p.parent) p.parent.removeChild(p);
      p.destroy();
    }
    this._pool = [];
    this._active = [];
  }
}

// ============================================================================
// MAIN VISUALIZATION COMPONENT
// ============================================================================

class DijkstraNeuralPulseNetwork {
  static defaults = {
    width: 650,
    height: 420,
    nodeCount: 16,
    speed: 1,
    autoStart: false
  };

  constructor(ctx, options = {}) {
    if (!ctx?.classes) throw new Error('DijkstraNeuralPulseNetwork: ctx (PixiContext) is required');
    if (!ctx?.gsap) throw new Error('DijkstraNeuralPulseNetwork: ctx.gsap is required');
    if (!options.container) throw new Error('DijkstraNeuralPulseNetwork: options.container is required');

    this.ticker = ctx.ticker;
    this.classes = ctx.classes;
    this.create = ctx.create;
    this.gsap = ctx.gsap;
    this.container = options.container;
    this._ctx = ctx;

    this.options = { ...DijkstraNeuralPulseNetwork.defaults, ...options };
    this.width = this.options.width;
    this.height = this.options.height;
    this.speed = this.options.speed;

    // Signals
    this.onPathFound = new Signal();
    this.onNoPath = new Signal();
    this.onReset = new Signal();
    this.onNewGraph = new Signal();

    // State
    this._nodes = new Map();
    this._edges = [];
    this._nodeObjs = [];
    this._edgeObjs = [];
    this._pq = new PriorityQueue();
    this._visited = new Set();
    this._algorithmRunning = false;
    this._paused = false;
    this._delay = 0;
    this._running = false;
    this._boundUpdate = null;
    this._sourceId = 'A';
    this._targetId = 'P';
    this._nodeCount = this.options.nodeCount;
    this._destroyed = false;
    this._displayObjects = [];

    this._setup();
  }

  _setup() {
    // Create layers
    this._bgLayer = new this.classes.Container();
    this._edgeLayer = new this.classes.Container();
    this._nodeLayer = new this.classes.Container();
    this._particleLayer = new this.classes.Container();
    this._uiLayer = new this.classes.Container();

    [this._bgLayer, this._edgeLayer, this._nodeLayer, this._particleLayer, this._uiLayer].forEach(l => {
      this.container.addChild(l);
      this._displayObjects.push(l);
    });

    this._drawBackground();
    this._particles = new DijkstraParticles(this._ctx, { container: this._particleLayer });
    this._createUI();
    this._generateGraph();
  }

  _drawBackground() {
    this._bgLayer.removeChildren();

    const bg = new this.classes.Graphics()
      .rect(0, 0, this.width, this.height)
      .fill({ color: COLORS.BG });
    this._bgLayer.addChild(bg);

    const grid = new this.classes.Graphics();
    for (let x = 0; x <= this.width; x += 30) {
      grid.moveTo(x, 0).lineTo(x, this.height);
    }
    for (let y = 0; y <= this.height; y += 30) {
      grid.moveTo(0, y).lineTo(this.width, y);
    }
    grid.stroke({ width: 1, color: 0x2a2a3e, alpha: 0.2 });
    this._bgLayer.addChild(grid);
  }

  _getNodeRadius() {
    if (this._nodeCount <= 10) return 14;
    if (this._nodeCount <= 16) return 12;
    if (this._nodeCount <= 24) return 10;
    return 8;
  }

  _generateGraph() {
    this._clearGraph();
    const graph = GraphGenerator.generate(this._nodeCount, this.width, this.height, 40);
    this._sourceId = graph.sourceId;
    this._targetId = graph.targetId;

    const radius = this._getNodeRadius();

    graph.nodes.forEach(d => {
      const n = new DijkstraNode(this._ctx, {
        container: this._nodeLayer,
        id: d.id,
        x: d.x,
        y: d.y,
        radius,
        label: d.id
      });
      this._nodes.set(d.id, n);
      this._nodeObjs.push(n);
    });

    graph.edges.forEach(([f, t, w]) => {
      const from = this._nodes.get(f);
      const to = this._nodes.get(t);
      if (from && to) {
        const e = new DijkstraEdge(this._ctx, {
          container: this._edgeLayer,
          from,
          to,
          weight: w
        });
        this._edges.push({ from: f, to: t, edge: e });
        this._edgeObjs.push(e);
      }
    });

    this._updateInfo();
    this._reset();
  }

  _clearGraph() {
    this.stop();
    this._algorithmRunning = false;
    this._paused = false;

    this._nodeObjs.forEach(n => n.destroy());
    this._nodeObjs = [];
    this._nodes.clear();

    this._edgeObjs.forEach(e => e.destroy());
    this._edgeObjs = [];
    this._edges = [];

    this._pq.clear();
    this._visited.clear();
    this._particles.reset();
  }

  _updateInfo() {
    if (this._infoText) {
      this._infoText.text = `${this._nodes.size} nodes • ${this._edges.length} edges`;
    }
  }

  setNodeCount(count) {
    if (this._algorithmRunning) {
      this.stop();
      this._algorithmRunning = false;
    }
    this._nodeCount = count;
    this._generateGraph();
    this._nodes.forEach(n => this._particles.burst(n.x, n.y, 3, COLORS.NEW));
    this.onNewGraph.emit({ nodeCount: count });
  }

  setSpeed(speed) {
    this.speed = speed;
  }

  _createUI() {
    const px = 6, py = 6;

    // Panel background
    const panel = new this.classes.Graphics()
      .roundRect(0, 0, 200, 68, 5)
      .fill({ color: 0x0a0a15, alpha: 0.9 })
      .stroke({ width: 1, color: COLORS.QUEUED, alpha: 0.3 });
    panel.x = px;
    panel.y = py;
    this._uiLayer.addChild(panel);

    // Title
    this._titleText = new this.classes.Text({
      text: '⚡ DIJKSTRA NEURAL NET',
      style: { fontFamily: 'Arial', fontSize: 9, fontWeight: 'bold', fill: COLORS.QUEUED }
    });
    this._titleText.x = px + 6;
    this._titleText.y = py + 5;
    this._uiLayer.addChild(this._titleText);

    // Status
    this._statusText = new this.classes.Text({
      text: 'Ready',
      style: { fontFamily: 'Arial', fontSize: 8, fill: COLORS.TEXT }
    });
    this._statusText.x = px + 6;
    this._statusText.y = py + 20;
    this._uiLayer.addChild(this._statusText);

    // Info
    this._infoText = new this.classes.Text({
      text: '',
      style: { fontFamily: 'Arial', fontSize: 7, fill: 0x8899aa }
    });
    this._infoText.x = px + 6;
    this._infoText.y = py + 34;
    this._uiLayer.addChild(this._infoText);

    // Buttons
    this._startBtn = this._makeButton(px + 4, py + 47, 58, 16, '▶ START', COLORS.SOURCE, () => this._onStartClick());
    this._resetBtn = this._makeButton(px + 68, py + 47, 58, 16, '↺ RESET', COLORS.VISITED, () => this._reset());
    this._newBtn = this._makeButton(px + 132, py + 47, 62, 16, '⟳ NEW', COLORS.NEW, () => this._onNewClick());

    // Legend
    const legend = [
      [COLORS.SOURCE, 'Src'],
      [COLORS.TARGET, 'Tgt'],
      [COLORS.QUEUED, 'Queue'],
      [COLORS.VISITED, 'Visit'],
      [COLORS.PATH, 'Path']
    ];
    const lx = this.width - 48, ly = 6;
    const legendBg = new this.classes.Graphics()
      .roundRect(0, 0, 42, legend.length * 13 + 6, 4)
      .fill({ color: 0x0a0a15, alpha: 0.8 });
    legendBg.x = lx;
    legendBg.y = ly;
    this._uiLayer.addChild(legendBg);

    legend.forEach(([col, txt], i) => {
      const dot = new this.classes.Graphics().circle(0, 0, 3).fill({ color: col });
      dot.x = lx + 8;
      dot.y = ly + 10 + i * 13;
      this._uiLayer.addChild(dot);

      const t = new this.classes.Text({
        text: txt,
        style: { fontFamily: 'Arial', fontSize: 7, fill: 0xaabbcc }
      });
      t.x = lx + 15;
      t.y = ly + 5 + i * 13;
      this._uiLayer.addChild(t);
    });
  }

  _makeButton(x, y, w, h, text, color, callback) {
    const bg = new this.classes.Graphics()
      .roundRect(0, 0, w, h, 3)
      .fill({ color, alpha: 0.2 })
      .stroke({ width: 1, color, alpha: 0.8 });
    bg.x = x;
    bg.y = y;
    bg.eventMode = 'static';
    bg.cursor = 'pointer';

    bg.on('pointerover', () => {
      bg.clear()
        .roundRect(0, 0, w, h, 3)
        .fill({ color, alpha: 0.4 })
        .stroke({ width: 1, color });
    });

    bg.on('pointerout', () => {
      bg.clear()
        .roundRect(0, 0, w, h, 3)
        .fill({ color, alpha: 0.2 })
        .stroke({ width: 1, color, alpha: 0.8 });
    });

    bg.on('pointerdown', callback);
    this._uiLayer.addChild(bg);

    const label = new this.classes.Text({
      text,
      style: { fontFamily: 'Arial', fontSize: 8, fontWeight: 'bold', fill: color }
    });
    label.anchor.set(0.5);
    label.x = x + w / 2;
    label.y = y + h / 2;
    this._uiLayer.addChild(label);

    return {
      bg,
      label,
      setText: (s) => { label.text = s; },
      disable: () => { bg.alpha = 0.4; bg.eventMode = 'none'; },
      enable: () => { bg.alpha = 1; bg.eventMode = 'static'; }
    };
  }

  _onNewClick() {
    if (this._algorithmRunning) {
      this.stop();
      this._algorithmRunning = false;
    }
    this._generateGraph();
    this._nodes.forEach(n => this._particles.burst(n.x, n.y, 4, COLORS.NEW));
  }

  _onStartClick() {
    if (this._algorithmRunning) {
      this._paused = !this._paused;
      this._startBtn.setText(this._paused ? '▶ RESUME' : '⏸ PAUSE');
      this._statusText.text = this._paused ? 'Paused' : 'Running...';
    } else {
      this._startAlgorithm();
    }
  }

  _reset() {
    this.stop();
    this._algorithmRunning = false;
    this._paused = false;

    this._nodes.forEach(n => n.reset());
    this._edgeObjs.forEach(e => e.reset());
    this._particles.reset();
    this._pq.clear();
    this._visited.clear();

    const src = this._nodes.get(this._sourceId);
    const tgt = this._nodes.get(this._targetId);
    if (src) {
      src.setState('source');
      src.setDist(0);
    }
    if (tgt) tgt.setState('target');

    this._startBtn.setText('▶ START');
    this._startBtn.enable();
    this._statusText.text = 'Ready';
    this._updateInfo();

    this.onReset.emit({});
  }

  _startAlgorithm() {
    this._algorithmRunning = true;
    this._paused = false;

    const src = this._nodes.get(this._sourceId);
    if (!src) return;

    src.dist = 0;
    src.setDist(0);

    this._nodes.forEach(n => {
      if (n.id !== this._sourceId) {
        n.dist = Infinity;
        n.setDist(Infinity);
      }
      n.prev = null;
    });

    this._pq.add(this._sourceId, 0);
    this._startBtn.setText('⏸ PAUSE');
    this._statusText.text = 'Running...';
    this._infoText.text = `Finding ${this._sourceId}→${this._targetId}`;
    this.start();
  }

  start() {
    if (this._running || this._destroyed) return;
    this._running = true;
    this._boundUpdate = this._boundUpdate || this._update.bind(this);
    this.ticker.add(this._boundUpdate);
  }

  _update(ticker) {
    if (this._paused) return;
    this._delay += ticker.deltaTime * this.speed;
    if (this._delay >= 20) {
      this._delay = 0;
      this._step();
    }
  }

  _step() {
    if (this._pq.empty) {
      this._done();
      return;
    }

    const id = this._pq.pop();
    if (this._visited.has(id)) return;

    const cur = this._nodes.get(id);
    if (!cur) return;

    this._visited.add(id);
    if (id !== this._sourceId && id !== this._targetId) {
      cur.setState('visited');
    }
    this._particles.burst(cur.x, cur.y, 6, COLORS.VISITED);

    if (id === this._targetId) {
      this._found();
      return;
    }

    this._statusText.text = `Node ${id} (d=${cur.dist})`;

    this._getNeighbors(id).forEach(({ neighborId, weight, edge }) => {
      if (this._visited.has(neighborId)) return;

      const neighbor = this._nodes.get(neighborId);
      if (!neighbor) return;

      const newDist = cur.dist + weight;
      if (newDist < neighbor.dist) {
        neighbor.dist = newDist;
        neighbor.setDist(newDist);
        neighbor.prev = cur;
        if (neighborId !== this._targetId) {
          neighbor.setState('queued');
        }
        edge.setState('active');
        edge.sendPulse();
        this._pq.add(neighborId, newDist);
      }
    });
  }

  _getNeighbors(id) {
    const result = [];
    this._edges.forEach(({ from, to, edge }) => {
      if (from === id) result.push({ neighborId: to, weight: edge.weight, edge });
      else if (to === id) result.push({ neighborId: from, weight: edge.weight, edge });
    });
    return result;
  }

  _found() {
    const tgt = this._nodes.get(this._targetId);
    this._statusText.text = 'Path Found!';
    this._infoText.text = `Distance: ${tgt ? tgt.dist : '?'}`;
    setTimeout(() => this._highlightPath(), 300);
  }

  _highlightPath() {
    const path = [];
    let cur = this._nodes.get(this._targetId);
    while (cur) {
      path.unshift(cur);
      cur = cur.prev;
    }

    let delay = 0;
    path.forEach((n, i) => {
      setTimeout(() => {
        if (n.id !== this._sourceId && n.id !== this._targetId) {
          n.setState('path');
        }
        this._particles.burst(n.x, n.y, 10, COLORS.PATH);

        if (i < path.length - 1) {
          const next = path[i + 1];
          this._edges.forEach(({ from, to, edge }) => {
            if ((from === n.id && to === next.id) || (to === n.id && from === next.id)) {
              edge.setState('path');
            }
          });
        }
      }, delay);
      delay += 150;
    });

    setTimeout(() => {
      this.stop();
      this._algorithmRunning = false;
      this._startBtn.setText('✓ DONE');
      this._startBtn.disable();
      this._statusText.text = 'Complete!';
      this._infoText.text = path.map(n => n.id).join('→');
      this.onPathFound.emit({ path: path.map(n => n.id), distance: path[path.length - 1]?.dist });
    }, delay + 200);
  }

  _done() {
    this.stop();
    this._algorithmRunning = false;
    this._startBtn.setText('✗ NONE');
    this._statusText.text = 'No path found';
    this.onNoPath.emit({});
  }

  stop() {
    if (!this._running) return;
    this._running = false;
    this.ticker.remove(this._boundUpdate);
  }

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;

    this.stop();
    this._boundUpdate = null;

    this._clearGraph();
    this._particles.destroy();

    this.onPathFound.clear();
    this.onNoPath.clear();
    this.onReset.clear();
    this.onNewGraph.clear();

    for (const obj of this._displayObjects) {
      if (obj.parent) obj.parent.removeChild(obj);
      obj.destroy({ children: true });
    }
    this._displayObjects = [];
  }

  // === GETTERS ===
  get running() { return this._running; }
  get algorithmRunning() { return this._algorithmRunning; }
  get paused() { return this._paused; }
  get nodeCount() { return this._nodeCount; }
}

// ============================================================================
// CONTEXT FACTORY
// ============================================================================

function createPixiContext(pixiModule, gsapModule, app, config = {}) {
  if (!pixiModule) {
    throw new Error('PixiContext: pixiModule is required (pass PIXI global or import)');
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
      GlProgram: config.GlProgram ?? pixiModule.GlProgram,
      GpuProgram: config.GpuProgram ?? pixiModule.GpuProgram,
      Shader: config.Shader ?? pixiModule.Shader,
      Geometry: config.Geometry ?? pixiModule.Geometry,
      Mesh: config.Mesh ?? pixiModule.Mesh,
      Buffer: config.Buffer ?? pixiModule.Buffer,
      RenderTexture: config.RenderTexture ?? pixiModule.RenderTexture
    }),
    create: Object.freeze({
      container: () => new (config.Container ?? pixiModule.Container)(),
      graphics: () => new (config.Graphics ?? pixiModule.Graphics)(),
      sprite: (texture) => new (config.Sprite ?? pixiModule.Sprite)(texture),
      text: (opts) => new (config.Text ?? pixiModule.Text)(opts),
      point: (x = 0, y = 0) => new (config.Point ?? pixiModule.Point)(x, y),
      rectangle: (x, y, w, h) => new (config.Rectangle ?? pixiModule.Rectangle)(x, y, w, h)
    })
  });
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  DijkstraNeuralPulseNetwork,
  DijkstraNode,
  DijkstraEdge,
  DijkstraParticles,
  GraphGenerator,
  PriorityQueue,
  Signal,
  createPixiContext,
  COLORS,
  STATE_COLORS
};

export default DijkstraNeuralPulseNetwork;
