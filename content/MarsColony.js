/**
 * MarsColony - Animated Mars landscape with walking robots
 *
 * Uses PixiJS v8 for rendering (via PixiContext DI)
 * Features: parallax terrain, walking robots, dust particles, twinkling stars
 *
 * @example
 * const ctx = createPixiContext(PIXI, { gsap, PixiPlugin }, app);
 * const colony = new MarsColony(ctx, { container: app.stage });
 * colony.start();
 */

// ============================================================================
// HELPER: RGB to Hex
// ============================================================================
function rgb2hex(r, g, b) {
  return (Math.floor(r * 255) << 16) | (Math.floor(g * 255) << 8) | Math.floor(b * 255);
}

// ============================================================================
// MARS COLONY CLASS
// ============================================================================

class MarsColony {
  /**
   * Default configuration
   */
  static defaults = {
    width: 800,
    height: 600,
    autoStart: true,
    starCount: 150,
    groundDustCount: 100,
    airDustCount: 60,
    backgroundRobotCount: 4,
    midgroundRobotCount: 4,
    foregroundRobotCount: 4,
    rockCount: 25,
  };

  /**
   * @param {PixiContext} ctx - PixiContext with classes, ticker, gsap
   * @param {Object} options - Configuration options
   */
  constructor(ctx, options = {}) {
    // Validate context
    if (!ctx?.classes) {
      throw new Error('MarsColony: ctx.classes is required');
    }
    if (!ctx?.ticker) {
      throw new Error('MarsColony: ctx.ticker is required');
    }

    // Store context references
    this.ticker = ctx.ticker;
    this.classes = ctx.classes;
    this.create = ctx.create;
    this.gsap = ctx.gsap;

    // Merge options
    this.options = { ...MarsColony.defaults, ...options };

    // Validate required options
    if (!this.options.container) {
      throw new Error('MarsColony: options.container is required');
    }

    // Internal state
    this._destroyed = false;
    this._running = false;
    this._time = 0;

    // Bind update method
    this._boundUpdate = this._update.bind(this);

    // Collections
    this._stars = [];
    this._groundDust = [];
    this._airDust = [];
    this._robots = [];

    // Setup scene
    this._setup();

    // Auto-start if configured
    if (this.options.autoStart) {
      this.start();
    }
  }

  /**
   * Setup the complete scene
   */
  _setup() {
    const { width, height } = this.options;

    // Main container
    this._root = new this.classes.Container();
    this.options.container.addChild(this._root);

    // Ground Y position (65% from top)
    this._groundY = height * 0.65;

    // Create layers in order (back to front)
    this._createSky();
    this._createStars();
    this._createPhobos();
    this._createAirDust();
    this._createTerrain();
    this._createGroundDust();
    this._createRobots();
  }

  /**
   * Create gradient sky
   */
  _createSky() {
    const { width, height } = this.options;
    const sky = new this.classes.Graphics();

    // Mars sky gradient - dusty orange to dark red
    const gradientHeight = height * 0.7;
    for (let i = 0; i < gradientHeight; i++) {
      const ratio = i / gradientHeight;
      const r = (40 + ratio * 60) / 255;
      const g = (15 + ratio * 25) / 255;
      const b = (10 + ratio * 15) / 255;
      sky.rect(0, i, width, 1);
      sky.fill(rgb2hex(r, g, b));
    }

    this._root.addChild(sky);
    this._sky = sky;
  }

  /**
   * Create twinkling stars
   */
  _createStars() {
    const { width, height, starCount } = this.options;
    const starsContainer = new this.classes.Container();

    for (let i = 0; i < starCount; i++) {
      const star = new this.classes.Graphics();
      const size = Math.random() * 2 + 0.5;
      const alpha = Math.random() * 0.6 + 0.2;

      star.circle(0, 0, size);
      star.fill({ color: 0xffffff, alpha });

      star.x = Math.random() * width;
      star.y = Math.random() * height * 0.4;

      // Store animation data
      star._twinkleSpeed = Math.random() * 0.02 + 0.01;
      star._twinkleOffset = Math.random() * Math.PI * 2;
      star._baseAlpha = alpha;

      starsContainer.addChild(star);
      this._stars.push(star);
    }

    this._root.addChild(starsContainer);
    this._starsContainer = starsContainer;
  }

  /**
   * Create Phobos moon
   */
  _createPhobos() {
    const { width, height } = this.options;
    const phobos = new this.classes.Graphics();

    // Main body
    phobos.ellipse(0, 0, 15, 12);
    phobos.fill(0x8b7355);

    // Craters
    phobos.circle(-5, -3, 4);
    phobos.circle(4, 2, 3);
    phobos.circle(-2, 5, 2);
    phobos.fill({ color: 0x6b5344, alpha: 0.7 });

    phobos.x = width * 0.8;
    phobos.y = height * 0.15;

    this._root.addChild(phobos);
    this._phobos = phobos;
  }

  /**
   * Create floating dust in air
   */
  _createAirDust() {
    const { width, height, airDustCount } = this.options;
    const airDustContainer = new this.classes.Container();

    for (let i = 0; i < airDustCount; i++) {
      const particle = new this.classes.Graphics();
      const size = Math.random() * 2 + 0.5;
      const alpha = Math.random() * 0.2 + 0.05;

      particle.circle(0, 0, size);
      particle.fill({ color: 0xffaa77, alpha });

      particle.x = Math.random() * width;
      particle.y = Math.random() * height * 0.6;

      // Store animation data
      particle._vx = Math.random() * 0.3 + 0.1;
      particle._vy = Math.sin(Math.random() * Math.PI) * 0.1;
      particle._floatOffset = Math.random() * Math.PI * 2;

      airDustContainer.addChild(particle);
      this._airDust.push(particle);
    }

    this._root.addChild(airDustContainer);
    this._airDustContainer = airDustContainer;
  }

  /**
   * Create Mars terrain with mountains and rocks
   */
  _createTerrain() {
    const { width, height, rockCount } = this.options;
    const groundY = this._groundY;
    const terrain = new this.classes.Container();

    // Background mountains
    const bgMountains = new this.classes.Graphics();
    bgMountains.moveTo(0, groundY);
    for (let x = 0; x <= width; x += 50) {
      const y = groundY - 80 - Math.sin(x * 0.008) * 60 - Math.cos(x * 0.015) * 40;
      bgMountains.lineTo(x, y);
    }
    bgMountains.lineTo(width, height);
    bgMountains.lineTo(0, height);
    bgMountains.closePath();
    bgMountains.fill(0x3d1a0a);
    terrain.addChild(bgMountains);

    // Mid mountains
    const midMountains = new this.classes.Graphics();
    midMountains.moveTo(0, groundY + 30);
    for (let x = 0; x <= width; x += 30) {
      const y = groundY + 30 - 50 - Math.sin(x * 0.012 + 1) * 35 - Math.cos(x * 0.02) * 25;
      midMountains.lineTo(x, y);
    }
    midMountains.lineTo(width, height);
    midMountains.lineTo(0, height);
    midMountains.closePath();
    midMountains.fill(0x5c2510);
    terrain.addChild(midMountains);

    // Foreground terrain
    const ground = new this.classes.Graphics();
    ground.moveTo(0, groundY + 60);
    for (let x = 0; x <= width; x += 20) {
      const y = groundY + 60 + Math.sin(x * 0.02) * 10 + Math.random() * 5;
      ground.lineTo(x, y);
    }
    ground.lineTo(width, height);
    ground.lineTo(0, height);
    ground.closePath();
    ground.fill(0x8b3a1a);
    terrain.addChild(ground);

    // Add rocks
    for (let i = 0; i < rockCount; i++) {
      const rock = new this.classes.Graphics();
      const rockX = Math.random() * width;
      const rockY = groundY + 70 + Math.random() * (height - groundY - 100);
      const rockSize = 5 + Math.random() * 25;
      const shade = Math.random() * 0.3;

      rock.moveTo(0, 0);
      rock.lineTo(rockSize * 0.6, -rockSize * 0.4);
      rock.lineTo(rockSize, -rockSize * 0.1);
      rock.lineTo(rockSize * 0.8, rockSize * 0.3);
      rock.lineTo(0, rockSize * 0.2);
      rock.closePath();
      rock.fill(rgb2hex(0.4 - shade, 0.18 - shade * 0.5, 0.1 - shade * 0.3));

      rock.x = rockX;
      rock.y = rockY;
      terrain.addChild(rock);
    }

    this._root.addChild(terrain);
    this._terrain = terrain;
  }

  /**
   * Create ground dust particles
   */
  _createGroundDust() {
    const { width, height, groundDustCount } = this.options;
    const groundY = this._groundY * 1.08; // 70% like original
    const dustContainer = new this.classes.Container();

    for (let i = 0; i < groundDustCount; i++) {
      const particle = new this.classes.Graphics();
      const size = Math.random() * 3 + 1;
      const alpha = Math.random() * 0.5 + 0.1;

      particle.circle(0, 0, size);
      particle.fill({ color: 0xcc8866, alpha });

      particle.x = Math.random() * width;
      particle.y = groundY + Math.random() * (height - groundY);

      // Store animation data
      particle._vx = Math.random() * 0.5 + 0.2;
      particle._vy = Math.random() * 0.3 - 0.15;
      particle._baseAlpha = alpha;

      dustContainer.addChild(particle);
      this._groundDust.push(particle);
    }

    this._root.addChild(dustContainer);
    this._groundDustContainer = dustContainer;
  }

  /**
   * Create a single robot
   * @param {number} scale - Robot scale factor
   * @returns {Container} Robot container
   */
  _createRobot(scale = 1) {
    const robot = new this.classes.Container();
    robot.scale.set(scale);

    // Shadow
    const shadow = new this.classes.Graphics();
    shadow.ellipse(0, 85, 25, 8);
    shadow.fill({ color: 0x000000, alpha: 0.3 });
    robot.addChild(shadow);

    // Left leg
    const leftLeg = new this.classes.Container();
    leftLeg.pivot.set(0, 0);
    leftLeg.x = -12;
    leftLeg.y = 45;

    const leftThigh = new this.classes.Graphics();
    leftThigh.roundRect(-4, 0, 8, 25, 2);
    leftThigh.fill(0x404040);
    leftLeg.addChild(leftThigh);

    const leftShin = new this.classes.Graphics();
    leftShin.roundRect(-3, 25, 6, 22, 2);
    leftShin.fill(0x505050);
    leftLeg.addChild(leftShin);

    const leftFoot = new this.classes.Graphics();
    leftFoot.roundRect(-6, 45, 12, 6, 2);
    leftFoot.fill(0x303030);
    leftLeg.addChild(leftFoot);

    robot.addChild(leftLeg);
    robot._leftLeg = leftLeg;

    // Right leg
    const rightLeg = new this.classes.Container();
    rightLeg.pivot.set(0, 0);
    rightLeg.x = 12;
    rightLeg.y = 45;

    const rightThigh = new this.classes.Graphics();
    rightThigh.roundRect(-4, 0, 8, 25, 2);
    rightThigh.fill(0x404040);
    rightLeg.addChild(rightThigh);

    const rightShin = new this.classes.Graphics();
    rightShin.roundRect(-3, 25, 6, 22, 2);
    rightShin.fill(0x505050);
    rightLeg.addChild(rightShin);

    const rightFoot = new this.classes.Graphics();
    rightFoot.roundRect(-6, 45, 12, 6, 2);
    rightFoot.fill(0x303030);
    rightLeg.addChild(rightFoot);

    robot.addChild(rightLeg);
    robot._rightLeg = rightLeg;

    // Body
    const body = new this.classes.Graphics();
    // Torso
    body.roundRect(-20, 0, 40, 50, 5);
    body.fill(0x606060);
    // Chest plate
    body.roundRect(-15, 5, 30, 25, 3);
    body.fill(0x808080);
    // Tesla logo area (circle)
    body.circle(0, 17, 8);
    body.fill(0x202020);
    // Glow
    body.circle(0, 17, 4);
    body.fill({ color: 0xff4400, alpha: 0.8 });
    robot.addChild(body);

    // Left arm
    const leftArm = new this.classes.Container();
    leftArm.pivot.set(0, 0);
    leftArm.x = -22;
    leftArm.y = 5;

    const leftShoulder = new this.classes.Graphics();
    leftShoulder.circle(0, 0, 6);
    leftShoulder.fill(0x505050);
    leftArm.addChild(leftShoulder);

    const leftUpperArm = new this.classes.Graphics();
    leftUpperArm.roundRect(-4, 3, 8, 20, 2);
    leftUpperArm.fill(0x454545);
    leftArm.addChild(leftUpperArm);

    const leftForearm = new this.classes.Graphics();
    leftForearm.roundRect(-3, 23, 6, 18, 2);
    leftForearm.fill(0x555555);
    leftArm.addChild(leftForearm);

    const leftHand = new this.classes.Graphics();
    leftHand.roundRect(-4, 40, 8, 6, 2);
    leftHand.fill(0x353535);
    leftArm.addChild(leftHand);

    robot.addChild(leftArm);
    robot._leftArm = leftArm;

    // Right arm
    const rightArm = new this.classes.Container();
    rightArm.pivot.set(0, 0);
    rightArm.x = 22;
    rightArm.y = 5;

    const rightShoulder = new this.classes.Graphics();
    rightShoulder.circle(0, 0, 6);
    rightShoulder.fill(0x505050);
    rightArm.addChild(rightShoulder);

    const rightUpperArm = new this.classes.Graphics();
    rightUpperArm.roundRect(-4, 3, 8, 20, 2);
    rightUpperArm.fill(0x454545);
    rightArm.addChild(rightUpperArm);

    const rightForearm = new this.classes.Graphics();
    rightForearm.roundRect(-3, 23, 6, 18, 2);
    rightForearm.fill(0x555555);
    rightArm.addChild(rightForearm);

    const rightHand = new this.classes.Graphics();
    rightHand.roundRect(-4, 40, 8, 6, 2);
    rightHand.fill(0x353535);
    rightArm.addChild(rightHand);

    robot.addChild(rightArm);
    robot._rightArm = rightArm;

    // Neck
    const neck = new this.classes.Graphics();
    neck.roundRect(-5, -12, 10, 15, 2);
    neck.fill(0x404040);
    robot.addChild(neck);

    // Head
    const head = new this.classes.Graphics();
    // Main head shape
    head.roundRect(-15, -45, 30, 35, 8);
    head.fill(0x707070);
    // Face plate
    head.roundRect(-12, -40, 24, 20, 5);
    head.fill(0x202020);
    // Visor/eyes
    head.roundRect(-10, -38, 8, 4, 2);
    head.roundRect(2, -38, 8, 4, 2);
    head.fill({ color: 0x00ccff, alpha: 0.9 });
    // Eye glow
    head.roundRect(-9, -37, 6, 2, 1);
    head.roundRect(3, -37, 6, 2, 1);
    head.fill({ color: 0x00ffff, alpha: 0.5 });
    robot.addChild(head);

    // Antenna
    const antenna = new this.classes.Graphics();
    antenna.moveTo(0, -45);
    antenna.lineTo(0, -55);
    antenna.stroke({ width: 2, color: 0x606060 });
    antenna.circle(0, -57, 3);
    antenna.fill(0xff3300);
    robot.addChild(antenna);

    return robot;
  }

  /**
   * Create all robots at different depths
   */
  _createRobots() {
    const { width, backgroundRobotCount, midgroundRobotCount, foregroundRobotCount } = this.options;
    const groundY = this._groundY;

    // Background robots (smaller, farther)
    for (let i = 0; i < backgroundRobotCount; i++) {
      const robot = this._createRobot(0.4);
      robot.x = 100 + i * 250 + Math.random() * 100;
      robot.y = groundY + 20;
      robot._walkSpeed = 0.3 + Math.random() * 0.2;
      robot._walkPhase = Math.random() * Math.PI * 2;
      robot._direction = Math.random() > 0.5 ? 1 : -1;
      robot.scale.x = robot._direction * 0.4;
      robot.alpha = 0.6;
      robot._baseY = robot.y;
      this._robots.push(robot);
      this._root.addChild(robot);
    }

    // Mid-ground robots
    for (let i = 0; i < midgroundRobotCount; i++) {
      const robot = this._createRobot(0.7);
      robot.x = 150 + i * 300 + Math.random() * 150;
      robot.y = groundY + 70;
      robot._walkSpeed = 0.5 + Math.random() * 0.3;
      robot._walkPhase = Math.random() * Math.PI * 2;
      robot._direction = Math.random() > 0.5 ? 1 : -1;
      robot.scale.x = robot._direction * 0.7;
      robot.alpha = 0.85;
      robot._baseY = robot.y;
      this._robots.push(robot);
      this._root.addChild(robot);
    }

    // Foreground robots (larger, closer)
    for (let i = 0; i < foregroundRobotCount; i++) {
      const robot = this._createRobot(1.0);
      robot.x = 100 + i * 350 + Math.random() * 200;
      robot.y = groundY + 140;
      robot._walkSpeed = 0.8 + Math.random() * 0.4;
      robot._walkPhase = Math.random() * Math.PI * 2;
      robot._direction = Math.random() > 0.5 ? 1 : -1;
      robot.scale.x = robot._direction * 1.0;
      robot._baseY = robot.y;
      this._robots.push(robot);
      this._root.addChild(robot);
    }
  }

  /**
   * Update loop - called by ticker
   * @param {Object} ticker - PixiJS ticker
   */
  _update(ticker) {
    if (this._destroyed || !this._running) return;

    const delta = ticker.deltaTime;
    const { width, height } = this.options;

    this._time += delta * 0.016;

    // Animate stars twinkling
    for (const star of this._stars) {
      star.alpha = 0.3 + Math.sin(this._time * star._twinkleSpeed * 60 + star._twinkleOffset) * 0.3;
    }

    // Animate Phobos
    this._phobos.x += 0.05;
    if (this._phobos.x > width + 50) {
      this._phobos.x = -50;
    }

    // Animate robots walking
    for (const robot of this._robots) {
      robot._walkPhase += robot._walkSpeed * delta * 0.1;

      // Leg animation
      const legSwing = Math.sin(robot._walkPhase) * 0.4;
      robot._leftLeg.rotation = legSwing;
      robot._rightLeg.rotation = -legSwing;

      // Arm swing (opposite to legs)
      robot._leftArm.rotation = -legSwing * 0.5;
      robot._rightArm.rotation = legSwing * 0.5;

      // Body bob
      robot.y = robot._baseY + Math.sin(robot._walkPhase * 2) * 0.3;

      // Move robot
      robot.x += robot._direction * robot._walkSpeed * delta * 0.5;

      // Wrap around screen
      if (robot.x > width + 50) {
        robot.x = -50;
      } else if (robot.x < -50) {
        robot.x = width + 50;
      }
    }

    // Animate ground dust
    for (const particle of this._groundDust) {
      particle.x += particle._vx * delta;
      particle.y += particle._vy * delta + Math.sin(this._time * 2 + particle.x * 0.01) * 0.2;
      particle.alpha = particle._baseAlpha * (0.7 + Math.sin(this._time + particle.x * 0.05) * 0.3);

      if (particle.x > width + 10) {
        particle.x = -10;
      }
    }

    // Animate air dust
    for (const particle of this._airDust) {
      particle.x += particle._vx * delta;
      particle.y += Math.sin(this._time + particle._floatOffset) * 0.2;

      if (particle.x > width + 10) {
        particle.x = -10;
        particle.y = Math.random() * height * 0.6;
      }
    }
  }

  /**
   * Start animation
   */
  start() {
    if (this._destroyed || this._running) return this;

    this._running = true;
    this.ticker.add(this._boundUpdate);

    return this;
  }

  /**
   * Stop animation
   */
  stop() {
    if (!this._running) return this;

    this._running = false;
    this.ticker.remove(this._boundUpdate);

    return this;
  }

  /**
   * Resize the scene
   * @param {number} width - New width
   * @param {number} height - New height
   */
  resize(width, height) {
    // Store new dimensions
    this.options.width = width;
    this.options.height = height;

    // Rebuild scene (simplest approach for this component)
    this._destroyContents();
    this._stars = [];
    this._groundDust = [];
    this._airDust = [];
    this._robots = [];
    this._setup();

    return this;
  }

  /**
   * Destroy internal contents without destroying the component
   */
  _destroyContents() {
    if (this._root) {
      this._root.destroy({ children: true });
    }
  }

  /**
   * Get root container
   */
  get container() {
    return this._root;
  }

  /**
   * Get running state
   */
  get isRunning() {
    return this._running;
  }

  /**
   * Cleanup resources
   */
  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;

    // Stop animation
    this.stop();

    // Kill any GSAP tweens (if any were added)
    if (this.gsap) {
      this.gsap.killTweensOf(this._phobos);
      for (const robot of this._robots) {
        this.gsap.killTweensOf(robot);
      }
    }

    // Destroy contents
    this._destroyContents();

    // Clear arrays
    this._stars = null;
    this._groundDust = null;
    this._airDust = null;
    this._robots = null;

    // Nullify references
    this._root = null;
    this._sky = null;
    this._starsContainer = null;
    this._phobos = null;
    this._terrain = null;
    this._groundDustContainer = null;
    this._airDustContainer = null;
    this._boundUpdate = null;
  }
}

// ============================================================================
// PIXI CONTEXT FACTORY (for standalone usage)
// ============================================================================

/**
 * Creates a PixiContext for dependency injection
 * @param {Object} pixiModule - PIXI namespace
 * @param {Object} gsapModule - { gsap, PixiPlugin }
 * @param {Object} app - PIXI Application
 * @returns {Object} PixiContext
 */
function createPixiContext(pixiModule, gsapModule, app) {
  if (!pixiModule) {
    throw new Error('createPixiContext: pixiModule is required');
  }
  if (!app?.stage) {
    throw new Error('createPixiContext: app with stage is required');
  }

  // Register PixiPlugin if available
  const gsap = gsapModule?.gsap;
  const PixiPlugin = gsapModule?.PixiPlugin;
  if (gsap && PixiPlugin) {
    gsap.registerPlugin(PixiPlugin);
    PixiPlugin.registerPIXI(pixiModule);
  }

  return Object.freeze({
    app,
    stage: app.stage,
    ticker: app.ticker,
    renderer: app.renderer,
    gsap: gsap || null,
    classes: Object.freeze({
      Container: pixiModule.Container,
      Graphics: pixiModule.Graphics,
      Sprite: pixiModule.Sprite,
      Text: pixiModule.Text,
      TilingSprite: pixiModule.TilingSprite,
      Point: pixiModule.Point,
      Rectangle: pixiModule.Rectangle,
      BlurFilter: pixiModule.BlurFilter,
      ColorMatrixFilter: pixiModule.ColorMatrixFilter,
      Filter: pixiModule.Filter,
      GlProgram: pixiModule.GlProgram,
      Geometry: pixiModule.Geometry,
      Mesh: pixiModule.Mesh,
    }),
    create: Object.freeze({
      container: () => new pixiModule.Container(),
      graphics: () => new pixiModule.Graphics(),
      point: (x = 0, y = 0) => new pixiModule.Point(x, y),
    }),
  });
}

// ============================================================================
// EXPORTS
// ============================================================================

export { MarsColony, createPixiContext, rgb2hex };
export default MarsColony;
