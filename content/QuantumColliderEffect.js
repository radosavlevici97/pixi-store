/**
 * QuantumColliderEffect - Particle Collider Visualization
 *
 * Creates a quantum singularity effect where subatomic particles (quarks, gluons,
 * exotic particles) orbit at high speeds leaving colorful trails. Features collision
 * detection with spark bursts and energy ring pulses.
 *
 * Pure composition - receives ctx (PixiContext) via constructor, NEVER extends PIXI objects.
 * Uses ctx.classes instead of PIXI. directly.
 *
 * The effect automatically centers itself within the provided width/height bounds
 * and scales the orbit radii proportionally to fit the container.
 *
 * @example
 * const effect = new QuantumColliderEffect(ctx, {
 *   container: myContainer,
 *   width: 800,
 *   height: 600,
 *   particleCount: 80
 * });
 * effect.start();
 */
class QuantumColliderEffect {
  /**
   * Static defaults for option merging.
   * Note: centerX, centerY, and orbit radii are calculated from width/height if not provided.
   */
  static defaults = {
    width: 800,
    height: 600,
    singularityRadius: null, // Calculated as minDimension * 0.04
    particleCount: 80,
    minOrbitRadius: null,    // Calculated as minDimension * 0.08
    maxOrbitRadius: null,    // Calculated as minDimension * 0.4
    baseSpeed: 0.025,
    trailLength: 25,
    ringCount: 4,
    collisionsEnabled: true,
    autoStart: false,
    // Acceleration settings
    minSpeedMultiplier: 0.05,  // Starting speed (5% of base - very slow)
    maxSpeedMultiplier: 2.0,   // Maximum speed (200% of base - medium-high, FPS-friendly)
    accelerationRate: 0.0033,  // Ramps up over ~5 seconds at 60fps (1/300)
    accelerationCurve: 'ease', // 'linear' or 'ease' (ease-in-out)
  };

  /**
   * @param {PixiContext} ctx - Context from createPixiContext()
   * @param {Object} options - Configuration options
   * @param {PIXI.Container} options.container - Container to add children to
   * @param {number} [options.width=800] - Effect bounds width (used to calculate center)
   * @param {number} [options.height=600] - Effect bounds height (used to calculate center)
   * @param {number} [options.singularityRadius] - Radius of central void (default: minDimension * 0.04)
   * @param {number} [options.particleCount=80] - Number of orbiting particles
   * @param {number} [options.minOrbitRadius] - Minimum orbital distance (default: minDimension * 0.08)
   * @param {number} [options.maxOrbitRadius] - Maximum orbital distance (default: minDimension * 0.4)
   * @param {number} [options.baseSpeed=0.025] - Base orbital speed
   * @param {number} [options.trailLength=25] - Number of trail segments per particle
   * @param {number} [options.ringCount=4] - Number of energy rings
   * @param {boolean} [options.collisionsEnabled=true] - Enable collision sparks
   * @param {boolean} [options.autoStart=false] - Start animation immediately
   */
  constructor(ctx, options = {}) {
    // Validate context
    if (!ctx?.classes) {
      throw new Error('QuantumColliderEffect: ctx.classes is required (pass PixiContext)');
    }
    if (!ctx?.ticker) {
      throw new Error('QuantumColliderEffect: ctx.ticker is required');
    }
    if (!options.container) {
      throw new Error('QuantumColliderEffect: options.container is required');
    }

    // Store context references
    this.ticker = ctx.ticker;
    this.classes = ctx.classes;

    // Store container
    this.container = options.container;

    // Merge options with defaults
    this.options = { ...QuantumColliderEffect.defaults, ...options };

    // Calculate center and radii from dimensions if not explicitly provided
    const width = this.options.width;
    const height = this.options.height;
    const minDimension = Math.min(width, height);

    // Calculate center (always based on dimensions)
    this.options.centerX = width / 2;
    this.options.centerY = height / 2;

    // Calculate radii proportionally if not explicitly provided
    if (this.options.singularityRadius === null) {
      this.options.singularityRadius = minDimension * 0.04;
    }
    if (this.options.minOrbitRadius === null) {
      this.options.minOrbitRadius = minDimension * 0.08;
    }
    if (this.options.maxOrbitRadius === null) {
      this.options.maxOrbitRadius = minDimension * 0.4;
    }
    
    // Particle type definitions (quantum chromodynamics inspired)
    this.particleTypes = [
      { name: 'quark-up', color: 0x0066FF, speed: 1.2, size: 1.0, charge: 2/3 },
      { name: 'quark-down', color: 0x00AAFF, speed: 1.1, size: 0.9, charge: -1/3 },
      { name: 'quark-strange', color: 0x00FFAA, speed: 1.0, size: 1.1, charge: -1/3 },
      { name: 'gluon', color: 0xFF00FF, speed: 1.5, size: 0.7, charge: 0 },
      { name: 'antiquark', color: 0xFFD000, speed: 1.3, size: 1.0, charge: -2/3 },
      { name: 'photon', color: 0xFFFFFF, speed: 2.0, size: 0.5, charge: 0 },
      { name: 'electron', color: 0xFF6600, speed: 0.9, size: 0.6, charge: -1 },
      { name: 'positron', color: 0x66FF00, speed: 0.9, size: 0.6, charge: 1 }
    ];
    
    // State
    this._running = false;
    this._destroyed = false;
    this._boundUpdate = null;
    this._time = 0;
    this._lastCollisionCheck = 0;

    // Speed acceleration state
    this._speedProgress = 0; // 0 to 1, representing progress through acceleration
    this._currentSpeedMultiplier = this.options.minSpeedMultiplier;
    
    // Storage
    this._displayObjects = [];
    this._particles = [];
    this._sparks = [];
    this._sparkPool = [];
    
    // Reusable buffers (zero GC)
    this._collisionPairs = [];
    
    // Containers
    this._trailContainer = null;
    this._ringContainer = null;
    this._coreContainer = null;
    this._particleContainer = null;
    this._sparkContainer = null;
    
    // Graphics for trails (reused)
    this._trailGraphics = null;
    
    this._setup();
    
    if (this.options.autoStart) {
      this.start();
    }
  }
  
  /**
   * Initialize visual elements
   */
  _setup() {
    const { particleCount } = this.options;
    
    // Create layered containers using ctx.classes
    this._trailContainer = new this.classes.Container();
    this._ringContainer = new this.classes.Container();
    this._coreContainer = new this.classes.Container();
    this._particleContainer = new this.classes.Container();
    this._sparkContainer = new this.classes.Container();
    
    this.container.addChild(this._trailContainer);
    this.container.addChild(this._ringContainer);
    this.container.addChild(this._coreContainer);
    this.container.addChild(this._particleContainer);
    this.container.addChild(this._sparkContainer);
    
    this._displayObjects.push(
      this._trailContainer,
      this._ringContainer,
      this._coreContainer,
      this._particleContainer,
      this._sparkContainer
    );
    
    // Create trail graphics (single Graphics object for all trails)
    this._trailGraphics = new this.classes.Graphics();
    this._trailContainer.addChild(this._trailGraphics);
    
    // Create energy rings
    this._createEnergyRings();
    
    // Create central singularity
    this._createSingularity();
    
    // Create particle texture
    this._particleTexture = this._createParticleTexture();
    
    // Create spark texture
    this._sparkTexture = this._createSparkTexture();
    
    // Create particles
    this._createParticles(particleCount);
    
    // Create spark pool
    this._createSparkPool(50);
  }
  
  /**
   * Create energy rings around singularity
   */
  _createEnergyRings() {
    const { centerX, centerY, singularityRadius, ringCount, maxOrbitRadius } = this.options;
    
    for (let i = 0; i < ringCount; i++) {
      const ring = new this.classes.Graphics();
      const radius = singularityRadius + ((maxOrbitRadius - singularityRadius) / ringCount) * (i + 1);
      
      // Alternating colors
      const ringColors = [0x0066FF, 0xFF00FF, 0x00FFAA, 0xFFD000];
      const color = ringColors[i % ringColors.length];
      
      ring.setStrokeStyle({
        width: 1,
        color: color,
        alpha: 0.15 - (i * 0.03)
      });
      
      ring.circle(centerX, centerY, radius);
      ring.stroke();
      
      // Store for animation
      ring._baseRadius = radius;
      ring._pulsePhase = (i / ringCount) * Math.PI * 2;
      
      this._ringContainer.addChild(ring);
    }
  }
  
  /**
   * Create central quantum singularity
   */
  _createSingularity() {
    const { centerX, centerY, singularityRadius } = this.options;
    
    const core = new this.classes.Graphics();
    
    // Outer glow ring
    core.setStrokeStyle({ width: 2, color: 0x0066FF, alpha: 0.3 });
    core.circle(centerX, centerY, singularityRadius + 8);
    core.stroke();
    
    // Inner glow ring
    core.setStrokeStyle({ width: 1, color: 0xFF00FF, alpha: 0.4 });
    core.circle(centerX, centerY, singularityRadius + 4);
    core.stroke();
    
    // Main void
    core.fill({ color: 0x000000, alpha: 1 });
    core.circle(centerX, centerY, singularityRadius);
    core.fill();
    
    // Inner void (darker)
    core.fill({ color: 0x000005, alpha: 1 });
    core.circle(centerX, centerY, singularityRadius * 0.6);
    core.fill();
    
    // Tiny quantum fluctuation point
    core.fill({ color: 0x0033AA, alpha: 0.6 });
    core.circle(centerX, centerY, 2);
    core.fill();
    
    this._coreContainer.addChild(core);
  }
  
  /**
   * Create particle texture (small glowing point)
   * @returns {PIXI.Texture}
   */
  _createParticleTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    
    const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.8)');
    gradient.addColorStop(0.6, 'rgba(200, 200, 255, 0.3)');
    gradient.addColorStop(1, 'rgba(100, 100, 255, 0)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 32, 32);
    
    // Use classes.Texture if available, otherwise fall back
    if (this.classes.Texture?.from) {
      return this.classes.Texture.from(canvas);
    }
    // Fallback for environments where Texture.from is static
    return PIXI.Texture.from(canvas);
  }
  
  /**
   * Create spark texture for collisions
   * @returns {PIXI.Texture}
   */
  _createSparkTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');
    
    const gradient = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.5, 'rgba(255, 200, 100, 0.6)');
    gradient.addColorStop(1, 'rgba(255, 100, 50, 0)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 16, 16);
    
    // Use classes.Texture if available, otherwise fall back
    if (this.classes.Texture?.from) {
      return this.classes.Texture.from(canvas);
    }
    // Fallback for environments where Texture.from is static
    return PIXI.Texture.from(canvas);
  }
  
  /**
   * Create orbiting particles
   * @param {number} count
   */
  _createParticles(count) {
    const { minOrbitRadius, maxOrbitRadius, baseSpeed, trailLength } = this.options;
    
    for (let i = 0; i < count; i++) {
      // Select random particle type
      const type = this.particleTypes[Math.floor(Math.random() * this.particleTypes.length)];
      
      // Create sprite using ctx.classes
      const sprite = new this.classes.Sprite(this._particleTexture);
      sprite.anchor.set(0.5);
      sprite.blendMode = 'add';
      sprite.tint = type.color;
      sprite.scale.set(0.3 * type.size);
      
      // Orbital parameters
      const orbitRadius = minOrbitRadius + Math.random() * (maxOrbitRadius - minOrbitRadius);
      const angle = Math.random() * Math.PI * 2;
      const direction = Math.random() > 0.5 ? 1 : -1;
      
      // Calculate initial position
      const helixPhase = Math.random() * Math.PI * 2;
      const helixAmplitude = 5 + Math.random() * 15;
      const helixFrequency = 3 + Math.random() * 5;
      const helixOffset = Math.sin(angle * helixFrequency + helixPhase) * helixAmplitude;
      const effectiveRadius = orbitRadius + helixOffset;
      const initX = this.options.centerX + Math.cos(angle) * effectiveRadius;
      const initY = this.options.centerY + Math.sin(angle) * effectiveRadius;

      // Set sprite to initial position (avoids flash from 0,0)
      sprite.x = initX;
      sprite.y = initY;

      // Attach particle data
      sprite._particle = {
        type: type,
        orbitRadius: orbitRadius,
        angle: angle,
        angularSpeed: baseSpeed * type.speed * direction * (1 / Math.sqrt(orbitRadius / minOrbitRadius)),
        helixPhase: helixPhase,
        helixAmplitude: helixAmplitude,
        helixFrequency: helixFrequency,
        trail: new Array(trailLength).fill(null).map(() => ({ x: initX, y: initY, active: false })),
        trailIndex: 0,
        baseAlpha: 0.7 + Math.random() * 0.3
      };

      this._particleContainer.addChild(sprite);
      this._particles.push(sprite);
    }
  }
  
  /**
   * Create spark pool for collision effects
   * @param {number} count
   */
  _createSparkPool(count) {
    for (let i = 0; i < count; i++) {
      const spark = new this.classes.Sprite(this._sparkTexture);
      spark.anchor.set(0.5);
      spark.blendMode = 'add';
      spark.visible = false;
      spark.scale.set(0.5);
      
      spark._spark = {
        vx: 0,
        vy: 0,
        life: 0,
        maxLife: 30,
        active: false
      };
      
      this._sparkContainer.addChild(spark);
      this._sparkPool.push(spark);
    }
  }
  
  /**
   * Spawn a spark at position
   * @param {number} x
   * @param {number} y
   * @param {number} color
   */
  _spawnSpark(x, y, color) {
    // Find inactive spark
    let spark = null;
    for (const s of this._sparkPool) {
      if (!s._spark.active) {
        spark = s;
        break;
      }
    }
    
    if (!spark) return;
    
    const data = spark._spark;
    data.active = true;
    data.life = data.maxLife;
    
    // Random velocity
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 4;
    data.vx = Math.cos(angle) * speed;
    data.vy = Math.sin(angle) * speed;
    
    spark.x = x;
    spark.y = y;
    spark.alpha = 1;
    spark.scale.set(0.3 + Math.random() * 0.4);
    spark.tint = color;
    spark.visible = true;
    
    this._sparks.push(spark);
  }
  
  /**
   * Create collision burst
   * @param {number} x
   * @param {number} y
   * @param {number} color1
   * @param {number} color2
   */
  _createCollisionBurst(x, y, color1, color2) {
    const sparkCount = 8 + Math.floor(Math.random() * 8);
    
    for (let i = 0; i < sparkCount; i++) {
      const color = Math.random() > 0.5 ? color1 : color2;
      this._spawnSpark(x, y, color);
    }
    
    // Also spawn white sparks
    for (let i = 0; i < 3; i++) {
      this._spawnSpark(x, y, 0xFFFFFF);
    }
  }
  
  /**
   * Check for particle collisions
   */
  _checkCollisions() {
    if (!this.options.collisionsEnabled) return;
    
    const collisionDistance = 15;
    const particles = this._particles;
    const len = particles.length;
    
    // Only check subset each frame for performance
    const checkCount = Math.min(20, len);
    const startIdx = Math.floor(Math.random() * len);
    
    for (let i = 0; i < checkCount; i++) {
      const idx1 = (startIdx + i) % len;
      const p1 = particles[idx1];
      
      for (let j = i + 1; j < checkCount; j++) {
        const idx2 = (startIdx + j) % len;
        const p2 = particles[idx2];
        
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        const distSq = dx * dx + dy * dy;
        
        if (distSq < collisionDistance * collisionDistance) {
          // Collision detected!
          const midX = (p1.x + p2.x) / 2;
          const midY = (p1.y + p2.y) / 2;
          
          this._createCollisionBurst(
            midX, midY,
            p1._particle.type.color,
            p2._particle.type.color
          );
          
          // Scatter particles slightly
          p1._particle.angle += 0.1;
          p2._particle.angle -= 0.1;
          
          // Only one collision per frame per pair
          return;
        }
      }
    }
  }
  
  /**
   * Update speed acceleration
   * @param {number} delta
   */
  _updateAcceleration(delta) {
    const { minSpeedMultiplier, maxSpeedMultiplier, accelerationRate, accelerationCurve } = this.options;

    // Progress the acceleration (0 to 1)
    if (this._speedProgress < 1) {
      this._speedProgress = Math.min(1, this._speedProgress + accelerationRate * delta);

      // Apply easing curve
      let easedProgress;
      if (accelerationCurve === 'ease') {
        // Ease-in-out cubic for smooth acceleration
        easedProgress = this._speedProgress < 0.5
          ? 4 * this._speedProgress * this._speedProgress * this._speedProgress
          : 1 - Math.pow(-2 * this._speedProgress + 2, 3) / 2;
      } else {
        // Linear
        easedProgress = this._speedProgress;
      }

      // Interpolate between min and max speed
      this._currentSpeedMultiplier = minSpeedMultiplier +
        (maxSpeedMultiplier - minSpeedMultiplier) * easedProgress;
    }
  }

  /**
   * Update particle positions and trails
   * @param {number} delta
   */
  _updateParticles(delta) {
    const { centerX, centerY } = this.options;

    for (const sprite of this._particles) {
      const p = sprite._particle;

      // Update orbital angle with current speed multiplier
      p.angle += p.angularSpeed * this._currentSpeedMultiplier * delta;

      // Keep angle bounded
      if (p.angle > Math.PI * 2) p.angle -= Math.PI * 2;
      if (p.angle < 0) p.angle += Math.PI * 2;

      // Calculate position with helix modulation
      const helixOffset = Math.sin(p.angle * p.helixFrequency + p.helixPhase) * p.helixAmplitude;
      const effectiveRadius = p.orbitRadius + helixOffset;

      const x = centerX + Math.cos(p.angle) * effectiveRadius;
      const y = centerY + Math.sin(p.angle) * effectiveRadius;

      // Store in trail
      p.trail[p.trailIndex] = { x: sprite.x, y: sprite.y, active: true };
      p.trailIndex = (p.trailIndex + 1) % p.trail.length;

      // Update sprite position
      sprite.x = x;
      sprite.y = y;

      // Subtle pulse - intensifies with speed
      const speedIntensity = 1 + (this._currentSpeedMultiplier - this.options.minSpeedMultiplier) * 0.1;
      const pulse = 1 + Math.sin(this._time * 5 * speedIntensity + p.helixPhase) * 0.15;
      sprite.alpha = p.baseAlpha * pulse;
    }
  }
  
  /**
   * Draw all particle trails
   */
  _drawTrails() {
    const g = this._trailGraphics;
    g.clear();
    
    for (const sprite of this._particles) {
      const p = sprite._particle;
      const trail = p.trail;
      const color = p.type.color;
      const len = trail.length;
      
      // Draw trail segments
      for (let i = 0; i < len - 1; i++) {
        const idx = (p.trailIndex + i) % len;
        const nextIdx = (p.trailIndex + i + 1) % len;
        
        const point = trail[idx];
        const nextPoint = trail[nextIdx];
        
        if (!point.active || !nextPoint.active) continue;
        
        // Alpha fades along trail
        const alpha = (i / len) * 0.4;
        const width = (i / len) * 2;
        
        g.setStrokeStyle({ width: Math.max(0.5, width), color: color, alpha: alpha });
        g.moveTo(point.x, point.y);
        g.lineTo(nextPoint.x, nextPoint.y);
        g.stroke();
      }
    }
  }
  
  /**
   * Update sparks
   * @param {number} delta
   */
  _updateSparks(delta) {
    for (let i = this._sparks.length - 1; i >= 0; i--) {
      const spark = this._sparks[i];
      const data = spark._spark;
      
      data.life -= delta;
      
      if (data.life <= 0) {
        // Return to pool
        spark.visible = false;
        data.active = false;
        this._sparks.splice(i, 1);
        continue;
      }
      
      // Update position
      spark.x += data.vx * delta;
      spark.y += data.vy * delta;
      
      // Slow down
      data.vx *= 0.95;
      data.vy *= 0.95;
      
      // Fade out
      spark.alpha = data.life / data.maxLife;
      spark.scale.set(spark.scale.x * 0.98);
    }
  }
  
  /**
   * Animate energy rings
   * @param {number} delta
   */
  _animateRings(delta) {
    const rings = this._ringContainer.children;
    
    for (let i = 0; i < rings.length; i++) {
      const ring = rings[i];
      
      // Pulse effect
      const pulse = Math.sin(this._time * 2 + ring._pulsePhase) * 0.05;
      ring.alpha = 0.1 + pulse + (rings.length - i) * 0.02;
      
      // Subtle scale pulse
      const scalePulse = 1 + Math.sin(this._time * 1.5 + ring._pulsePhase) * 0.02;
      ring.scale.set(scalePulse);
    }
  }
  
  /**
   * Start animation
   */
  start() {
    if (this._destroyed || this._running) return this;
    this._running = true;
    
    this._boundUpdate = this._boundUpdate || this._update.bind(this);
    this.ticker.add(this._boundUpdate);
    
    return this;
  }
  
  /**
   * Main update loop
   * @param {PIXI.Ticker} ticker
   */
  _update(ticker) {
    const delta = ticker.deltaTime;
    this._time += delta * 0.016;

    // Update acceleration (ramps speed from slow to fast)
    this._updateAcceleration(delta);

    // Update particles
    this._updateParticles(delta);

    // Draw trails
    this._drawTrails();

    // Check collisions (throttled) - more frequent at higher speeds
    this._lastCollisionCheck += delta;
    const collisionThreshold = Math.max(2, 5 - this._currentSpeedMultiplier * 1.5);
    if (this._lastCollisionCheck > collisionThreshold) {
      this._checkCollisions();
      this._lastCollisionCheck = 0;
    }

    // Update sparks
    this._updateSparks(delta);

    // Animate rings
    this._animateRings(delta);
  }
  
  /**
   * Stop animation
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

    // Reset acceleration to start slow again
    this._speedProgress = 0;
    this._currentSpeedMultiplier = this.options.minSpeedMultiplier;

    // Reset all particles
    for (const sprite of this._particles) {
      const p = sprite._particle;
      p.angle = Math.random() * Math.PI * 2;
      p.trail.forEach(t => t.active = false);
    }

    // Clear sparks
    for (const spark of this._sparks) {
      spark.visible = false;
      spark._spark.active = false;
    }
    this._sparks = [];

    this.start();

    return this;
  }
  
  /**
   * Trigger a large collision event at center
   * @param {number} [intensity=1] - Burst intensity multiplier
   */
  collide(intensity = 1) {
    const { centerX, centerY } = this.options;
    const sparkCount = Math.floor(30 * intensity);
    
    // Spawn many sparks
    for (let i = 0; i < sparkCount; i++) {
      const type = this.particleTypes[Math.floor(Math.random() * this.particleTypes.length)];
      this._spawnSpark(
        centerX + (Math.random() - 0.5) * 20,
        centerY + (Math.random() - 0.5) * 20,
        type.color
      );
    }
    
    // Also white sparks
    for (let i = 0; i < Math.floor(15 * intensity); i++) {
      this._spawnSpark(
        centerX + (Math.random() - 0.5) * 30,
        centerY + (Math.random() - 0.5) * 30,
        0xFFFFFF
      );
    }
    
    return this;
  }
  
  /**
   * Set orbital speed multiplier
   * @param {number} multiplier
   */
  setSpeed(multiplier) {
    const { baseSpeed, minOrbitRadius } = this.options;
    
    for (const sprite of this._particles) {
      const p = sprite._particle;
      const direction = p.angularSpeed > 0 ? 1 : -1;
      p.angularSpeed = baseSpeed * p.type.speed * direction * multiplier * 
        (1 / Math.sqrt(p.orbitRadius / minOrbitRadius));
    }
    
    return this;
  }
  
  /**
   * Toggle collision effects
   * @param {boolean} enabled
   */
  setCollisions(enabled) {
    this.options.collisionsEnabled = enabled;
    return this;
  }
  
  /**
   * Resize the effect
   * @param {number} width
   * @param {number} height
   */
  resize(width, height) {
    const minDimension = Math.min(width, height);
    
    // Store old values for ratio calculation
    const oldMinOrbit = this.options.minOrbitRadius;
    const oldMaxOrbit = this.options.maxOrbitRadius;
    
    // Update options
    this.options.centerX = width / 2;
    this.options.centerY = height / 2;
    this.options.singularityRadius = minDimension * 0.04;
    this.options.minOrbitRadius = minDimension * 0.08;
    this.options.maxOrbitRadius = minDimension * 0.4;
    
    // Destroy old ring graphics properly
    while (this._ringContainer.children.length > 0) {
      const child = this._ringContainer.children[0];
      this._ringContainer.removeChild(child);
      child.destroy();
    }
    
    // Destroy old core graphics properly
    while (this._coreContainer.children.length > 0) {
      const child = this._coreContainer.children[0];
      this._coreContainer.removeChild(child);
      child.destroy();
    }
    
    // Recreate rings and singularity
    this._createEnergyRings();
    this._createSingularity();
    
    // Rescale particle orbits and clear trails
    for (const sprite of this._particles) {
      const p = sprite._particle;
      
      // Calculate ratio based on old values
      const ratio = (p.orbitRadius - oldMinOrbit) / (oldMaxOrbit - oldMinOrbit);
      p.orbitRadius = this.options.minOrbitRadius + 
        (this.options.maxOrbitRadius - this.options.minOrbitRadius) * Math.max(0, Math.min(1, ratio));
      
      // Clear trail data (old positions are now invalid)
      for (let i = 0; i < p.trail.length; i++) {
        p.trail[i].active = false;
      }
      p.trailIndex = 0;
      
      // Immediately update particle position to new center
      const helixOffset = Math.sin(p.angle * p.helixFrequency + p.helixPhase) * p.helixAmplitude;
      const effectiveRadius = p.orbitRadius + helixOffset;
      sprite.x = this.options.centerX + Math.cos(p.angle) * effectiveRadius;
      sprite.y = this.options.centerY + Math.sin(p.angle) * effectiveRadius;
    }
    
    // Clear trail graphics
    if (this._trailGraphics) {
      this._trailGraphics.clear();
    }
    
    return this;
  }
  
  /**
   * Clean up resources
   */
  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    
    this.stop();
    this._boundUpdate = null;
    
    // Clear trail graphics
    if (this._trailGraphics) {
      this._trailGraphics.clear();
      this._trailGraphics.destroy();
      this._trailGraphics = null;
    }
    
    // Destroy particles
    for (const sprite of this._particles) {
      if (sprite.parent) sprite.parent.removeChild(sprite);
      sprite.destroy();
    }
    this._particles = [];
    
    // Destroy sparks
    for (const spark of this._sparkPool) {
      if (spark.parent) spark.parent.removeChild(spark);
      spark.destroy();
    }
    this._sparkPool = [];
    this._sparks = [];
    
    // Destroy containers
    for (const obj of this._displayObjects) {
      if (obj.parent) obj.parent.removeChild(obj);
      if (obj.destroy) obj.destroy();
    }
    this._displayObjects = [];
    
    // Destroy textures
    if (this._particleTexture) {
      this._particleTexture.destroy(true);
      this._particleTexture = null;
    }
    if (this._sparkTexture) {
      this._sparkTexture.destroy(true);
      this._sparkTexture = null;
    }
  }
  
  // Getters
  get running() { return this._running; }
  get particleCount() { return this._particles.length; }
  get sparkCount() { return this._sparks.length; }
}

// ============================================================================
// EXPORTS
// ============================================================================

export { QuantumColliderEffect };
export default QuantumColliderEffect;
