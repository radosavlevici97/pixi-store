/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * BIOLUMINESCENT GENESIS - Conway's Game of Life Visualization
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * A deep ocean biosphere where cellular automata simulate bioluminescent
 * microorganisms. Each cell pulses, glows, and interacts following the
 * rules of life — birth, death, and survival visualized as organic light
 * patterns in an abyssal void.
 *
 * Architecture: Pure composition with PixiContext dependency injection
 * Pattern: ctx.classes for all PIXI instantiation
 * Performance: Double-buffered grid, object pooling for particles
 *
 * @version 2.0.0
 * @license MIT
 */

// ═══════════════════════════════════════════════════════════════════════════════
// THEME CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const THEME = {
  colors: {
    background: 0x0a0e1a,      // Deep ocean black
    cellAlive: 0x00f5d4,       // Electric cyan
    cellBirth: 0x39ff14,       // Bio-green
    cellDeath: 0x9d4edd,       // Soft violet
    gridLine: 0x1a2040,        // Subtle grid
    glow: 0x00f5d4,            // Cyan glow
  },
  animation: {
    pulseSpeed: 0.05,          // Heartbeat cycle speed
    pulseMin: 0.7,             // Minimum pulse scale
    pulseMax: 1.0,             // Maximum pulse scale
    deathFadeDuration: 30,     // Frames for death fade
    birthGrowDuration: 20,     // Frames for birth animation
    generationInterval: 15,    // Frames between generations
  },
  particles: {
    maxDeathParticles: 200,    // Pool size for death particles
    particlesPerDeath: 5,      // Particles spawned per cell death
    particleLife: 60,          // Particle lifespan in frames
    particleSpeed: 1.5,        // Base particle velocity
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// DEATH PARTICLE SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * DeathParticleSystem - Spawns dissolution particles when cells die
 * Pure composition - receives ctx via constructor
 */
class DeathParticleSystem {
  /**
   * @param {Object} ctx - PixiContext with classes, ticker
   * @param {Object} options - Configuration options
   * @param {PIXI.Container} options.container - Container to add particles to
   * @param {number} [options.maxParticles=200] - Maximum particle pool size
   */
  constructor(ctx, options = {}) {
    // Validate context
    if (!ctx?.classes) throw new Error('DeathParticleSystem: ctx.classes is required');
    if (!ctx?.ticker) throw new Error('DeathParticleSystem: ctx.ticker is required');
    if (!options.container) throw new Error('DeathParticleSystem: options.container is required');
    
    // Store context references
    this.classes = ctx.classes;
    this.ticker = ctx.ticker;
    
    // Store injected dependencies
    this.container = options.container;
    
    // Merge options with defaults
    this.options = {
      maxParticles: options.maxParticles ?? THEME.particles.maxDeathParticles,
      particleLife: options.particleLife ?? THEME.particles.particleLife,
      particleSpeed: options.particleSpeed ?? THEME.particles.particleSpeed,
      ...options
    };
    
    // State flags
    this._running = false;
    this._boundUpdate = null;
    
    // Particle pools
    this._pool = [];
    this._active = [];
    
    // Initialize
    this._initPool();
  }
  
  /**
   * Pre-create all particle sprites
   * @private
   */
  _initPool() {
    for (let i = 0; i < this.options.maxParticles; i++) {
      const particle = this._createParticle();
      this._pool.push(particle);
      this.container.addChild(particle);
    }
  }
  
  /**
   * Create a single particle sprite (PixiJS v8 API)
   * @private
   * @returns {PIXI.Graphics} Particle graphics object
   */
  _createParticle() {
    const g = new this.classes.Graphics();
    g.circle(0, 0, 2);
    g.fill({ color: THEME.colors.cellDeath, alpha: 0.8 });
    
    // Attach particle data directly to avoid Map lookups
    g._vx = 0;
    g._vy = 0;
    g._life = 0;
    g._maxLife = 0;
    g.visible = false;
    
    return g;
  }
  
  /**
   * Spawn particles at a position (cell death effect)
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {number} [count=5] - Number of particles to spawn
   */
  emit(x, y, count = THEME.particles.particlesPerDeath) {
    for (let i = 0; i < count; i++) {
      if (this._pool.length === 0) return;
      
      const p = this._pool.pop();
      p.visible = true;
      p.x = x;
      p.y = y;
      p.alpha = 1;
      p.scale.set(1);
      
      // Random velocity in all directions
      const angle = Math.random() * Math.PI * 2;
      const speed = this.options.particleSpeed * (0.5 + Math.random() * 0.5);
      p._vx = Math.cos(angle) * speed;
      p._vy = Math.sin(angle) * speed;
      p._life = this.options.particleLife;
      p._maxLife = this.options.particleLife;
      
      this._active.push(p);
    }
  }
  
  /**
   * Update all active particles
   * @param {PIXI.Ticker} ticker - PixiJS ticker
   */
  update(ticker) {
    const delta = ticker.deltaTime;
    
    // Iterate backwards for safe removal using swap-and-pop (O(1) removal)
    for (let i = this._active.length - 1; i >= 0; i--) {
      const p = this._active[i];
      p._life -= delta;
      
      if (p._life <= 0) {
        // Return to pool using O(1) swap-and-pop pattern
        p.visible = false;
        const lastIdx = this._active.length - 1;
        if (i !== lastIdx) {
          this._active[i] = this._active[lastIdx];
        }
        this._active.pop();
        this._pool.push(p);
        continue;
      }
      
      // Update position with delta time
      p.x += p._vx * delta;
      p.y += p._vy * delta;
      
      // Apply drag
      p._vx *= 0.98;
      p._vy *= 0.98;
      
      // Fade out based on life
      const lifeRatio = p._life / p._maxLife;
      p.alpha = lifeRatio;
      p.scale.set(0.5 + lifeRatio * 0.5);
    }
  }
  
  /**
   * Start the particle system
   */
  start() {
    if (this._running) return;
    this._running = true;
    this._boundUpdate = this._boundUpdate || this.update.bind(this);
    this.ticker.add(this._boundUpdate);
  }
  
  /**
   * Stop the particle system
   */
  stop() {
    if (!this._running) return;
    this._running = false;
    this.ticker.remove(this._boundUpdate);
  }
  
  /**
   * Reset all particles to pool
   */
  reset() {
    while (this._active.length > 0) {
      const p = this._active.pop();
      p.visible = false;
      this._pool.push(p);
    }
  }
  
  /**
   * Clean up and destroy
   */
  destroy() {
    this.stop();
    this.reset();
    
    for (const p of this._pool) {
      if (p.parent) p.parent.removeChild(p);
      p.destroy();
    }
    
    this._pool = [];
    this._active = [];
    this._boundUpdate = null;
  }
  
  get activeCount() { return this._active.length; }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CELL VISUAL COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * CellGrid - Manages the visual grid of cells
 * Pure composition - receives ctx via constructor
 */
class CellGrid {
  /**
   * @param {Object} ctx - PixiContext with classes, ticker
   * @param {Object} options - Configuration options
   * @param {PIXI.Container} options.container - Container for cell graphics
   * @param {number} options.cols - Number of columns
   * @param {number} options.rows - Number of rows
   * @param {number} options.cellSize - Size of each cell in pixels
   */
  constructor(ctx, options = {}) {
    // Validate context
    if (!ctx?.classes) throw new Error('CellGrid: ctx.classes is required');
    if (!ctx?.ticker) throw new Error('CellGrid: ctx.ticker is required');
    if (!options.container) throw new Error('CellGrid: options.container is required');
    
    // Store context references
    this.classes = ctx.classes;
    this.ticker = ctx.ticker;
    
    this.container = options.container;
    
    this.options = {
      cols: options.cols ?? 80,
      rows: options.rows ?? 60,
      cellSize: options.cellSize ?? 10,
      padding: options.padding ?? 1,
      ...options
    };
    
    this._running = false;
    this._boundUpdate = null;
    this._time = 0;
    
    // Cell visual storage
    this._cells = [];
    this._cellStates = []; // Animation states
    
    this.setup();
  }
  
  /**
   * Initialize the visual grid (PixiJS v8 API)
   */
  setup() {
    const { cols, rows, cellSize, padding } = this.options;
    const innerSize = cellSize - padding * 2;
    
    for (let y = 0; y < rows; y++) {
      this._cells[y] = [];
      this._cellStates[y] = [];
      
      for (let x = 0; x < cols; x++) {
        const g = new this.classes.Graphics();
        g.roundRect(
          -innerSize / 2,
          -innerSize / 2,
          innerSize,
          innerSize,
          2
        );
        g.fill(THEME.colors.cellAlive);
        
        g.x = x * cellSize + cellSize / 2;
        g.y = y * cellSize + cellSize / 2;
        g.alpha = 0;
        g.visible = false;
        
        this._cells[y][x] = g;
        this._cellStates[y][x] = {
          alive: false,
          animating: false,
          animType: null, // 'birth' | 'death'
          animProgress: 0,
        };
        
        this.container.addChild(g);
      }
    }
  }
  
  /**
   * Update cell visual state
   * @param {number} x - Column
   * @param {number} y - Row
   * @param {boolean} alive - Whether cell is alive
   * @param {boolean} [animate=true] - Whether to animate the transition
   */
  setCellState(x, y, alive, animate = true) {
    if (x < 0 || x >= this.options.cols || y < 0 || y >= this.options.rows) return;
    
    const state = this._cellStates[y][x];
    const wasAlive = state.alive;
    
    if (wasAlive === alive) return;
    
    state.alive = alive;
    
    if (animate) {
      state.animating = true;
      state.animType = alive ? 'birth' : 'death';
      state.animProgress = 0;
    } else {
      // Instant state change
      const cell = this._cells[y][x];
      cell.visible = alive;
      cell.alpha = alive ? 1 : 0;
      cell.scale.set(1);
    }
  }
  
  /**
   * Get cell position in world coordinates
   * @param {number} x - Column
   * @param {number} y - Row
   * @returns {{x: number, y: number}} World position
   */
  getCellPosition(x, y) {
    const { cellSize } = this.options;
    return {
      x: x * cellSize + cellSize / 2,
      y: y * cellSize + cellSize / 2
    };
  }
  
  /**
   * Update cell animations
   * @param {PIXI.Ticker} ticker - PixiJS ticker
   */
  update(ticker) {
    const delta = ticker.deltaTime;
    this._time += delta * THEME.animation.pulseSpeed;
    
    // Global pulse for all living cells
    const pulseT = (Math.sin(this._time) + 1) / 2;
    const pulseScale = THEME.animation.pulseMin + 
      pulseT * (THEME.animation.pulseMax - THEME.animation.pulseMin);
    
    for (let y = 0; y < this.options.rows; y++) {
      for (let x = 0; x < this.options.cols; x++) {
        const cell = this._cells[y][x];
        const state = this._cellStates[y][x];
        
        if (state.animating) {
          state.animProgress += delta;
          
          if (state.animType === 'birth') {
            const duration = THEME.animation.birthGrowDuration;
            const t = Math.min(state.animProgress / duration, 1);
            const eased = this._easeOutBack(t);
            
            cell.visible = true;
            cell.alpha = t;
            cell.scale.set(eased);
            cell.tint = this._lerpColor(THEME.colors.cellBirth, THEME.colors.cellAlive, t);
            
            if (t >= 1) {
              state.animating = false;
              cell.tint = THEME.colors.cellAlive;
            }
          } else if (state.animType === 'death') {
            const duration = THEME.animation.deathFadeDuration;
            const t = Math.min(state.animProgress / duration, 1);
            
            cell.alpha = 1 - t;
            cell.scale.set(1 - t * 0.5);
            cell.tint = this._lerpColor(THEME.colors.cellAlive, THEME.colors.cellDeath, t);
            
            if (t >= 1) {
              state.animating = false;
              cell.visible = false;
              cell.alpha = 0;
            }
          }
        } else if (state.alive) {
          // Apply pulse to living, non-animating cells
          cell.scale.set(pulseScale);
        }
      }
    }
  }
  
  /**
   * Ease out back easing function
   * @private
   */
  _easeOutBack(t) {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }
  
  /**
   * Linear interpolate between two colors
   * @private
   */
  _lerpColor(color1, color2, t) {
    const r1 = (color1 >> 16) & 0xff;
    const g1 = (color1 >> 8) & 0xff;
    const b1 = color1 & 0xff;
    
    const r2 = (color2 >> 16) & 0xff;
    const g2 = (color2 >> 8) & 0xff;
    const b2 = color2 & 0xff;
    
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    
    return (r << 16) | (g << 8) | b;
  }
  
  /**
   * Start animation updates
   */
  start() {
    if (this._running) return;
    this._running = true;
    this._boundUpdate = this._boundUpdate || this.update.bind(this);
    this.ticker.add(this._boundUpdate);
  }
  
  /**
   * Stop animation updates
   */
  stop() {
    if (!this._running) return;
    this._running = false;
    this.ticker.remove(this._boundUpdate);
  }
  
  /**
   * Reset all cells to dead state
   */
  reset() {
    for (let y = 0; y < this.options.rows; y++) {
      for (let x = 0; x < this.options.cols; x++) {
        const cell = this._cells[y][x];
        const state = this._cellStates[y][x];
        
        cell.visible = false;
        cell.alpha = 0;
        cell.scale.set(1);
        
        state.alive = false;
        state.animating = false;
        state.animProgress = 0;
      }
    }
  }
  
  /**
   * Clean up and destroy
   */
  destroy() {
    this.stop();
    
    for (let y = 0; y < this.options.rows; y++) {
      for (let x = 0; x < this.options.cols; x++) {
        const cell = this._cells[y][x];
        if (cell.parent) cell.parent.removeChild(cell);
        cell.destroy();
      }
    }
    
    this._cells = [];
    this._cellStates = [];
    this._boundUpdate = null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN GAME OF LIFE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GameOfLife - Conway's Game of Life simulation with bioluminescent visuals
 * Pure composition - receives ctx via constructor
 * 
 * Rules:
 * 1. Any live cell with fewer than two live neighbours dies (underpopulation)
 * 2. Any live cell with two or three live neighbours lives
 * 3. Any live cell with more than three live neighbours dies (overpopulation)
 * 4. Any dead cell with exactly three live neighbours becomes alive (reproduction)
 */
class GameOfLife {
  /**
   * Lifecycle descriptor for demoRunner.
   * Declares that randomize(0.3) must be called before start().
   */
  static lifecycle = {
    init: [{ method: 'randomize', args: [0.3] }]
  };

  /**
   * @param {Object} ctx - PixiContext with classes, ticker
   * @param {Object} options - Configuration options
   * @param {PIXI.Container} options.container - Main container for all visuals
   * @param {number} [options.cols=80] - Grid columns
   * @param {number} [options.rows=60] - Grid rows
   * @param {number} [options.cellSize=10] - Cell size in pixels
   * @param {number} [options.generationInterval=15] - Frames between generations
   * @param {Function} [options.onGeneration] - Callback on each generation
   * @param {Function} [options.onCellDeath] - Callback when cell dies (x, y, worldX, worldY)
   */
  constructor(ctx, options = {}) {
    // Validate context
    if (!ctx?.classes) throw new Error('GameOfLife: ctx.classes is required');
    if (!ctx?.ticker) throw new Error('GameOfLife: ctx.ticker is required');
    if (!options.container) throw new Error('GameOfLife: options.container is required');
    
    // Store context references
    this.classes = ctx.classes;
    this.ticker = ctx.ticker;
    this._ctx = ctx; // Store full context for child components
    
    // Store injected dependencies
    this.container = options.container;
    
    // Merge options with defaults
    this.options = {
      cols: options.cols ?? 80,
      rows: options.rows ?? 60,
      cellSize: options.cellSize ?? 10,
      generationInterval: options.generationInterval ?? THEME.animation.generationInterval,
      onGeneration: options.onGeneration ?? null,
      onCellDeath: options.onCellDeath ?? null,
      onCellBirth: options.onCellBirth ?? null,
      ...options
    };
    
    // State flags
    this._running = false;
    this._paused = false;
    this._boundUpdate = null;
    
    // Timing
    this._frameCount = 0;
    this._generation = 0;
    
    // Double-buffered grid (for computation)
    this._gridA = [];
    this._gridB = [];
    this._currentGrid = null;
    this._nextGrid = null;
    
    // Sub-containers for layering
    this._gridContainer = new this.classes.Container();
    this._cellContainer = new this.classes.Container();
    this._particleContainer = new this.classes.Container();
    
    // Child components
    this._cellGrid = null;
    this._particles = null;
    
    // Statistics
    this._stats = {
      generation: 0,
      population: 0,
      births: 0,
      deaths: 0,
    };
    
    // Initialize
    this.setup();
  }
  
  /**
   * Initialize all visual components
   */
  setup() {
    const { cols, rows } = this.options;
    
    // Add sub-containers in z-order
    this.container.addChild(this._gridContainer);
    this.container.addChild(this._cellContainer);
    this.container.addChild(this._particleContainer);
    
    // Initialize double-buffered grids
    for (let y = 0; y < rows; y++) {
      this._gridA[y] = new Uint8Array(cols);
      this._gridB[y] = new Uint8Array(cols);
    }
    this._currentGrid = this._gridA;
    this._nextGrid = this._gridB;
    
    // Draw background grid lines
    this._drawGrid();
    
    // Create cell visuals component
    this._cellGrid = new CellGrid(this._ctx, {
      container: this._cellContainer,
      cols: cols,
      rows: rows,
      cellSize: this.options.cellSize,
    });
    
    // Create death particle system
    this._particles = new DeathParticleSystem(this._ctx, {
      container: this._particleContainer,
    });
  }
  
  /**
   * Draw the background grid lines (PixiJS v8 API)
   * @private
   */
  _drawGrid() {
    const { cols, rows, cellSize } = this.options;
    const g = new this.classes.Graphics();
    
    // Draw all grid lines
    // Vertical lines
    for (let x = 0; x <= cols; x++) {
      g.moveTo(x * cellSize, 0);
      g.lineTo(x * cellSize, rows * cellSize);
    }
    
    // Horizontal lines
    for (let y = 0; y <= rows; y++) {
      g.moveTo(0, y * cellSize);
      g.lineTo(cols * cellSize, y * cellSize);
    }
    
    // Apply stroke style (v8 API)
    g.stroke({ width: 0.5, color: THEME.colors.gridLine, alpha: 0.3 });
    
    this._gridContainer.addChild(g);
  }
  
  /**
   * Set a cell's alive state in the logical grid
   * @param {number} x - Column
   * @param {number} y - Row
   * @param {boolean} alive - Whether cell should be alive
   * @param {boolean} [updateVisual=true] - Whether to update visual immediately
   */
  setCell(x, y, alive, updateVisual = true) {
    if (x < 0 || x >= this.options.cols || y < 0 || y >= this.options.rows) return;
    
    this._currentGrid[y][x] = alive ? 1 : 0;
    
    if (updateVisual) {
      this._cellGrid.setCellState(x, y, alive, false);
    }
  }
  
  /**
   * Toggle a cell's state
   * @param {number} x - Column
   * @param {number} y - Row
   */
  toggleCell(x, y) {
    if (x < 0 || x >= this.options.cols || y < 0 || y >= this.options.rows) return;
    
    const alive = this._currentGrid[y][x] === 1;
    this.setCell(x, y, !alive);
  }
  
  /**
   * Get cell state
   * @param {number} x - Column
   * @param {number} y - Row
   * @returns {boolean} Whether cell is alive
   */
  getCell(x, y) {
    if (x < 0 || x >= this.options.cols || y < 0 || y >= this.options.rows) return false;
    return this._currentGrid[y][x] === 1;
  }
  
  /**
   * Count live neighbors (with wrapping for toroidal topology)
   * @private
   * @param {number} x - Column
   * @param {number} y - Row
   * @returns {number} Count of live neighbors
   */
  _countNeighbors(x, y) {
    const { cols, rows } = this.options;
    let count = 0;
    
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        
        // Wrap around edges (toroidal)
        const nx = (x + dx + cols) % cols;
        const ny = (y + dy + rows) % rows;
        
        count += this._currentGrid[ny][nx];
      }
    }
    
    return count;
  }
  
  /**
   * Compute the next generation
   */
  step() {
    const { cols, rows } = this.options;
    let births = 0;
    let deaths = 0;
    let population = 0;
    
    // Compute next state for all cells
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const alive = this._currentGrid[y][x] === 1;
        const neighbors = this._countNeighbors(x, y);
        
        let nextState = false;
        
        if (alive) {
          // Rules 1-3: Survival
          nextState = neighbors === 2 || neighbors === 3;
        } else {
          // Rule 4: Reproduction
          nextState = neighbors === 3;
        }
        
        this._nextGrid[y][x] = nextState ? 1 : 0;
        
        // Track changes
        if (nextState) population++;
        
        if (!alive && nextState) {
          births++;
          const pos = this._cellGrid.getCellPosition(x, y);
          if (this.options.onCellBirth) {
            this.options.onCellBirth(x, y, pos.x, pos.y);
          }
        } else if (alive && !nextState) {
          deaths++;
          const pos = this._cellGrid.getCellPosition(x, y);
          
          // Emit death particles
          this._particles.emit(pos.x, pos.y);
          
          if (this.options.onCellDeath) {
            this.options.onCellDeath(x, y, pos.x, pos.y);
          }
        }
      }
    }
    
    // Swap buffers
    const temp = this._currentGrid;
    this._currentGrid = this._nextGrid;
    this._nextGrid = temp;
    
    // Update visuals
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const alive = this._currentGrid[y][x] === 1;
        this._cellGrid.setCellState(x, y, alive);
      }
    }
    
    // Update stats
    this._generation++;
    this._stats.generation = this._generation;
    this._stats.population = population;
    this._stats.births = births;
    this._stats.deaths = deaths;
    
    // Callback
    if (this.options.onGeneration) {
      this.options.onGeneration(this._stats);
    }
  }
  
  /**
   * Main update loop
   * @param {PIXI.Ticker} ticker - PixiJS ticker
   */
  update(ticker) {
    if (this._paused) return;
    
    this._frameCount++;
    
    if (this._frameCount >= this.options.generationInterval) {
      this._frameCount = 0;
      this.step();
    }
  }
  
  /**
   * Start the simulation
   */
  start() {
    if (this._running) return;
    this._running = true;
    this._paused = false;
    
    this._boundUpdate = this._boundUpdate || this.update.bind(this);
    this.ticker.add(this._boundUpdate);
    
    this._cellGrid.start();
    this._particles.start();
  }
  
  /**
   * Stop the simulation
   */
  stop() {
    if (!this._running) return;
    this._running = false;
    
    this.ticker.remove(this._boundUpdate);
    
    this._cellGrid.stop();
    this._particles.stop();
  }
  
  /**
   * Pause/unpause the simulation (keeps animations running)
   */
  pause() {
    this._paused = !this._paused;
  }
  
  /**
   * Check if simulation is paused
   */
  get paused() {
    return this._paused;
  }
  
  /**
   * Clear all cells
   */
  clear() {
    const { cols, rows } = this.options;
    
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        this._currentGrid[y][x] = 0;
        this._nextGrid[y][x] = 0;
      }
    }
    
    this._cellGrid.reset();
    this._particles.reset();
    this._generation = 0;
    this._stats.generation = 0;
    this._stats.population = 0;
  }
  
  /**
   * Randomize the grid
   * @param {number} [density=0.3] - Probability of cell being alive (0-1)
   */
  randomize(density = 0.3) {
    const { cols, rows } = this.options;
    
    this.clear();
    
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (Math.random() < density) {
          this.setCell(x, y, true);
        }
      }
    }
  }
  
  /**
   * Load a pattern at a position
   * @param {Array<Array<number>>} pattern - 2D array of 0s and 1s
   * @param {number} [offsetX=0] - X offset
   * @param {number} [offsetY=0] - Y offset
   * @returns {boolean} Whether pattern was loaded successfully
   */
  loadPattern(pattern, offsetX = 0, offsetY = 0) {
    // Defensive validation
    if (!Array.isArray(pattern) || pattern.length === 0) {
      console.warn('GameOfLife: Invalid pattern provided - must be non-empty 2D array');
      return false;
    }
    
    for (let y = 0; y < pattern.length; y++) {
      const row = pattern[y];
      if (!Array.isArray(row)) continue; // Skip malformed rows
      
      for (let x = 0; x < row.length; x++) {
        if (row[x] === 1) {
          this.setCell(x + offsetX, y + offsetY, true);
        }
      }
    }
    return true;
  }
  
  /**
   * Convert screen coordinates to grid coordinates
   * @param {number} screenX - Screen X position
   * @param {number} screenY - Screen Y position
   * @returns {{x: number, y: number}} Grid coordinates
   */
  screenToGrid(screenX, screenY) {
    const { cellSize } = this.options;
    return {
      x: Math.floor(screenX / cellSize),
      y: Math.floor(screenY / cellSize)
    };
  }
  
  /**
   * Get current statistics
   * @returns {Object} Stats object
   */
  get stats() {
    return { ...this._stats };
  }
  
  /**
   * Get generation count
   */
  get generation() {
    return this._generation;
  }
  
  /**
   * Set generation interval
   */
  set speed(value) {
    this.options.generationInterval = Math.max(1, Math.round(value));
  }
  
  get speed() {
    return this.options.generationInterval;
  }
  
  /**
   * Get grid dimensions
   */
  get width() {
    return this.options.cols * this.options.cellSize;
  }
  
  get height() {
    return this.options.rows * this.options.cellSize;
  }
  
  /**
   * Clean up and destroy
   */
  destroy() {
    this.stop();
    
    if (this._cellGrid) {
      this._cellGrid.destroy();
      this._cellGrid = null;
    }
    
    if (this._particles) {
      this._particles.destroy();
      this._particles = null;
    }
    
    // Remove containers
    if (this._gridContainer.parent) {
      this._gridContainer.parent.removeChild(this._gridContainer);
    }
    if (this._cellContainer.parent) {
      this._cellContainer.parent.removeChild(this._cellContainer);
    }
    if (this._particleContainer.parent) {
      this._particleContainer.parent.removeChild(this._particleContainer);
    }
    
    this._gridContainer.destroy({ children: true });
    this._cellContainer.destroy({ children: true });
    this._particleContainer.destroy({ children: true });
    
    this._gridA = [];
    this._gridB = [];
    this._boundUpdate = null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLASSIC PATTERNS
// ═══════════════════════════════════════════════════════════════════════════════

const PATTERNS = {
  // Oscillators
  blinker: [
    [1, 1, 1]
  ],
  
  toad: [
    [0, 1, 1, 1],
    [1, 1, 1, 0]
  ],
  
  beacon: [
    [1, 1, 0, 0],
    [1, 0, 0, 0],
    [0, 0, 0, 1],
    [0, 0, 1, 1]
  ],
  
  pulsar: [
    [0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1],
    [0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0],
    [1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0]
  ],
  
  // Spaceships
  glider: [
    [0, 1, 0],
    [0, 0, 1],
    [1, 1, 1]
  ],
  
  lwss: [ // Lightweight spaceship
    [0, 1, 0, 0, 1],
    [1, 0, 0, 0, 0],
    [1, 0, 0, 0, 1],
    [1, 1, 1, 1, 0]
  ],
  
  // Methuselahs (long-lived patterns)
  rPentomino: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 1, 0]
  ],
  
  acorn: [
    [0, 1, 0, 0, 0, 0, 0],
    [0, 0, 0, 1, 0, 0, 0],
    [1, 1, 0, 0, 1, 1, 1]
  ],
  
  // Guns
  gliderGun: [
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,1,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,1,1],
    [0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,1,1],
    [1,1,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [1,1,0,0,0,0,0,0,0,0,1,0,0,0,1,0,1,1,0,0,0,0,1,0,1,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
  ],
  
  // Still lifes
  block: [
    [1, 1],
    [1, 1]
  ],
  
  beehive: [
    [0, 1, 1, 0],
    [1, 0, 0, 1],
    [0, 1, 1, 0]
  ],
  
  loaf: [
    [0, 1, 1, 0],
    [1, 0, 0, 1],
    [0, 1, 0, 1],
    [0, 0, 1, 0]
  ],
  
  boat: [
    [1, 1, 0],
    [1, 0, 1],
    [0, 1, 0]
  ]
};

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export { 
  GameOfLife, 
  CellGrid, 
  DeathParticleSystem, 
  PATTERNS, 
  THEME 
};
export default GameOfLife;
