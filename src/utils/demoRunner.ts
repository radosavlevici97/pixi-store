import * as PIXI from 'pixi.js';
import gsap from 'gsap';
import { PixiPlugin } from 'gsap/PixiPlugin';
import type { ComponentMetadata } from '../types';

// Register GSAP plugin once
gsap.registerPlugin(PixiPlugin);
PixiPlugin.registerPIXI(PIXI);

export interface DemoInstance {
  destroy: () => void;
}

/**
 * Creates a PixiContext for components that use dependency injection
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
    }),
    create: Object.freeze({
      container: () => new PIXI.Container(),
      graphics: () => new PIXI.Graphics(),
      point: (x = 0, y = 0) => new PIXI.Point(x, y),
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

  if (typeof DefaultExport === 'function') {
    try {
      // Create a container for the component
      const componentContainer = new PIXI.Container();
      app.stage.addChild(componentContainer);

      const instance = new (DefaultExport as new (
        ctx: ReturnType<typeof createPixiContext>,
        options: { container: PIXI.Container; width: number; height: number }
      ) => { start?: () => void; destroy?: () => void; stop?: () => void })(ctx, {
        container: componentContainer,
        width,
        height,
      });

      if (typeof instance.start === 'function') {
        instance.start();
      }

      instances.push(instance);
    } catch (err) {
      console.warn('Failed to instantiate default export:', err);
      // Try named exports as fallback
      await tryNamedExports(module, metadata, ctx, app, width, height, instances);
    }
  } else {
    // No default export, try named exports
    await tryNamedExports(module, metadata, ctx, app, width, height, instances);
  }

  // Add mouse interactivity for the stage
  let handleMouseMove: ((e: MouseEvent) => void) | null = null;
  handleMouseMove = (e: MouseEvent) => {
    const rect = htmlContainer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    // Store for components that might need it
    (app.stage as PIXI.Container & { mouseX?: number; mouseY?: number }).mouseX = x;
    (app.stage as PIXI.Container & { mouseX?: number; mouseY?: number }).mouseY = y;
  };
  htmlContainer.addEventListener('mousemove', handleMouseMove);

  return {
    destroy: () => {
      if (handleMouseMove) {
        htmlContainer.removeEventListener('mousemove', handleMouseMove);
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
    const ComponentClass = module[componentName];

    if (typeof ComponentClass === 'function') {
      try {
        const componentContainer = new PIXI.Container();
        app.stage.addChild(componentContainer);

        const instance = new (ComponentClass as new (
          ctx: ReturnType<typeof createPixiContext>,
          options: { container: PIXI.Container; width: number; height: number }
        ) => { start?: () => void; destroy?: () => void; stop?: () => void })(ctx, {
          container: componentContainer,
          width,
          height,
        });

        if (typeof instance.start === 'function') {
          instance.start();
        }

        instances.push(instance);
        return; // Successfully created one component, that's enough for demo
      } catch (err) {
        console.warn(`Failed to instantiate ${componentName}:`, err);
        continue;
      }
    }
  }
}
