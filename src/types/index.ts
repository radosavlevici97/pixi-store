import type { Application, Container, Graphics, Sprite, Text, Point, Ticker, Renderer, Texture, BlurFilter, Rectangle, RenderTexture, TextStyle, Filter, GlProgram } from 'pixi.js';

// ═══════════════════════════════════════════════════════════════════════════
// PIXI CONTEXT TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface PixiClasses {
  Container: typeof Container;
  Graphics: typeof Graphics;
  Sprite: typeof Sprite;
  Text: typeof Text;
  Point: typeof Point;
  Texture: typeof Texture;
  BlurFilter: typeof BlurFilter;
  Rectangle: typeof Rectangle;
  RenderTexture: typeof RenderTexture;
  TextStyle: typeof TextStyle;
  Filter: typeof Filter;
  GlProgram: typeof GlProgram;
}

export interface PixiCreate {
  container: () => Container;
  graphics: () => Graphics;
  sprite: (texture?: Texture) => Sprite;
  point: (x?: number, y?: number) => Point;
  text: (text: string, style?: Partial<TextStyle>) => Text;
}

export interface GsapModule {
  gsap: typeof import('gsap').gsap;
  PixiPlugin?: unknown;
}

export interface PixiContext {
  app: Application;
  stage: Container;
  ticker: Ticker;
  renderer: Renderer;
  gsap: typeof import('gsap').gsap;
  classes: PixiClasses;
  create: PixiCreate;
}

export interface PixiContextConfig {
  ticker?: Ticker;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type ComponentCategory =
  | 'animation'
  | 'effect'
  | 'shader'
  | 'simulation'
  | 'visualization'
  | 'game'
  | 'scene'
  | 'background';

export type ComponentComplexity = 'beginner' | 'intermediate' | 'advanced' | 'expert';

export interface ComponentMetadata {
  id: string;
  name: string;
  description: string;
  category: ComponentCategory;
  tags: string[];
  complexity: ComponentComplexity;
  color: string;
  icon: string;
  fileName: string;
  lines: number;
  components: string[];
  createdAt: string;
}

export interface ComponentStats {
  likes: number;
  copies: number;
  views: number;
}

export interface ComponentData extends ComponentMetadata {
  stats: ComponentStats;
  source?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// BASE COMPONENT INTERFACE
// ═══════════════════════════════════════════════════════════════════════════

export interface BaseComponentOptions {
  width?: number;
  height?: number;
  autoStart?: boolean;
}

export interface BaseComponent {
  readonly container: Container;
  start(): void;
  stop(): void;
  resize?(width: number, height: number): void;
  destroy(): void;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT LIFECYCLE DESCRIPTOR
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Describes additional lifecycle methods that a component requires.
 * Used by the demoRunner to correctly initialize and run components.
 *
 * Components can define this as a static property:
 *
 * @example
 * class GameOfLife {
 *   static lifecycle = {
 *     setup: true,
 *     init: [{ method: 'randomize', args: [0.3] }]
 *   };
 * }
 */
export interface ComponentLifecycleDescriptor {
  /**
   * If true, the component has a public setup() method that must be called
   * after construction and before start(). May be async.
   */
  setup?: boolean;

  /**
   * Array of initialization calls to make after setup() but before start().
   * Each entry specifies a method name and optional arguments.
   */
  init?: Array<{
    method: string;
    args?: unknown[];
  }>;

  /**
   * If explicitly false, start() will NOT be auto-called.
   * Use this for interactive demos that should wait for user input.
   * Defaults to true (start is called automatically).
   */
  start?: boolean;
}

/**
 * Type guard to check if a class has a lifecycle descriptor
 */
export interface ComponentClassWithLifecycle {
  lifecycle?: ComponentLifecycleDescriptor;
  new (...args: unknown[]): BaseComponent;
}

// ═══════════════════════════════════════════════════════════════════════════
// SIGNAL TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type SignalCallback<T = void> = (data: T) => void;

export interface Signal<T = void> {
  add(callback: SignalCallback<T>): () => void;
  once(callback: SignalCallback<T>): () => void;
  remove(callback: SignalCallback<T>): void;
  emit(data: T): void;
  clear(): void;
  readonly listenerCount: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// POOL TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface Poolable {
  reset?(): void;
}

export interface ObjectPool<T extends Poolable> {
  acquire(): T;
  release(obj: T): void;
  clear(): void;
  readonly size: number;
  readonly available: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// APP STATE TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type ThemeMode = 'light' | 'dark';
export type ViewMode = 'grid' | 'list';
export type SortOption = 'popular' | 'newest' | 'name' | 'likes' | 'copies';

export interface UserPreferences {
  theme: ThemeMode;
  viewMode: ViewMode;
}

export interface FilterState {
  search: string;
  category: ComponentCategory | 'all';
  sortBy: SortOption;
  showBookmarksOnly: boolean;
}
