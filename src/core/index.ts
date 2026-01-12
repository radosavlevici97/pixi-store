// ═══════════════════════════════════════════════════════════════════════════
// PIXI CONTEXT
// ═══════════════════════════════════════════════════════════════════════════

import type { Application } from 'pixi.js';
import type { GsapModule, PixiContext, PixiContextConfig } from '../types';

/**
 * Creates a PixiContext for dependency injection
 */
export function createPixiContext(
  pixiModule: typeof import('pixi.js'),
  gsapModule: GsapModule,
  app: Application,
  config: PixiContextConfig = {}
): PixiContext {
  if (!pixiModule) {
    throw new Error('PixiContext: pixiModule is required');
  }
  if (!gsapModule?.gsap) {
    throw new Error('PixiContext: gsapModule with gsap is required');
  }
  if (!app?.stage) {
    throw new Error('PixiContext: app with stage is required');
  }

  const { gsap, PixiPlugin } = gsapModule;

  // Register PixiPlugin if available and not already registered
  if (PixiPlugin && !(gsap as any).plugins?.pixi) {
    gsap.registerPlugin(PixiPlugin as any);
    (PixiPlugin as any).registerPIXI(pixiModule);
  }

  const context: PixiContext = Object.freeze({
    app,
    stage: app.stage,
    ticker: config.ticker ?? app.ticker,
    renderer: app.renderer,
    gsap,
    classes: Object.freeze({
      Container: pixiModule.Container,
      Graphics: pixiModule.Graphics,
      Sprite: pixiModule.Sprite,
      Text: pixiModule.Text,
      Point: pixiModule.Point,
      Texture: pixiModule.Texture,
      BlurFilter: pixiModule.BlurFilter,
      Rectangle: pixiModule.Rectangle,
      RenderTexture: pixiModule.RenderTexture,
      TextStyle: pixiModule.TextStyle,
      Filter: pixiModule.Filter,
      GlProgram: pixiModule.GlProgram,
    }),
    create: Object.freeze({
      container: () => new pixiModule.Container(),
      graphics: () => new pixiModule.Graphics(),
      sprite: (texture?: InstanceType<typeof pixiModule.Texture>) => new pixiModule.Sprite(texture),
      point: (x = 0, y = 0) => new pixiModule.Point(x, y),
      text: (text: string, style?: Partial<InstanceType<typeof pixiModule.TextStyle>>) =>
        new pixiModule.Text({ text, style }),
    }),
  });

  return context;
}

/**
 * Type guard to check if an object is a valid PixiContext
 */
export function isPixiContext(obj: unknown): obj is PixiContext {
  if (!obj || typeof obj !== 'object') return false;
  const ctx = obj as Partial<PixiContext>;
  return !!(ctx.app && ctx.stage && ctx.ticker && ctx.gsap && ctx.classes && ctx.create);
}

// ═══════════════════════════════════════════════════════════════════════════
// EASING FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

export type EasingFunction = (t: number) => number;

export const Easing = {
  linear: (t: number) => t,
  easeInQuad: (t: number) => t * t,
  easeOutQuad: (t: number) => t * (2 - t),
  easeInOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  easeInCubic: (t: number) => t * t * t,
  easeOutCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  easeInOutCubic: (t: number) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  easeInQuart: (t: number) => t * t * t * t,
  easeOutQuart: (t: number) => 1 - Math.pow(1 - t, 4),
  easeInOutQuart: (t: number) =>
    t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2,
  easeOutElastic: (t: number) => {
    const c4 = (2 * Math.PI) / 3;
    return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// MATH UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

export const MathUtils = {
  clamp: (value: number, min: number, max: number) => Math.max(min, Math.min(max, value)),
  lerp: (a: number, b: number, t: number) => a + (b - a) * t,
  invLerp: (a: number, b: number, value: number) => (value - a) / (b - a),
  remap: (value: number, inMin: number, inMax: number, outMin: number, outMax: number) =>
    MathUtils.lerp(outMin, outMax, MathUtils.invLerp(inMin, inMax, value)),
  randomRange: (min: number, max: number) => min + Math.random() * (max - min),
  randomInt: (min: number, max: number) => Math.floor(MathUtils.randomRange(min, max + 1)),
  distance: (x1: number, y1: number, x2: number, y2: number) =>
    Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2),
  degToRad: (deg: number) => deg * (Math.PI / 180),
  radToDeg: (rad: number) => rad * (180 / Math.PI),
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// SIGNAL (EVENT EMITTER)
// ═══════════════════════════════════════════════════════════════════════════

import type { Signal, SignalCallback } from '../types';

export function createSignal<T = void>(): Signal<T> {
  const listeners = new Set<SignalCallback<T>>();
  const onceListeners = new Set<SignalCallback<T>>();

  return {
    add(callback: SignalCallback<T>) {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    once(callback: SignalCallback<T>) {
      onceListeners.add(callback);
      return () => onceListeners.delete(callback);
    },
    remove(callback: SignalCallback<T>) {
      listeners.delete(callback);
      onceListeners.delete(callback);
    },
    emit(data: T) {
      const snapshot = [...listeners, ...onceListeners];
      onceListeners.clear();
      for (const fn of snapshot) {
        try {
          fn(data);
        } catch (err) {
          console.error('[Signal] Listener error:', err);
        }
      }
    },
    clear() {
      listeners.clear();
      onceListeners.clear();
    },
    get listenerCount() {
      return listeners.size + onceListeners.size;
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// OBJECT POOL
// ═══════════════════════════════════════════════════════════════════════════

import type { ObjectPool, Poolable } from '../types';

export function createObjectPool<T extends Poolable>(
  factory: () => T,
  initialSize = 0
): ObjectPool<T> {
  const pool: T[] = [];

  for (let i = 0; i < initialSize; i++) {
    pool.push(factory());
  }

  return {
    acquire(): T {
      if (pool.length > 0) {
        return pool.pop()!;
      }
      return factory();
    },
    release(obj: T) {
      obj.reset?.();
      pool.push(obj);
    },
    clear() {
      pool.length = 0;
    },
    get size() {
      return pool.length;
    },
    get available() {
      return pool.length;
    },
  };
}
