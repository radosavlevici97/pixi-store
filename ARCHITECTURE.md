# PixiJS Store - Architecture Documentation

## Overview

This is a production-grade monorepo for the PixiJS Store application, built with modern tooling and best practices.

## Project Structure

```
pixijs-store/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                    # Continuous Integration
│   │   ├── deploy.yml                # Production deployment
│   │   └── preview.yml               # PR preview deployments
│   ├── CODEOWNERS
│   └── pull_request_template.md
│
├── packages/
│   ├── core/                         # @pixijs-store/core - Shared utilities
│   │   ├── src/
│   │   │   ├── context/
│   │   │   │   └── PixiContext.ts    # Dependency injection factory
│   │   │   ├── utils/
│   │   │   │   ├── easing.ts
│   │   │   │   ├── math.ts
│   │   │   │   ├── pool.ts           # Object pooling utilities
│   │   │   │   └── signals.ts        # Event system
│   │   │   ├── types/
│   │   │   │   └── index.ts          # Shared type definitions
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── components/                   # @pixijs-store/components - PixiJS components
│   │   ├── src/
│   │   │   ├── animations/
│   │   │   │   ├── CosmicAurora.ts
│   │   │   │   └── NeuralAurora.ts
│   │   │   ├── effects/
│   │   │   │   ├── GoldenStarCharge.ts
│   │   │   │   ├── QuantumColliderEffect.ts
│   │   │   │   ├── RainstormGlass.ts
│   │   │   │   ├── StarExplosion.ts
│   │   │   │   └── BokehBallThrow.ts
│   │   │   ├── shaders/
│   │   │   │   ├── CosmicShader.ts
│   │   │   │   ├── CosmicUniverseShader.ts
│   │   │   │   └── JupiterImpactShader.ts
│   │   │   ├── simulations/
│   │   │   │   ├── GameOfLife.ts
│   │   │   │   └── FerrofluidOracle.ts
│   │   │   ├── visualizations/
│   │   │   │   ├── DeepNeuralNetwork.ts
│   │   │   │   └── DijkstraNeuralPulseNetwork.ts
│   │   │   ├── games/
│   │   │   │   └── TempleRunGame.ts
│   │   │   ├── scenes/
│   │   │   │   ├── MarsColony.ts
│   │   │   │   └── BioluminescentOcean.ts
│   │   │   ├── backgrounds/
│   │   │   │   └── StarNudgeBackground.ts
│   │   │   ├── registry.ts           # Component registry & metadata
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── web/                          # @pixijs-store/web - React frontend
│       ├── src/
│       │   ├── components/
│       │   │   ├── ui/               # Reusable UI components
│       │   │   │   ├── Button.tsx
│       │   │   │   ├── Card.tsx
│       │   │   │   ├── Modal.tsx
│       │   │   │   ├── SearchInput.tsx
│       │   │   │   └── index.ts
│       │   │   ├── layout/
│       │   │   │   ├── Header.tsx
│       │   │   │   ├── Footer.tsx
│       │   │   │   └── Sidebar.tsx
│       │   │   ├── content/
│       │   │   │   ├── ContentCard.tsx
│       │   │   │   ├── ContentGrid.tsx
│       │   │   │   ├── ContentModal.tsx
│       │   │   │   ├── CodeViewer.tsx
│       │   │   │   └── DemoRenderer.tsx
│       │   │   └── filters/
│       │   │       ├── CategoryFilter.tsx
│       │   │       ├── SortSelector.tsx
│       │   │       └── SearchFilter.tsx
│       │   ├── hooks/
│       │   │   ├── useLocalStorage.ts
│       │   │   ├── useContentFilter.ts
│       │   │   ├── usePixiApp.ts
│       │   │   └── useKeyboardNav.ts
│       │   ├── stores/               # Zustand state management
│       │   │   ├── useAppStore.ts
│       │   │   ├── useContentStore.ts
│       │   │   └── useUserStore.ts
│       │   ├── lib/
│       │   │   ├── api.ts            # API client
│       │   │   ├── analytics.ts
│       │   │   └── constants.ts
│       │   ├── styles/
│       │   │   ├── globals.css
│       │   │   └── themes.css
│       │   ├── App.tsx
│       │   ├── main.tsx
│       │   └── vite-env.d.ts
│       ├── public/
│       │   ├── favicon.svg
│       │   └── og-image.png
│       ├── index.html
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       └── tailwind.config.ts
│
├── tools/
│   ├── scripts/
│   │   ├── generate-registry.ts      # Auto-generate component registry
│   │   ├── validate-components.ts    # Validate component structure
│   │   └── build-all.ts
│   └── eslint-config/
│       └── index.js
│
├── docs/
│   ├── CONTRIBUTING.md
│   ├── COMPONENT_GUIDE.md
│   └── API.md
│
├── .env.example
├── .gitignore
├── .prettierrc
├── .eslintrc.js
├── package.json                      # Root package.json (workspaces)
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── turbo.json                        # Turborepo config
└── README.md
```

## Architecture Decisions

### 1. Monorepo with pnpm Workspaces + Turborepo

**Why?**
- Shared dependencies reduce node_modules bloat
- Turborepo provides intelligent caching and parallel builds
- Easy to share code between packages
- Single source of truth for tooling configuration

### 2. Package Separation

| Package | Purpose | Consumers |
|---------|---------|-----------|
| `@pixijs-store/core` | Shared utilities, types, PixiContext | All packages |
| `@pixijs-store/components` | PixiJS visual components | Web app, external users |
| `@pixijs-store/web` | React frontend application | End users |

### 3. Component Architecture

Each PixiJS component follows the **PixiContext Dependency Injection** pattern:

```typescript
// Components NEVER use PIXI.* directly
// Everything accessed via ctx (PixiContext)

class MyComponent {
  constructor(ctx: PixiContext, options?: MyComponentOptions) {
    this.container = ctx.create.container();
    // ...
  }
}
```

### 4. State Management

- **Zustand** for global state (lightweight, TypeScript-first)
- **React Query** for server state (caching, deduplication)
- **Local Storage** for persistence (likes, bookmarks, preferences)

### 5. Styling

- **Tailwind CSS** for utility-first styling
- **CSS Variables** for theming
- **Framer Motion** for animations

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                        Web Application                       │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────┐    ┌─────────────┐    ┌──────────────────┐    │
│  │ Zustand │◄───│ React Query │◄───│ API / Registry   │    │
│  │ Store   │    │   Cache     │    │                  │    │
│  └────┬────┘    └─────────────┘    └──────────────────┘    │
│       │                                      ▲              │
│       ▼                                      │              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                   React Components                   │   │
│  │  ┌──────────┐  ┌──────────┐  ┌────────────────┐    │   │
│  │  │ Filters  │  │  Grid    │  │  Modal/Demo    │    │   │
│  │  └──────────┘  └──────────┘  └───────┬────────┘    │   │
│  └──────────────────────────────────────┼──────────────┘   │
│                                         │                   │
│  ┌──────────────────────────────────────▼──────────────┐   │
│  │              PixiJS Application (Canvas)             │   │
│  │  ┌─────────────────────────────────────────────┐    │   │
│  │  │            PixiContext (DI Container)        │    │   │
│  │  │  ┌─────────┐  ┌─────────┐  ┌─────────────┐  │    │   │
│  │  │  │  PIXI   │  │  GSAP   │  │  Renderer   │  │    │   │
│  │  │  └─────────┘  └─────────┘  └─────────────┘  │    │   │
│  │  └─────────────────────────────────────────────┘    │   │
│  │                         │                            │   │
│  │  ┌──────────────────────▼───────────────────────┐   │   │
│  │  │     @pixijs-store/components (Active Demo)    │   │   │
│  │  └──────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Performance Considerations

1. **Code Splitting**: Each component lazy-loaded via dynamic imports
2. **Object Pooling**: Reuse particles/graphics objects
3. **Ticker Management**: Single ticker, components subscribe/unsubscribe
4. **Memory Management**: Proper destroy() methods, cleanup on unmount
5. **Bundle Size**: Tree-shaking enabled, components independently importable

## Security

1. **CSP Headers**: Strict Content Security Policy
2. **Sanitization**: All user inputs sanitized
3. **No eval()**: Components use safe patterns only
4. **Subresource Integrity**: External scripts verified

## Deployment

- **Vercel** for frontend (edge network, automatic previews)
- **Cloudflare R2** for asset storage
- **GitHub Actions** for CI/CD pipeline
