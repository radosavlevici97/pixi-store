import type { Application, Container, Graphics, Sprite, Text, Point, Ticker, Renderer } from 'pixi.js';

// ═══════════════════════════════════════════════════════════════════════════
// PIXI CONTEXT TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface PixiClasses {
  Container: typeof Container;
  Graphics: typeof Graphics;
  Sprite: typeof Sprite;
  Text: typeof Text;
  Point: typeof Point;
}

export interface PixiCreate {
  container: () => Container;
  graphics: () => Graphics;
  point: (x?: number, y?: number) => Point;
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
