import type { ComponentMetadata } from './types';
import componentSources from 'virtual:component-sources';

/**
 * Component Registry - Maps metadata to actual content files
 */

export const COMPONENT_METADATA: readonly ComponentMetadata[] = [
  {
    id: 'cosmic-aurora',
    name: 'Cosmic Aurora',
    description:
      'Layered aurora borealis effect with flowing ribbons of light, twinkling stars, floating orbs, and explosive nova bursts. Features object pooling and energy wave animations.',
    category: 'animation',
    tags: ['particles', 'glow', 'interactive', 'pooling'],
    complexity: 'advanced',
    color: '#00ffcc',
    icon: '🌌',
    fileName: 'CosmicAurora.js',
    lines: 1047,
    components: ['CosmicAurora', 'AuroraStreamer', 'StarField', 'FloatingOrbs', 'NovaBurst', 'ShockwaveRing', 'EnergyCore'],
    createdAt: '2025-11-15',
  },
  {
    id: 'game-of-life',
    name: 'Bioluminescent Genesis',
    description:
      "Conway's Game of Life visualization as a deep ocean biosphere. Cellular automata simulate bioluminescent microorganisms with pulsing, glowing interactions.",
    category: 'simulation',
    tags: ['cellular-automata', 'particles', 'interactive', 'bio'],
    complexity: 'advanced',
    color: '#00f5d4',
    icon: '🧬',
    fileName: 'GameOfLife.js',
    lines: 1144,
    components: ['GameOfLife', 'DeathParticleSystem', 'CellGrid'],
    createdAt: '2025-10-20',
  },
  {
    id: 'temple-run',
    name: 'Temple Run Game',
    description:
      'Complete endless runner game with player controls, obstacles, coins, and dynamic backgrounds. Full game loop with scoring and UI components.',
    category: 'game',
    tags: ['endless-runner', 'game-loop', 'collision', 'ui'],
    complexity: 'expert',
    color: '#ffd700',
    icon: '🏃',
    fileName: 'TempleRunGame.js',
    lines: 1458,
    components: ['TempleRunGame', 'Player', 'Obstacle', 'Coin', 'Background', 'GameUI'],
    createdAt: '2025-09-05',
  },
  {
    id: 'cosmic-shader',
    name: 'Cosmic Nebula Shader',
    description:
      'Volumetric cosmic nebula with parallax stars using raw WebGL. Features noise-based cloud formations and mouse-interactive camera movement.',
    category: 'shader',
    tags: ['webgl', 'noise', 'volumetric', 'parallax'],
    complexity: 'expert',
    color: '#8888ff',
    icon: '✨',
    fileName: 'CosmicShader.js',
    lines: 492,
    components: ['CosmicShader'],
    createdAt: '2025-11-01',
  },
  {
    id: 'cosmic-universe-shader',
    name: 'Cosmic Universe',
    description:
      'Expansive universe shader with galaxy formations, star clusters, and cosmic dust. Advanced procedural generation techniques.',
    category: 'shader',
    tags: ['webgl', 'procedural', 'galaxy', 'cosmic'],
    complexity: 'expert',
    color: '#ff88ff',
    icon: '🌀',
    fileName: 'CosmicUniverseShader.js',
    lines: 780,
    components: ['CosmicUniverseShader'],
    createdAt: '2025-10-15',
  },
  {
    id: 'neural-network',
    name: 'Deep Neural Network',
    description:
      'Optimized visualization of neural network with animated connections, pulsing nodes, and data flow effects. Great for AI/ML themed projects.',
    category: 'visualization',
    tags: ['ai', 'network', 'animated', 'nodes'],
    complexity: 'advanced',
    color: '#39ff14',
    icon: '🧠',
    fileName: 'DeepNeuralNetwork-optimized.js',
    lines: 914,
    components: ['DeepNeuralNetwork'],
    createdAt: '2025-08-22',
  },
  {
    id: 'dijkstra-neural',
    name: 'Dijkstra Neural Pulse',
    description:
      'Pathfinding visualization combined with neural network aesthetics. Watch as pulses traverse optimal paths through a dynamic node network.',
    category: 'visualization',
    tags: ['pathfinding', 'algorithm', 'network', 'pulse'],
    complexity: 'expert',
    color: '#00ffff',
    icon: '🔗',
    fileName: 'DijkstraNeuralPulseNetwork.js',
    lines: 1124,
    components: ['DijkstraNeuralPulseNetwork'],
    createdAt: '2025-09-18',
  },
  {
    id: 'ferrofluid-oracle',
    name: 'Ferrofluid Oracle',
    description:
      'Mesmerizing ferrofluid simulation with magnetic field interactions. Organic, flowing movements that respond to user input.',
    category: 'simulation',
    tags: ['physics', 'fluid', 'magnetic', 'organic'],
    complexity: 'advanced',
    color: '#9d4edd',
    icon: '🔮',
    fileName: 'FerrofluidOracle.js',
    lines: 987,
    components: ['FerrofluidOracle'],
    createdAt: '2025-10-08',
  },
  {
    id: 'golden-star-charge',
    name: 'Golden Star Charge',
    description:
      'Spectacular golden particle effect with charging energy, star bursts, and radiant glow. Perfect for power-up or achievement animations.',
    category: 'effect',
    tags: ['particles', 'glow', 'energy', 'celebration'],
    complexity: 'intermediate',
    color: '#ffd700',
    icon: '⭐',
    fileName: 'GoldenStarCharge.js',
    lines: 1089,
    components: ['GoldenStarCharge'],
    createdAt: '2025-11-10',
  },
  {
    id: 'jupiter-impact',
    name: 'Jupiter Impact Shader',
    description:
      'Dramatic planetary impact shader with atmospheric effects, shockwaves, and debris. Cinematic-quality visual effect.',
    category: 'shader',
    tags: ['webgl', 'planet', 'explosion', 'atmospheric'],
    complexity: 'expert',
    color: '#ff6b35',
    icon: '💥',
    fileName: 'JupiterImpactShader.js',
    lines: 923,
    components: ['JupiterImpactShader'],
    createdAt: '2025-09-28',
  },
  {
    id: 'mars-colony',
    name: 'Mars Colony',
    description:
      'Animated Mars colony scene with habitat domes, rovers, and atmospheric dust. Sci-fi environment visualization.',
    category: 'scene',
    tags: ['space', 'environment', 'animated', 'sci-fi'],
    complexity: 'advanced',
    color: '#e34234',
    icon: '🔴',
    fileName: 'MarsColony.js',
    lines: 678,
    components: ['MarsColony'],
    createdAt: '2025-10-25',
  },
  {
    id: 'neural-aurora',
    name: 'Neural Aurora',
    description:
      'Fusion of neural network patterns with aurora borealis effects. Flowing, organic connections with bioluminescent glow.',
    category: 'animation',
    tags: ['neural', 'aurora', 'glow', 'organic'],
    complexity: 'expert',
    color: '#00ff88',
    icon: '🌊',
    fileName: 'NeuralAurora.js',
    lines: 1287,
    components: ['NeuralAuroraScene'],
    createdAt: '2025-08-15',
  },
  {
    id: 'quantum-collider',
    name: 'Quantum Collider Effect',
    description:
      'Particle physics inspired effect with high-energy collisions, quantum trails, and energy cascades. Dynamic and intense visuals.',
    category: 'effect',
    tags: ['particles', 'physics', 'collision', 'energy'],
    complexity: 'advanced',
    color: '#00d4ff',
    icon: '⚡',
    fileName: 'QuantumColliderEffect.js',
    lines: 734,
    components: ['QuantumColliderEffect'],
    createdAt: '2025-11-05',
  },
  {
    id: 'rainstorm-glass',
    name: 'Rainstorm Glass',
    description:
      'Photorealistic rain on glass effect with droplets, streaks, and refraction. Atmospheric and calming visual effect.',
    category: 'effect',
    tags: ['rain', 'glass', 'droplets', 'atmospheric'],
    complexity: 'intermediate',
    color: '#4a90d9',
    icon: '🌧️',
    fileName: 'RainstormGlass.js',
    lines: 723,
    components: ['RainstormGlass'],
    createdAt: '2025-09-12',
  },
  {
    id: 'star-explosion',
    name: 'Star Explosion',
    description:
      'Supernova-style star explosion with expanding shockwaves, debris fields, and color transitions. Epic destruction effect.',
    category: 'effect',
    tags: ['explosion', 'particles', 'supernova', 'dramatic'],
    complexity: 'intermediate',
    color: '#ff4444',
    icon: '💫',
    fileName: 'star-explosion.js',
    lines: 612,
    components: ['StarExplosionShader'],
    createdAt: '2025-10-30',
  },
  {
    id: 'star-nudge',
    name: 'Star Nudge Background',
    description:
      'Interactive starfield that responds to mouse movement with gentle parallax and nudge effects. Perfect for website backgrounds.',
    category: 'background',
    tags: ['stars', 'parallax', 'interactive', 'subtle'],
    complexity: 'beginner',
    color: '#ffffff',
    icon: '🌟',
    fileName: 'StarNudgeBackground.js',
    lines: 456,
    components: ['StarNudgeBackground'],
    createdAt: '2025-07-20',
  },
  {
    id: 'bokeh-ball',
    name: 'Bokeh Ball Throw',
    description:
      'Physics-based bouncing balls with beautiful bokeh blur effect. Interactive throwing mechanic with realistic physics.',
    category: 'effect',
    tags: ['physics', 'bokeh', 'interactive', 'blur'],
    complexity: 'intermediate',
    color: '#ff69b4',
    icon: '🎱',
    fileName: 'BokehBallThrow.js',
    lines: 589,
    components: ['BokehBallThrow'],
    createdAt: '2025-11-18',
  },
  {
    id: 'bioluminescent-ocean',
    name: 'Bioluminescent Ocean',
    description:
      'Deep sea environment with glowing creatures, particle plankton, and ambient ocean currents. Peaceful underwater atmosphere.',
    category: 'scene',
    tags: ['ocean', 'glow', 'underwater', 'ambient'],
    complexity: 'advanced',
    color: '#0077be',
    icon: '🌊',
    fileName: 'bioluminescent-ocean.js',
    lines: 1185,
    components: ['BioluminescentOcean', 'DeepOceanBackground', 'BioluminescentPlankton', 'LightRays', 'FloatingDebris', 'JellyfishSpawner'],
    createdAt: '2025-08-30',
  },
] as const;

// ═══════════════════════════════════════════════════════════════════════════
// REGISTRY UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

export function getComponentById(id: string): ComponentMetadata | undefined {
  return COMPONENT_METADATA.find((c) => c.id === id);
}

export function getComponentsByCategory(category: string): ComponentMetadata[] {
  if (category === 'all') return [...COMPONENT_METADATA];
  return COMPONENT_METADATA.filter((c) => c.category === category);
}

export function getComponentsByTag(tag: string): ComponentMetadata[] {
  return COMPONENT_METADATA.filter((c) => c.tags.includes(tag));
}

export function searchComponents(query: string): ComponentMetadata[] {
  const q = query.toLowerCase();
  return COMPONENT_METADATA.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q) ||
      c.tags.some((t) => t.includes(q))
  );
}

export function getAllTags(): string[] {
  const tags = new Set<string>();
  for (const component of COMPONENT_METADATA) {
    for (const tag of component.tags) {
      tags.add(tag);
    }
  }
  return [...tags].sort();
}

export function getCategoryCounts(): Record<string, number> {
  const counts: Record<string, number> = { all: COMPONENT_METADATA.length };
  for (const component of COMPONENT_METADATA) {
    counts[component.category] = (counts[component.category] ?? 0) + 1;
  }
  return counts;
}

export function getRelatedComponents(id: string, limit = 3): ComponentMetadata[] {
  const component = getComponentById(id);
  if (!component) return [];

  const scored = COMPONENT_METADATA.filter((c) => c.id !== id).map((c) => {
    let score = 0;
    if (c.category === component.category) score += 2;
    for (const tag of c.tags) {
      if (component.tags.includes(tag)) score += 1;
    }
    return { component: c, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.component);
}

// ═══════════════════════════════════════════════════════════════════════════
// DYNAMIC COMPONENT LOADING
// ═══════════════════════════════════════════════════════════════════════════

// Use Vite's glob import for dynamic component loading
// Path relative to project root
const componentModules = import.meta.glob('/content/*.js', { eager: false });

export async function loadComponent(id: string): Promise<unknown> {
  const meta = getComponentById(id);
  if (!meta) throw new Error(`Component not found: ${id}`);

  const path = `/content/${meta.fileName}`;
  const loader = componentModules[path];

  if (!loader) {
    console.warn(`Available modules:`, Object.keys(componentModules));
    throw new Error(`Component file not found: ${meta.fileName}`);
  }

  return loader();
}

export async function getComponentSource(id: string): Promise<string> {
  const meta = getComponentById(id);
  if (!meta) throw new Error(`Component not found: ${id}`);

  const source = componentSources[meta.fileName];
  if (source) return source;

  return `// Source code for ${meta.name}\n// File: ${meta.fileName}\n// ${meta.lines} lines`;
}
