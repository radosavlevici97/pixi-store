import * as PIXI from 'pixi.js';
import gsap from 'gsap';
import { PixiPlugin } from 'gsap/PixiPlugin';
import type { ComponentMetadata, ComponentLifecycleDescriptor } from '../types';

// Register GSAP plugin once
gsap.registerPlugin(PixiPlugin);
PixiPlugin.registerPIXI(PIXI);

export interface DemoInstance {
  destroy: () => void;
}

/**
 * Type for component classes that may have lifecycle descriptors
 */
interface ComponentClass {
  lifecycle?: ComponentLifecycleDescriptor;
  new (
    ctx: ReturnType<typeof createPixiContext>,
    options: { container: PIXI.Container; width: number; height: number }
  ): ComponentInstance;
}

/**
 * Type for instantiated components
 */
interface ComponentInstance {
  start?: () => void;
  stop?: () => void;
  destroy?: () => void;
  setup?: () => Promise<unknown> | unknown;
  [key: string]: unknown;
}

/**
 * Runs the lifecycle methods for a component based on its static lifecycle descriptor.
 * Falls back to method introspection if no descriptor is provided.
 *
 * Lifecycle order:
 * 1. setup() - if lifecycle.setup is true OR instance has setup method
 * 2. init[] - custom initialization calls from lifecycle.init
 * 3. start() - always called if available
 */
async function runComponentLifecycle(
  instance: ComponentInstance,
  ComponentClass: ComponentClass
): Promise<void> {
  const lifecycle = ComponentClass.lifecycle;

  // Step 1: Call setup() if declared or present
  const shouldCallSetup = lifecycle?.setup ?? typeof instance.setup === 'function';
  if (shouldCallSetup && typeof instance.setup === 'function') {
    await instance.setup();
  }

  // Step 2: Call any custom init methods from lifecycle descriptor
  if (lifecycle?.init) {
    for (const initCall of lifecycle.init) {
      const method = instance[initCall.method];
      if (typeof method === 'function') {
        const args = initCall.args ?? [];
        await (method as (...a: unknown[]) => unknown).apply(instance, args);
      }
    }
  }

  // Step 3: Call start() unless lifecycle.start is explicitly false
  const shouldCallStart = lifecycle?.start !== false;
  if (shouldCallStart && typeof instance.start === 'function') {
    instance.start();
  }
}

/**
 * Creates a PixiContext for components that use dependency injection
 * Includes all PIXI classes that components may need
 */
function createPixiContext(app: PIXI.Application) {
  return Object.freeze({
    app,
    stage: app.stage,
    ticker: app.ticker,
    renderer: app.renderer,
    gsap,
    classes: Object.freeze({
      Container: PIXI.Container,
      Graphics: PIXI.Graphics,
      Sprite: PIXI.Sprite,
      Text: PIXI.Text,
      Point: PIXI.Point,
      Texture: PIXI.Texture,
      BlurFilter: PIXI.BlurFilter,
      DisplacementFilter: PIXI.DisplacementFilter,
      Rectangle: PIXI.Rectangle,
      RenderTexture: PIXI.RenderTexture,
      TextStyle: PIXI.TextStyle,
      Filter: PIXI.Filter,
      GlProgram: PIXI.GlProgram,
    }),
    create: Object.freeze({
      container: () => new PIXI.Container(),
      graphics: () => new PIXI.Graphics(),
      sprite: (texture?: PIXI.Texture) => new PIXI.Sprite(texture),
      point: (x = 0, y = 0) => new PIXI.Point(x, y),
      text: (text: string, style?: Partial<PIXI.TextStyle>) => new PIXI.Text({ text, style }),
    }),
  });
}

// Components that use their own WebGL canvas (shaders) - they take { ticker, container (HTML element) }
const SHADER_COMPONENTS = [
  'star-explosion',
  'cosmic-shader',
  'cosmic-universe-shader',
  'jupiter-impact',
];

/**
 * Runs a component demo in the given container
 * Returns a cleanup function
 */
export async function runDemo(
  container: HTMLDivElement,
  metadata: ComponentMetadata,
  module: Record<string, unknown>
): Promise<DemoInstance> {
  const width = container.clientWidth || 800;
  const height = container.clientHeight || 600;

  if (SHADER_COMPONENTS.includes(metadata.id)) {
    return runShaderDemo(container, module, width, height);
  }

  return runPixiDemo(container, module, metadata, width, height);
}

/**
 * Runs shader-based demos that manage their own WebGL context
 * These components take: { ticker, container (HTML element), width, height }
 */
async function runShaderDemo(
  container: HTMLDivElement,
  module: Record<string, unknown>,
  width: number,
  height: number
): Promise<DemoInstance> {
  // Create a shared ticker for shader components
  const ticker = new PIXI.Ticker();
  ticker.start();

  // Find the main shader class (usually the default export)
  const ShaderClass = module.default as new (options: {
    container: HTMLElement;
    ticker: PIXI.Ticker;
    width: number;
    height: number;
    autoStart: boolean;
  }) => {
    start: () => void;
    destroy: () => void;
    canvas?: HTMLCanvasElement;
    setMouse?: (x: number, y: number) => void;
  };

  if (typeof ShaderClass !== 'function') {
    throw new Error('Shader component default export is not a constructor');
  }

  const instance = new ShaderClass({
    container,
    ticker,
    width,
    height,
    autoStart: false,
  });

  // Add mouse tracking if supported
  let handleMouseMove: ((e: MouseEvent) => void) | null = null;
  if (instance.setMouse) {
    const setMouseFn = instance.setMouse.bind(instance);
    handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = 1 - (e.clientY - rect.top) / rect.height;
      setMouseFn(x, y);
    };
    container.addEventListener('mousemove', handleMouseMove);
  }

  instance.start();

  // Style the canvas created by the shader component
  // Canvas will be centered via flexbox on parent, constrained to fit
  if (instance.canvas) {
    instance.canvas.style.maxWidth = '100%';
    instance.canvas.style.maxHeight = '100%';
    instance.canvas.style.width = 'auto';
    instance.canvas.style.height = 'auto';
    instance.canvas.style.display = 'block';
  }

  return {
    destroy: () => {
      if (handleMouseMove) {
        container.removeEventListener('mousemove', handleMouseMove);
      }
      instance.destroy();
      ticker.destroy();
    },
  };
}

/**
 * Runs standard PixiJS component demos
 * These components take: (ctx, { container (PIXI.Container), width, height })
 */
async function runPixiDemo(
  htmlContainer: HTMLDivElement,
  module: Record<string, unknown>,
  metadata: ComponentMetadata,
  width: number,
  height: number
): Promise<DemoInstance> {
  // Create PIXI Application
  const app = new PIXI.Application();
  await app.init({
    width,
    height,
    backgroundColor: 0x0a0e1a,
    antialias: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
  });

  // Append canvas to container with responsive styling
  // Canvas will be centered via flexbox on parent, constrained to fit
  const canvas = app.canvas;
  canvas.style.maxWidth = '100%';
  canvas.style.maxHeight = '100%';
  canvas.style.width = 'auto';
  canvas.style.height = 'auto';
  canvas.style.display = 'block';
  htmlContainer.appendChild(canvas);

  // Create the PixiContext
  const ctx = createPixiContext(app);

  // Track instances for cleanup
  const instances: Array<{ destroy?: () => void; stop?: () => void }> = [];

  // Try to instantiate the main/default component
  // Most components export a default that is the main class
  const DefaultExport = module.default;

  let instantiated = false;

  if (typeof DefaultExport === 'function') {
    // Default export is a class - instantiate it directly
    try {
      const componentContainer = new PIXI.Container();
      app.stage.addChild(componentContainer);

      const ComponentClass = DefaultExport as ComponentClass;
      const instance = new ComponentClass(ctx, {
        container: componentContainer,
        width,
        height,
      });

      await runComponentLifecycle(instance, ComponentClass);

      instances.push(instance);
      instantiated = true;
    } catch (err) {
      console.error('Failed to instantiate default export:', err);
    }
  } else if (DefaultExport && typeof DefaultExport === 'object') {
    // Default export is an object containing multiple classes (e.g., CosmicAurora)
    // Try to find and instantiate the main component from the object
    for (const componentName of metadata.components) {
      const ExportedClass = (DefaultExport as Record<string, unknown>)[componentName];
      if (typeof ExportedClass === 'function') {
        try {
          const componentContainer = new PIXI.Container();
          app.stage.addChild(componentContainer);

          const ComponentClass = ExportedClass as ComponentClass;
          const instance = new ComponentClass(ctx, {
            container: componentContainer,
            width,
            height,
          });

          await runComponentLifecycle(instance, ComponentClass);

          instances.push(instance);
          instantiated = true;
          break;
        } catch (err) {
          console.warn(`Failed to instantiate ${componentName} from default object:`, err);
          continue;
        }
      }
    }
  }

  // If default export didn't work, try named exports
  if (!instantiated) {
    await tryNamedExports(module, metadata, ctx, app, width, height, instances);
  }

  // Add mouse interactivity for components that support it
  let handleMouseMove: ((e: MouseEvent) => void) | null = null;
  let handleTouchMove: ((e: TouchEvent) => void) | null = null;

  // Check if any instance has setMousePosition
  const interactiveInstances = instances.filter(
    (inst): inst is ComponentInstance & { setMousePosition: (x: number, y: number, influence?: number) => void } =>
      typeof (inst as ComponentInstance).setMousePosition === 'function'
  );

  if (interactiveInstances.length > 0) {
    handleMouseMove = (e: MouseEvent) => {
      const rect = htmlContainer.getBoundingClientRect();
      // Scale coordinates to match the component's internal dimensions
      const x = (e.clientX - rect.left) * (width / rect.width);
      const y = (e.clientY - rect.top) * (height / rect.height);

      // Store on stage for legacy access
      (app.stage as PIXI.Container & { mouseX?: number; mouseY?: number }).mouseX = x;
      (app.stage as PIXI.Container & { mouseX?: number; mouseY?: number }).mouseY = y;

      // Call setMousePosition on all interactive components
      for (const inst of interactiveInstances) {
        inst.setMousePosition(x, y, 1);
      }
    };
    htmlContainer.addEventListener('mousemove', handleMouseMove);

    // Touch support for mobile
    handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      const rect = htmlContainer.getBoundingClientRect();
      const x = (touch.clientX - rect.left) * (width / rect.width);
      const y = (touch.clientY - rect.top) * (height / rect.height);

      for (const inst of interactiveInstances) {
        inst.setMousePosition(x, y, 1);
      }
    };
    htmlContainer.addEventListener('touchmove', handleTouchMove, { passive: false });
  } else {
    // Fallback: just store mouse position on stage
    handleMouseMove = (e: MouseEvent) => {
      const rect = htmlContainer.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      (app.stage as PIXI.Container & { mouseX?: number; mouseY?: number }).mouseX = x;
      (app.stage as PIXI.Container & { mouseX?: number; mouseY?: number }).mouseY = y;
    };
    htmlContainer.addEventListener('mousemove', handleMouseMove);
  }

  return {
    destroy: () => {
      if (handleMouseMove) {
        htmlContainer.removeEventListener('mousemove', handleMouseMove);
      }
      if (handleTouchMove) {
        htmlContainer.removeEventListener('touchmove', handleTouchMove);
      }

      for (const instance of instances) {
        try {
          if (typeof instance.stop === 'function') {
            instance.stop();
          }
          if (typeof instance.destroy === 'function') {
            instance.destroy();
          }
        } catch {
          // Ignore cleanup errors
        }
      }

      try {
        app.destroy(true, { children: true, texture: true });
      } catch {
        // Ignore destroy errors
      }
    },
  };
}

/**
 * Try to instantiate components from named exports
 */
async function tryNamedExports(
  module: Record<string, unknown>,
  metadata: ComponentMetadata,
  ctx: ReturnType<typeof createPixiContext>,
  app: PIXI.Application,
  width: number,
  height: number,
  instances: Array<{ destroy?: () => void; stop?: () => void }>
): Promise<void> {
  // Try the first component name from metadata
  for (const componentName of metadata.components) {
    const ExportedClass = module[componentName];

    if (typeof ExportedClass === 'function') {
      try {
        const componentContainer = new PIXI.Container();
        app.stage.addChild(componentContainer);

        const ComponentClass = ExportedClass as ComponentClass;
        const instance = new ComponentClass(ctx, {
          container: componentContainer,
          width,
          height,
        });

        await runComponentLifecycle(instance, ComponentClass);

        instances.push(instance);
        return; // Successfully created one component, that's enough for demo
      } catch (err) {
        console.warn(`Failed to instantiate ${componentName}:`, err);
        continue;
      }
    }
  }
}
