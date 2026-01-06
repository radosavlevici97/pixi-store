/**
 * TempleRunGame - Endless runner game with PixiJS v8
 * 
 * Components: Player, Obstacle, Coin, Background, GameUI, TempleRunGame
 * Uses PixiContext dependency injection pattern
 * Uses GSAP for all tweening
 * Uses PixiJS ticker for game loop
 */

// ═══════════════════════════════════════════════════════════════════════════
// SIGNAL CLASS
// ═══════════════════════════════════════════════════════════════════════════
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
      try { fn(data); } catch (err) { console.error('[Signal] Error:', err); }
    }
  }

  clear() {
    this._listeners.clear();
    this._onceListeners.clear();
    this._iterationSnapshot.length = 0;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GAME CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════
const GAME_CONFIG = {
  DESIGN_WIDTH: 400,
  DESIGN_HEIGHT: 700,
  LANE_COUNT: 3,
  GROUND_Y_RATIO: 0.75,
  PLAYER_SIZE: 50,
  OBSTACLE_WIDTH: 60,
  OBSTACLE_HEIGHT_LOW: 40,
  OBSTACLE_HEIGHT_HIGH: 80,
  COIN_SIZE: 30,
  BASE_SPEED: 3,
  MAX_SPEED: 8,
  SPEED_INCREMENT: 0.0003,
  SPAWN_INTERVAL_MIN: 80,
  SPAWN_INTERVAL_MAX: 150,
  JUMP_HEIGHT: 150,
  JUMP_DURATION: 0.5,
  SLIDE_DURATION: 0.6,
  LANE_SWITCH_DURATION: 0.15,
};

// ═══════════════════════════════════════════════════════════════════════════
// PLAYER COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
class Player {
  static defaults = {
    laneWidth: 100,
    groundY: 500,
    size: GAME_CONFIG.PLAYER_SIZE,
  };

  constructor(ctx, options = {}) {
    if (!ctx?.classes) throw new Error('Player: ctx.classes required');
    if (!ctx?.gsap) throw new Error('Player: ctx.gsap required');
    if (!options.container) throw new Error('Player: options.container required');

    this.classes = ctx.classes;
    this.gsap = ctx.gsap;
    this.container = options.container;
    this.options = { ...Player.defaults, ...options };

    this.onCollision = new Signal();
    this.onCoinCollect = new Signal();

    this._lane = 1; // 0=left, 1=center, 2=right
    this._isJumping = false;
    this._isSliding = false;
    this._destroyed = false;
    this._activeTweens = [];
    this._displayObjects = [];

    this._setup();
  }

  _setup() {
    this._root = new this.classes.Container();
    
    // Body
    this._body = new this.classes.Graphics();
    this._body.roundRect(-this.options.size/2, -this.options.size, this.options.size, this.options.size, 8);
    this._body.fill({ color: 0x4ecdc4 });
    this._body.stroke({ width: 3, color: 0x2c9e96 });
    
    // Head
    this._head = new this.classes.Graphics();
    this._head.circle(0, -this.options.size - 15, 18);
    this._head.fill({ color: 0xffd93d });
    this._head.stroke({ width: 2, color: 0xd4b32f });
    
    // Eyes
    this._eyes = new this.classes.Graphics();
    this._eyes.circle(-6, -this.options.size - 18, 4);
    this._eyes.circle(6, -this.options.size - 18, 4);
    this._eyes.fill({ color: 0x1a1a2e });

    this._root.addChild(this._body, this._head, this._eyes);
    this._root.x = this._getLaneX(this._lane);
    this._root.y = this.options.groundY;
    
    this.container.addChild(this._root);
    this._displayObjects.push(this._root, this._body, this._head, this._eyes);
  }

  _getLaneX(lane) {
    const centerX = this.options.laneWidth * 1.5;
    return centerX + (lane - 1) * this.options.laneWidth;
  }

  moveLeft() {
    if (this._lane > 0) {
      this._lane--;
      this._animateToLane();
    }
  }

  moveRight() {
    if (this._lane < 2) {
      this._lane++;
      this._animateToLane();
    }
  }

  _animateToLane() {
    const targetX = this._getLaneX(this._lane);
    const tween = this.gsap.to(this._root, {
      pixi: { x: targetX },
      duration: GAME_CONFIG.LANE_SWITCH_DURATION,
      ease: 'power2.out',
      onComplete: () => this._removeTween(tween),
    });
    this._activeTweens.push(tween);
  }

  jump() {
    if (this._isJumping || this._isSliding) return;
    this._isJumping = true;
    
    const tween = this.gsap.to(this._root, {
      pixi: { y: this.options.groundY - GAME_CONFIG.JUMP_HEIGHT },
      duration: GAME_CONFIG.JUMP_DURATION / 2,
      ease: 'power2.out',
      yoyo: true,
      repeat: 1,
      onComplete: () => {
        this._isJumping = false;
        this._root.y = this.options.groundY;
        this._removeTween(tween);
      },
    });
    this._activeTweens.push(tween);
  }

  slide() {
    if (this._isSliding || this._isJumping) return;
    this._isSliding = true;
    
    const tween = this.gsap.to(this._root.scale, {
      y: 0.4,
      duration: GAME_CONFIG.SLIDE_DURATION / 3,
      ease: 'power2.out',
      yoyo: true,
      repeat: 1,
      onComplete: () => {
        this._isSliding = false;
        this._root.scale.y = 1;
        this._removeTween(tween);
      },
    });
    this._activeTweens.push(tween);
  }

  getBounds() {
    const size = this.options.size;
    let height = size;
    let yOffset = -size;
    
    if (this._isSliding) {
      height = size * 0.4;
      yOffset = -height;
    }
    
    return {
      x: this._root.x - size/2,
      y: this._root.y + yOffset,
      width: size,
      height: height,
      isJumping: this._isJumping,
      isSliding: this._isSliding,
      jumpY: this._root.y,
    };
  }

  updateLayout(laneWidth, groundY) {
    this.options.laneWidth = laneWidth;
    this.options.groundY = groundY;
    this._root.x = this._getLaneX(this._lane);
    this._root.y = groundY;
  }

  _removeTween(tween) {
    const idx = this._activeTweens.indexOf(tween);
    if (idx > -1) this._activeTweens.splice(idx, 1);
  }

  get root() { return this._root; }

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    
    for (const tween of this._activeTweens) tween.kill();
    this._activeTweens = [];
    
    this.onCollision.clear();
    this.onCoinCollect.clear();
    
    for (const obj of this._displayObjects) {
      this.gsap.killTweensOf(obj);
      if (obj.parent) obj.parent.removeChild(obj);
      obj.destroy();
    }
    this._displayObjects = [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// OBSTACLE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
class Obstacle {
  static defaults = {
    type: 'low', // 'low' or 'high'
    lane: 1,
    laneWidth: 100,
    groundY: 500,
  };

  constructor(ctx, options = {}) {
    if (!ctx?.classes) throw new Error('Obstacle: ctx.classes required');
    
    this.classes = ctx.classes;
    this.gsap = ctx.gsap;
    this.options = { ...Obstacle.defaults, ...options };
    this.container = this.options.container;
    
    if (!this.container) throw new Error('Obstacle: options.container required');
    
    this._destroyed = false;
    this._active = true;
    this._displayObjects = [];
    
    this._setup();
  }

  _setup() {
    this._root = new this.classes.Container();
    this._graphics = new this.classes.Graphics();
    
    const isLow = this.options.type === 'low';
    const width = GAME_CONFIG.OBSTACLE_WIDTH;
    const height = isLow ? GAME_CONFIG.OBSTACLE_HEIGHT_LOW : GAME_CONFIG.OBSTACLE_HEIGHT_HIGH;
    const color = isLow ? 0xe74c3c : 0x9b59b6;
    const strokeColor = isLow ? 0xc0392b : 0x8e44ad;
    
    if (isLow) {
      // Low obstacle - jump over (spikes)
      this._graphics.moveTo(-width/2, 0);
      this._graphics.lineTo(0, -height);
      this._graphics.lineTo(width/2, 0);
      this._graphics.closePath();
      this._graphics.fill({ color });
      this._graphics.stroke({ width: 3, color: strokeColor });
    } else {
      // High obstacle - slide under (beam)
      this._graphics.roundRect(-width/2, -height - 30, width, height, 4);
      this._graphics.fill({ color });
      this._graphics.stroke({ width: 3, color: strokeColor });
      
      // Support pillars
      this._graphics.rect(-width/2 - 5, -height - 30, 8, height + 30);
      this._graphics.rect(width/2 - 3, -height - 30, 8, height + 30);
      this._graphics.fill({ color: 0x7f8c8d });
    }
    
    this._root.addChild(this._graphics);
    this._root.x = this._getLaneX(this.options.lane);
    this._root.y = this.options.groundY;
    
    this.container.addChild(this._root);
    this._displayObjects.push(this._root, this._graphics);
  }

  _getLaneX(lane) {
    const centerX = this.options.laneWidth * 1.5;
    return centerX + (lane - 1) * this.options.laneWidth;
  }

  update(speed) {
    if (!this._active) return;
    this._root.y += speed;
  }

  getBounds() {
    const isLow = this.options.type === 'low';
    const width = GAME_CONFIG.OBSTACLE_WIDTH;
    const height = isLow ? GAME_CONFIG.OBSTACLE_HEIGHT_LOW : GAME_CONFIG.OBSTACLE_HEIGHT_HIGH;
    
    return {
      x: this._root.x - width/2,
      y: isLow ? this._root.y - height : this._root.y - height - 30,
      width: width,
      height: height,
      type: this.options.type,
      lane: this.options.lane,
    };
  }

  get y() { return this._root.y; }
  get active() { return this._active; }
  set active(val) { this._active = val; }

  updateLayout(laneWidth, groundY) {
    this.options.laneWidth = laneWidth;
    this.options.groundY = groundY;
    this._root.x = this._getLaneX(this.options.lane);
  }

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    
    for (const obj of this._displayObjects) {
      this.gsap.killTweensOf(obj);
      if (obj.parent) obj.parent.removeChild(obj);
      obj.destroy();
    }
    this._displayObjects = [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// COIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
class Coin {
  static defaults = {
    lane: 1,
    laneWidth: 100,
    groundY: 500,
    yOffset: -80,
  };

  constructor(ctx, options = {}) {
    if (!ctx?.classes) throw new Error('Coin: ctx.classes required');
    
    this.classes = ctx.classes;
    this.gsap = ctx.gsap;
    this.ticker = ctx.ticker;
    this.options = { ...Coin.defaults, ...options };
    this.container = this.options.container;
    
    if (!this.container) throw new Error('Coin: options.container required');
    
    this._destroyed = false;
    this._active = true;
    this._collected = false;
    this._time = Math.random() * Math.PI * 2;
    this._displayObjects = [];
    
    this._setup();
  }

  _setup() {
    this._root = new this.classes.Container();
    
    // Outer ring
    this._outer = new this.classes.Graphics();
    this._outer.circle(0, 0, GAME_CONFIG.COIN_SIZE / 2);
    this._outer.fill({ color: 0xf1c40f });
    this._outer.stroke({ width: 3, color: 0xd4a60a });
    
    // Inner design
    this._inner = new this.classes.Graphics();
    this._inner.circle(0, 0, GAME_CONFIG.COIN_SIZE / 4);
    this._inner.fill({ color: 0xf39c12 });
    
    this._root.addChild(this._outer, this._inner);
    this._root.x = this._getLaneX(this.options.lane);
    this._root.y = this.options.groundY + this.options.yOffset;
    
    this.container.addChild(this._root);
    this._displayObjects.push(this._root, this._outer, this._inner);
  }

  _getLaneX(lane) {
    const centerX = this.options.laneWidth * 1.5;
    return centerX + (lane - 1) * this.options.laneWidth;
  }

  update(speed, delta) {
    if (!this._active || this._collected) return;
    this._root.y += speed;
    
    // Floating animation
    this._time += delta * 0.1;
    this._root.scale.x = 0.8 + Math.sin(this._time) * 0.2;
  }

  collect() {
    if (this._collected) return;
    this._collected = true;
    
    this.gsap.to(this._root, {
      pixi: { alpha: 0, scale: 2 },
      duration: 0.3,
      ease: 'power2.out',
      onComplete: () => {
        this._active = false;
      },
    });
  }

  getBounds() {
    const size = GAME_CONFIG.COIN_SIZE;
    return {
      x: this._root.x - size/2,
      y: this._root.y - size/2,
      width: size,
      height: size,
      lane: this.options.lane,
    };
  }

  get y() { return this._root.y; }
  get active() { return this._active; }
  set active(val) { this._active = val; }
  get collected() { return this._collected; }

  updateLayout(laneWidth, groundY) {
    this.options.laneWidth = laneWidth;
    this.options.groundY = groundY;
    this._root.x = this._getLaneX(this.options.lane);
  }

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    
    for (const obj of this._displayObjects) {
      this.gsap.killTweensOf(obj);
      if (obj.parent) obj.parent.removeChild(obj);
      obj.destroy();
    }
    this._displayObjects = [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// BACKGROUND COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
class Background {
  static defaults = {
    width: 400,
    height: 700,
    laneWidth: 100,
    groundY: 500,
  };

  constructor(ctx, options = {}) {
    if (!ctx?.classes) throw new Error('Background: ctx.classes required');
    
    this.classes = ctx.classes;
    this.gsap = ctx.gsap;
    this.options = { ...Background.defaults, ...options };
    this.container = this.options.container;
    
    if (!this.container) throw new Error('Background: options.container required');
    
    this._destroyed = false;
    this._scrollOffset = 0;
    this._displayObjects = [];
    
    this._setup();
  }

  _setup() {
    this._root = new this.classes.Container();
    
    // Sky gradient (simulated with rectangles)
    this._sky = new this.classes.Graphics();
    const skyHeight = this.options.height;
    for (let i = 0; i < 10; i++) {
      const t = i / 10;
      const color = this._lerpColor(0x1a1a2e, 0x16213e, t);
      this._sky.rect(0, i * (skyHeight/10), this.options.width, skyHeight/10 + 1);
      this._sky.fill({ color });
    }
    
    // Temple walls (sides)
    this._leftWall = new this.classes.Graphics();
    this._rightWall = new this.classes.Graphics();
    this._drawTempleWall(this._leftWall, 0, this.options.laneWidth * 0.3);
    this._drawTempleWall(this._rightWall, this.options.width - this.options.laneWidth * 0.3, this.options.laneWidth * 0.3);
    
    // Ground/path
    this._ground = new this.classes.Graphics();
    this._drawPath();
    
    // Lane markers
    this._lanes = new this.classes.Graphics();
    this._drawLanes();
    
    this._root.addChild(this._sky, this._leftWall, this._rightWall, this._ground, this._lanes);
    this.container.addChild(this._root);
    this._displayObjects.push(this._root, this._sky, this._leftWall, this._rightWall, this._ground, this._lanes);
  }

  _lerpColor(c1, c2, t) {
    const r1 = (c1 >> 16) & 0xff, g1 = (c1 >> 8) & 0xff, b1 = c1 & 0xff;
    const r2 = (c2 >> 16) & 0xff, g2 = (c2 >> 8) & 0xff, b2 = c2 & 0xff;
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    return (r << 16) | (g << 8) | b;
  }

  _drawTempleWall(graphics, x, width) {
    graphics.clear();
    const brickHeight = 40;
    const brickColor = 0x2c3e50;
    const mortarColor = 0x1a252f;
    
    for (let row = 0; row < Math.ceil(this.options.height / brickHeight) + 1; row++) {
      const y = row * brickHeight;
      
      graphics.rect(x, y, width, brickHeight);
      graphics.fill({ color: brickColor });
      graphics.stroke({ width: 2, color: mortarColor });
    }
  }

  _drawPath() {
    this._ground.clear();
    const pathStart = this.options.laneWidth * 0.3;
    const pathWidth = this.options.width - pathStart * 2;
    
    // Main path
    this._ground.rect(pathStart, 0, pathWidth, this.options.height);
    this._ground.fill({ color: 0x34495e });
    
    // Path tiles
    const tileHeight = 80;
    for (let i = 0; i < Math.ceil(this.options.height / tileHeight) + 1; i++) {
      const y = i * tileHeight;
      this._ground.rect(pathStart, y, pathWidth, 2);
      this._ground.fill({ color: 0x2c3e50 });
    }
  }

  _drawLanes() {
    this._lanes.clear();
    const pathStart = this.options.laneWidth * 0.3;
    const laneWidth = this.options.laneWidth;
    
    // Lane dividers (dashed)
    const dashHeight = 30;
    const gapHeight = 30;
    const totalHeight = dashHeight + gapHeight;
    
    for (let lane = 1; lane < 3; lane++) {
      const x = pathStart + lane * laneWidth;
      for (let i = 0; i < Math.ceil(this.options.height / totalHeight) + 1; i++) {
        const y = i * totalHeight;
        this._lanes.rect(x - 2, y, 4, dashHeight);
        this._lanes.fill({ color: 0x7f8c8d, alpha: 0.5 });
      }
    }
  }

  update(speed) {
    this._scrollOffset = (this._scrollOffset + speed) % 80;
    this._lanes.y = this._scrollOffset;
  }

  updateLayout(width, height, laneWidth, groundY) {
    this.options.width = width;
    this.options.height = height;
    this.options.laneWidth = laneWidth;
    this.options.groundY = groundY;
    
    this._sky.clear();
    for (let i = 0; i < 10; i++) {
      const t = i / 10;
      const color = this._lerpColor(0x1a1a2e, 0x16213e, t);
      this._sky.rect(0, i * (height/10), width, height/10 + 1);
      this._sky.fill({ color });
    }
    
    this._drawTempleWall(this._leftWall, 0, laneWidth * 0.3);
    this._drawTempleWall(this._rightWall, width - laneWidth * 0.3, laneWidth * 0.3);
    this._drawPath();
    this._drawLanes();
  }

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    
    for (const obj of this._displayObjects) {
      this.gsap.killTweensOf(obj);
      if (obj.parent) obj.parent.removeChild(obj);
      obj.destroy();
    }
    this._displayObjects = [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// UI COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
class GameUI {
  static defaults = {
    width: 400,
    height: 700,
  };

  constructor(ctx, options = {}) {
    if (!ctx?.classes) throw new Error('GameUI: ctx.classes required');
    
    this.classes = ctx.classes;
    this.gsap = ctx.gsap;
    this.options = { ...GameUI.defaults, ...options };
    this.container = this.options.container;
    
    if (!this.container) throw new Error('GameUI: options.container required');
    
    this.onRestart = new Signal();
    
    this._destroyed = false;
    this._displayObjects = [];
    
    this._setup();
  }

  _setup() {
    this._root = new this.classes.Container();
    
    // Score display
    this._scoreText = new this.classes.Text({
      text: 'Score: 0',
      style: {
        fontFamily: 'Arial, sans-serif',
        fontSize: 28,
        fontWeight: 'bold',
        fill: 0xffffff,
        dropShadow: {
          color: 0x000000,
          blur: 4,
          distance: 2,
        },
      },
    });
    this._scoreText.x = 20;
    this._scoreText.y = 20;
    
    // Coins display
    this._coinIcon = new this.classes.Graphics();
    this._coinIcon.circle(0, 0, 12);
    this._coinIcon.fill({ color: 0xf1c40f });
    this._coinIcon.stroke({ width: 2, color: 0xd4a60a });
    this._coinIcon.x = 25;
    this._coinIcon.y = 65;
    
    this._coinText = new this.classes.Text({
      text: '0',
      style: {
        fontFamily: 'Arial, sans-serif',
        fontSize: 24,
        fontWeight: 'bold',
        fill: 0xf1c40f,
        dropShadow: {
          color: 0x000000,
          blur: 4,
          distance: 2,
        },
      },
    });
    this._coinText.x = 45;
    this._coinText.y = 52;
    
    // Game Over screen
    this._gameOverContainer = new this.classes.Container();
    this._gameOverContainer.visible = false;
    
    this._overlay = new this.classes.Graphics();
    this._overlay.rect(0, 0, this.options.width, this.options.height);
    this._overlay.fill({ color: 0x000000, alpha: 0.7 });
    
    this._gameOverText = new this.classes.Text({
      text: 'GAME OVER',
      style: {
        fontFamily: 'Arial, sans-serif',
        fontSize: 48,
        fontWeight: 'bold',
        fill: 0xe74c3c,
        dropShadow: {
          color: 0x000000,
          blur: 6,
          distance: 3,
        },
      },
    });
    this._gameOverText.anchor.set(0.5);
    this._gameOverText.x = this.options.width / 2;
    this._gameOverText.y = this.options.height / 2 - 60;
    
    this._finalScoreText = new this.classes.Text({
      text: 'Final Score: 0',
      style: {
        fontFamily: 'Arial, sans-serif',
        fontSize: 32,
        fill: 0xffffff,
      },
    });
    this._finalScoreText.anchor.set(0.5);
    this._finalScoreText.x = this.options.width / 2;
    this._finalScoreText.y = this.options.height / 2;
    
    this._restartText = new this.classes.Text({
      text: 'Tap or Press SPACE to Restart',
      style: {
        fontFamily: 'Arial, sans-serif',
        fontSize: 24,
        fill: 0xf1c40f,
      },
    });
    this._restartText.anchor.set(0.5);
    this._restartText.x = this.options.width / 2;
    this._restartText.y = this.options.height / 2 + 80;
    
    // Instructions (start screen)
    this._instructionsContainer = new this.classes.Container();
    
    this._instructionsBg = new this.classes.Graphics();
    this._instructionsBg.rect(0, 0, this.options.width, this.options.height);
    this._instructionsBg.fill({ color: 0x000000, alpha: 0.8 });
    
    this._titleText = new this.classes.Text({
      text: '🏃 TEMPLE RUN',
      style: {
        fontFamily: 'Arial, sans-serif',
        fontSize: 42,
        fontWeight: 'bold',
        fill: 0x4ecdc4,
        dropShadow: {
          color: 0x000000,
          blur: 6,
          distance: 3,
        },
      },
    });
    this._titleText.anchor.set(0.5);
    this._titleText.x = this.options.width / 2;
    this._titleText.y = this.options.height / 2 - 150;
    
    this._controlsText = new this.classes.Text({
      text: 'Controls:\n\n← → or A/D: Move\n↑ or W or SPACE: Jump\n↓ or S: Slide\n\nSwipe on mobile',
      style: {
        fontFamily: 'Arial, sans-serif',
        fontSize: 22,
        fill: 0xffffff,
        align: 'center',
        lineHeight: 32,
      },
    });
    this._controlsText.anchor.set(0.5);
    this._controlsText.x = this.options.width / 2;
    this._controlsText.y = this.options.height / 2 + 20;
    
    this._startText = new this.classes.Text({
      text: 'Tap or Press any key to Start',
      style: {
        fontFamily: 'Arial, sans-serif',
        fontSize: 24,
        fill: 0xf1c40f,
      },
    });
    this._startText.anchor.set(0.5);
    this._startText.x = this.options.width / 2;
    this._startText.y = this.options.height / 2 + 180;
    
    this._instructionsContainer.addChild(this._instructionsBg, this._titleText, this._controlsText, this._startText);
    this._gameOverContainer.addChild(this._overlay, this._gameOverText, this._finalScoreText, this._restartText);
    this._root.addChild(this._scoreText, this._coinIcon, this._coinText, this._gameOverContainer, this._instructionsContainer);
    
    this.container.addChild(this._root);
    this._displayObjects.push(this._root, this._scoreText, this._coinIcon, this._coinText, 
      this._gameOverContainer, this._overlay, this._gameOverText, this._finalScoreText, this._restartText,
      this._instructionsContainer, this._instructionsBg, this._titleText, this._controlsText, this._startText);
    
    // Pulse animation for start text
    this._pulseStartText();
  }

  _pulseStartText() {
    this.gsap.to(this._startText, {
      pixi: { alpha: 0.5 },
      duration: 0.8,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1,
    });
    this.gsap.to(this._restartText, {
      pixi: { alpha: 0.5 },
      duration: 0.8,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1,
    });
  }

  updateScore(score) {
    this._scoreText.text = `Score: ${Math.floor(score)}`;
  }

  updateCoins(coins) {
    this._coinText.text = `${coins}`;
  }

  showGameOver(score, coins) {
    this._gameOverContainer.visible = true;
    this._finalScoreText.text = `Score: ${Math.floor(score)} | Coins: ${coins}`;
    
    this._gameOverContainer.alpha = 0;
    this.gsap.to(this._gameOverContainer, {
      pixi: { alpha: 1 },
      duration: 0.5,
    });
  }

  hideGameOver() {
    this._gameOverContainer.visible = false;
  }

  hideInstructions() {
    this.gsap.to(this._instructionsContainer, {
      pixi: { alpha: 0 },
      duration: 0.3,
      onComplete: () => {
        this._instructionsContainer.visible = false;
      },
    });
  }

  showInstructions() {
    this._instructionsContainer.visible = true;
    this._instructionsContainer.alpha = 1;
  }

  get instructionsVisible() {
    return this._instructionsContainer.visible && this._instructionsContainer.alpha > 0;
  }

  updateLayout(width, height) {
    this.options.width = width;
    this.options.height = height;
    
    this._overlay.clear();
    this._overlay.rect(0, 0, width, height);
    this._overlay.fill({ color: 0x000000, alpha: 0.7 });
    
    this._instructionsBg.clear();
    this._instructionsBg.rect(0, 0, width, height);
    this._instructionsBg.fill({ color: 0x000000, alpha: 0.8 });
    
    this._gameOverText.x = width / 2;
    this._gameOverText.y = height / 2 - 60;
    this._finalScoreText.x = width / 2;
    this._finalScoreText.y = height / 2;
    this._restartText.x = width / 2;
    this._restartText.y = height / 2 + 80;
    
    this._titleText.x = width / 2;
    this._titleText.y = height / 2 - 150;
    this._controlsText.x = width / 2;
    this._controlsText.y = height / 2 + 20;
    this._startText.x = width / 2;
    this._startText.y = height / 2 + 180;
  }

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    
    this.onRestart.clear();
    
    for (const obj of this._displayObjects) {
      this.gsap.killTweensOf(obj);
      if (obj.parent) obj.parent.removeChild(obj);
      obj.destroy();
    }
    this._displayObjects = [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN GAME CLASS
// ═══════════════════════════════════════════════════════════════════════════
class TempleRunGame {
  static defaults = {
    designWidth: GAME_CONFIG.DESIGN_WIDTH,
    designHeight: GAME_CONFIG.DESIGN_HEIGHT,
  };

  constructor(ctx, options = {}) {
    if (!ctx?.classes) throw new Error('TempleRunGame: ctx.classes required');
    if (!ctx?.gsap) throw new Error('TempleRunGame: ctx.gsap required');
    if (!options.container) throw new Error('TempleRunGame: options.container required');

    this.app = ctx.app;
    this.ticker = ctx.ticker;
    this.classes = ctx.classes;
    this.gsap = ctx.gsap;
    this.ctx = ctx;
    this.options = { ...TempleRunGame.defaults, ...options };
    this.container = this.options.container;

    // Signals
    this.onGameOver = new Signal();
    this.onScoreUpdate = new Signal();
    this.onCoinCollect = new Signal();

    this._destroyed = false;
    this._running = false;
    this._gameOver = false;
    this._started = false;
    this._boundUpdate = null;
    
    // Game state
    this._score = 0;
    this._coins = 0;
    this._speed = GAME_CONFIG.BASE_SPEED;
    this._spawnTimer = 0;
    this._nextSpawnTime = GAME_CONFIG.SPAWN_INTERVAL_MIN;
    
    // Collections
    this._obstacles = [];
    this._coinObjects = [];
    
    // Layout
    this._width = this.app.screen.width;
    this._height = this.app.screen.height;
    this._laneWidth = this._width / 3;
    this._groundY = this._height * GAME_CONFIG.GROUND_Y_RATIO;
    
    // Touch state
    this._touchStartX = 0;
    this._touchStartY = 0;
    
    this._setup();
  }

  _setup() {
    // Create layers
    this._backgroundLayer = new this.classes.Container();
    this._gameLayer = new this.classes.Container();
    this._uiLayer = new this.classes.Container();
    
    this.container.addChild(this._backgroundLayer, this._gameLayer, this._uiLayer);
    
    // Create components
    this._background = new Background(this.ctx, {
      container: this._backgroundLayer,
      width: this._width,
      height: this._height,
      laneWidth: this._laneWidth,
      groundY: this._groundY,
    });
    
    this._player = new Player(this.ctx, {
      container: this._gameLayer,
      laneWidth: this._laneWidth,
      groundY: this._groundY,
    });
    
    this._ui = new GameUI(this.ctx, {
      container: this._uiLayer,
      width: this._width,
      height: this._height,
    });
    
    // Input handlers
    this._setupInput();
  }

  _setupInput() {
    // Keyboard
    this._boundKeyDown = this._onKeyDown.bind(this);
    window.addEventListener('keydown', this._boundKeyDown);
    
    // Touch
    this._boundTouchStart = this._onTouchStart.bind(this);
    this._boundTouchEnd = this._onTouchEnd.bind(this);
    this.app.canvas.addEventListener('touchstart', this._boundTouchStart, { passive: false });
    this.app.canvas.addEventListener('touchend', this._boundTouchEnd, { passive: false });
    
    // Mouse (for desktop click to start/restart)
    this._boundClick = this._onClick.bind(this);
    this.app.canvas.addEventListener('click', this._boundClick);
  }

  _onKeyDown(e) {
    if (this._ui.instructionsVisible) {
      this._startGame();
      return;
    }
    
    if (this._gameOver) {
      if (e.code === 'Space') {
        this._restartGame();
      }
      return;
    }
    
    if (!this._running) return;
    
    switch (e.code) {
      case 'ArrowLeft':
      case 'KeyA':
        this._player.moveLeft();
        break;
      case 'ArrowRight':
      case 'KeyD':
        this._player.moveRight();
        break;
      case 'ArrowUp':
      case 'KeyW':
      case 'Space':
        this._player.jump();
        e.preventDefault();
        break;
      case 'ArrowDown':
      case 'KeyS':
        this._player.slide();
        break;
    }
  }

  _onTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    this._touchStartX = touch.clientX;
    this._touchStartY = touch.clientY;
  }

  _onTouchEnd(e) {
    e.preventDefault();
    
    if (this._ui.instructionsVisible) {
      this._startGame();
      return;
    }
    
    if (this._gameOver) {
      this._restartGame();
      return;
    }
    
    if (!this._running) return;
    
    const touch = e.changedTouches[0];
    const dx = touch.clientX - this._touchStartX;
    const dy = touch.clientY - this._touchStartY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    
    const minSwipe = 30;
    
    if (absDx > absDy && absDx > minSwipe) {
      // Horizontal swipe
      if (dx < 0) {
        this._player.moveLeft();
      } else {
        this._player.moveRight();
      }
    } else if (absDy > minSwipe) {
      // Vertical swipe
      if (dy < 0) {
        this._player.jump();
      } else {
        this._player.slide();
      }
    }
  }

  _onClick() {
    if (this._ui.instructionsVisible) {
      this._startGame();
    } else if (this._gameOver) {
      this._restartGame();
    }
  }

  _startGame() {
    this._ui.hideInstructions();
    this._started = true;
    this.start();
  }

  _restartGame() {
    // Clear existing obstacles and coins
    for (const obs of this._obstacles) obs.destroy();
    for (const coin of this._coinObjects) coin.destroy();
    this._obstacles = [];
    this._coinObjects = [];
    
    // Reset state
    this._score = 0;
    this._coins = 0;
    this._speed = GAME_CONFIG.BASE_SPEED;
    this._spawnTimer = 0;
    this._nextSpawnTime = GAME_CONFIG.SPAWN_INTERVAL_MIN;
    this._gameOver = false;
    
    // Reset UI
    this._ui.hideGameOver();
    this._ui.updateScore(0);
    this._ui.updateCoins(0);
    
    // Reset player
    this._player.destroy();
    this._player = new Player(this.ctx, {
      container: this._gameLayer,
      laneWidth: this._laneWidth,
      groundY: this._groundY,
    });
    
    this.start();
  }

  start() {
    if (this._running) return this;
    this._running = true;
    this._boundUpdate = this._boundUpdate || this._update.bind(this);
    this.ticker.add(this._boundUpdate);
    return this;
  }

  stop() {
    if (!this._running) return this;
    this._running = false;
    this.ticker.remove(this._boundUpdate);
    return this;
  }

  _update(ticker) {
    if (this._gameOver || !this._running) return;
    
    const delta = ticker.deltaTime;
    
    // Update speed (gradually increase)
    this._speed = Math.min(GAME_CONFIG.MAX_SPEED, this._speed + GAME_CONFIG.SPEED_INCREMENT * delta);
    
    // Update score
    this._score += delta * 0.5;
    this._ui.updateScore(this._score);
    this.onScoreUpdate.emit({ score: this._score });
    
    // Update background
    this._background.update(this._speed * 0.5);
    
    // Spawn obstacles and coins
    this._spawnTimer += delta;
    if (this._spawnTimer >= this._nextSpawnTime) {
      this._spawnTimer = 0;
      this._nextSpawnTime = GAME_CONFIG.SPAWN_INTERVAL_MIN + 
        Math.random() * (GAME_CONFIG.SPAWN_INTERVAL_MAX - GAME_CONFIG.SPAWN_INTERVAL_MIN);
      this._spawnObjects();
    }
    
    // Update obstacles
    for (const obs of this._obstacles) {
      obs.update(this._speed);
    }
    
    // Update coins
    for (const coin of this._coinObjects) {
      coin.update(this._speed, delta);
    }
    
    // Check collisions
    this._checkCollisions();
    
    // Cleanup off-screen objects
    this._cleanup();
  }

  _spawnObjects() {
    const lane = Math.floor(Math.random() * 3);
    
    // Decide what to spawn
    const rand = Math.random();
    if (rand < 0.4) {
      // Spawn low obstacle (jump over)
      const obs = new Obstacle(this.ctx, {
        container: this._gameLayer,
        type: 'low',
        lane: lane,
        laneWidth: this._laneWidth,
        groundY: -100,
      });
      this._obstacles.push(obs);
    } else if (rand < 0.7) {
      // Spawn high obstacle (slide under)
      const obs = new Obstacle(this.ctx, {
        container: this._gameLayer,
        type: 'high',
        lane: lane,
        laneWidth: this._laneWidth,
        groundY: -100,
      });
      this._obstacles.push(obs);
    } else {
      // Spawn coin row
      const coinCount = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < coinCount; i++) {
        const coinLane = (lane + i) % 3;
        const coin = new Coin(this.ctx, {
          container: this._gameLayer,
          lane: coinLane,
          laneWidth: this._laneWidth,
          groundY: -100 - i * 50,
        });
        this._coinObjects.push(coin);
      }
    }
  }

  _checkCollisions() {
    const playerBounds = this._player.getBounds();
    
    // Check obstacle collisions
    for (const obs of this._obstacles) {
      if (!obs.active) continue;
      
      const obsBounds = obs.getBounds();
      
      // Check if in same lane area
      if (this._boundsOverlap(playerBounds, obsBounds)) {
        // Check if player can avoid based on obstacle type
        if (obsBounds.type === 'low') {
          // Low obstacle - player must jump
          if (!playerBounds.isJumping || playerBounds.jumpY > this._groundY - 50) {
            this._handleGameOver();
            return;
          }
        } else {
          // High obstacle - player must slide
          if (!playerBounds.isSliding) {
            this._handleGameOver();
            return;
          }
        }
      }
    }
    
    // Check coin collisions
    for (const coin of this._coinObjects) {
      if (!coin.active || coin.collected) continue;
      
      const coinBounds = coin.getBounds();
      
      if (this._boundsOverlap(playerBounds, coinBounds)) {
        coin.collect();
        this._coins++;
        this._ui.updateCoins(this._coins);
        this._score += 10;
        this.onCoinCollect.emit({ coins: this._coins });
      }
    }
  }

  _boundsOverlap(a, b) {
    return a.x < b.x + b.width &&
           a.x + a.width > b.x &&
           a.y < b.y + b.height &&
           a.y + a.height > b.y;
  }

  _handleGameOver() {
    this._gameOver = true;
    this.stop();
    this._ui.showGameOver(this._score, this._coins);
    this.onGameOver.emit({ score: this._score, coins: this._coins });
    
    // Flash effect
    this.gsap.to(this._player.root, {
      pixi: { tint: 0xff0000 },
      duration: 0.1,
      yoyo: true,
      repeat: 5,
    });
  }

  _cleanup() {
    // Remove off-screen obstacles
    this._obstacles = this._obstacles.filter(obs => {
      if (obs.y > this._height + 100) {
        obs.destroy();
        return false;
      }
      return true;
    });
    
    // Remove off-screen/collected coins
    this._coinObjects = this._coinObjects.filter(coin => {
      if (coin.y > this._height + 100 || (!coin.active && coin.collected)) {
        coin.destroy();
        return false;
      }
      return true;
    });
  }

  resize(width, height) {
    // Maintain aspect ratio
    const aspectRatio = this.options.designWidth / this.options.designHeight;
    let newWidth, newHeight;
    
    if (width / height > aspectRatio) {
      // Container is wider - fit to height
      newHeight = height;
      newWidth = height * aspectRatio;
    } else {
      // Container is taller - fit to width
      newWidth = width;
      newHeight = width / aspectRatio;
    }
    
    // Resize renderer
    this.app.renderer.resize(newWidth, newHeight);
    
    // Update internal dimensions
    this._width = newWidth;
    this._height = newHeight;
    this._laneWidth = newWidth / 3;
    this._groundY = newHeight * GAME_CONFIG.GROUND_Y_RATIO;
    
    // Update all components
    this._background.updateLayout(newWidth, newHeight, this._laneWidth, this._groundY);
    this._player.updateLayout(this._laneWidth, this._groundY);
    this._ui.updateLayout(newWidth, newHeight);
    
    // Update existing obstacles and coins
    for (const obs of this._obstacles) {
      obs.updateLayout(this._laneWidth, obs.options.groundY);
    }
    for (const coin of this._coinObjects) {
      coin.updateLayout(this._laneWidth, coin.options.groundY);
    }
    
    return this;
  }

  // Getters
  get score() { return this._score; }
  get coins() { return this._coins; }
  get isRunning() { return this._running; }
  get isGameOver() { return this._gameOver; }

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    
    this.stop();
    this._boundUpdate = null;
    
    // Remove event listeners
    window.removeEventListener('keydown', this._boundKeyDown);
    this.app.canvas.removeEventListener('touchstart', this._boundTouchStart);
    this.app.canvas.removeEventListener('touchend', this._boundTouchEnd);
    this.app.canvas.removeEventListener('click', this._boundClick);
    
    // Clear signals
    this.onGameOver.clear();
    this.onScoreUpdate.clear();
    this.onCoinCollect.clear();
    
    // Destroy components
    this._background.destroy();
    this._player.destroy();
    this._ui.destroy();
    
    for (const obs of this._obstacles) obs.destroy();
    for (const coin of this._coinObjects) coin.destroy();
    
    this._obstacles = [];
    this._coinObjects = [];
    
    // Remove layers
    if (this._backgroundLayer.parent) this._backgroundLayer.parent.removeChild(this._backgroundLayer);
    if (this._gameLayer.parent) this._gameLayer.parent.removeChild(this._gameLayer);
    if (this._uiLayer.parent) this._uiLayer.parent.removeChild(this._uiLayer);
    
    this._backgroundLayer.destroy();
    this._gameLayer.destroy();
    this._uiLayer.destroy();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════
export {
  Signal,
  GAME_CONFIG,
  Player,
  Obstacle,
  Coin,
  Background,
  GameUI,
  TempleRunGame,
};

export default TempleRunGame;
