# PixiJS Store 🎨

A premium marketplace for high-quality PixiJS v8 visual components, effects, shaders, and games.

[![CI](https://github.com/yourusername/pixijs-store/actions/workflows/ci.yml/badge.svg)](https://github.com/yourusername/pixijs-store/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ✨ Features

- **18+ Premium Components** - Shaders, effects, animations, games, and more
- **Live Demos** - Interactive previews for every component
- **Copy & Paste** - One-click code copying with syntax highlighting
- **Advanced Filtering** - Search, filter by category, sort by popularity
- **Favorites System** - Bookmark and like your favorite components
- **Dark Mode** - Beautiful dark theme with glow effects
- **Responsive** - Works on desktop, tablet, and mobile

## 📦 Packages

| Package | Description |
|---------|-------------|
| `@pixijs-store/core` | Shared utilities, types, and PixiContext |
| `@pixijs-store/components` | PixiJS visual components library |
| `@pixijs-store/web` | React frontend application |

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9+

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/pixijs-store.git
cd pixijs-store

# Install dependencies
pnpm install

# Start development
pnpm dev
```

The app will be available at `http://localhost:3000`.

### Build for Production

```bash
pnpm build
```

## 🏗️ Project Structure

```
pixijs-store/
├── packages/
│   ├── core/              # @pixijs-store/core
│   │   ├── src/
│   │   │   ├── context/   # PixiContext factory
│   │   │   ├── utils/     # Easing, math, pooling, signals
│   │   │   └── types/     # TypeScript definitions
│   │   └── package.json
│   │
│   ├── components/        # @pixijs-store/components
│   │   ├── src/
│   │   │   ├── animations/
│   │   │   ├── effects/
│   │   │   ├── shaders/
│   │   │   ├── simulations/
│   │   │   ├── visualizations/
│   │   │   ├── games/
│   │   │   ├── scenes/
│   │   │   ├── backgrounds/
│   │   │   └── registry.ts
│   │   └── package.json
│   │
│   └── web/               # @pixijs-store/web
│       ├── src/
│       │   ├── components/
│       │   ├── hooks/
│       │   ├── stores/
│       │   └── styles/
│       └── package.json
│
├── turbo.json             # Turborepo config
├── pnpm-workspace.yaml    # Workspace config
└── package.json           # Root package
```

## 🎯 Component Architecture

All components follow the **PixiContext Dependency Injection** pattern:

```typescript
import { createPixiContext } from '@pixijs-store/core';
import { StarNudgeBackground } from '@pixijs-store/components';

// Create context (do this once)
const ctx = createPixiContext(PIXI, { gsap, PixiPlugin }, app);

// Create and use components
const stars = new StarNudgeBackground(ctx, {
  width: 800,
  height: 600,
  starCount: 200
});

app.stage.addChild(stars.container);
stars.start();

// Cleanup
stars.destroy();
```

### Why PixiContext?

1. **No global PIXI** - Components don't use `PIXI.*` directly
2. **Easy testing** - Mock the context for unit tests
3. **Version agnostic** - Works with any PixiJS v8.x
4. **GSAP integration** - Animations included in context

## 📚 Available Components

### Shaders
- **Cosmic Nebula** - Volumetric nebula with parallax stars
- **Cosmic Universe** - Galaxy formations with procedural generation
- **Jupiter Impact** - Planetary impact with atmospheric effects

### Effects
- **Golden Star Charge** - Energy charging with particle bursts
- **Quantum Collider** - High-energy particle collisions
- **Rainstorm Glass** - Rain on glass with refraction
- **Star Explosion** - Supernova-style destruction
- **Bokeh Ball Throw** - Physics-based bouncing with blur

### Animations
- **Cosmic Aurora** - Aurora borealis with floating orbs
- **Neural Aurora** - Neural network + aurora fusion

### Simulations
- **Game of Life** - Bioluminescent cellular automata
- **Ferrofluid Oracle** - Magnetic fluid simulation

### Visualizations
- **Deep Neural Network** - Animated AI network
- **Dijkstra Neural Pulse** - Pathfinding visualization

### Games
- **Temple Run** - Complete endless runner game

### Scenes
- **Mars Colony** - Sci-fi environment
- **Bioluminescent Ocean** - Deep sea atmosphere

### Backgrounds
- **Star Nudge** - Interactive parallax starfield

## 🛠️ Development

### Commands

```bash
# Development
pnpm dev              # Start all packages in dev mode
pnpm dev --filter web # Start only the web app

# Building
pnpm build            # Build all packages
pnpm build:packages   # Build only core + components

# Testing
pnpm test             # Run all tests
pnpm test:watch       # Watch mode
pnpm test:coverage    # With coverage

# Linting
pnpm lint             # Check for issues
pnpm lint:fix         # Auto-fix issues
pnpm format           # Format with Prettier

# Type checking
pnpm typecheck        # Check all packages
```

### Adding a New Component

1. Create the component file in the appropriate category folder:
   ```
   packages/components/src/effects/MyEffect.ts
   ```

2. Add metadata to the registry:
   ```typescript
   // packages/components/src/registry.ts
   export const COMPONENT_METADATA = [
     // ...existing components
     {
       id: 'my-effect',
       name: 'My Effect',
       // ...
     }
   ];
   ```

3. Export from the category index and main index

## 🚢 Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

### Docker

```bash
# Build image
docker build -t pixijs-store .

# Run container
docker run -p 3000:3000 pixijs-store
```

## 📄 License

MIT © Your Name

---

Built with ❤️ using [PixiJS](https://pixijs.com), [React](https://react.dev), and [Tailwind CSS](https://tailwindcss.com)
