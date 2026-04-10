# Technology Stack

**Analysis Date:** 2026-04-10

## Languages

**Primary:**
- TypeScript 6.0.2 - Used throughout the application (frontend components, utilities, worker threads)

**Secondary:**
- JavaScript - Vite configuration and ESLint config
- HTML - Entry point template

## Runtime

**Environment:**
- Node.js (development)
- Browser runtime (production) - ES2023 target with DOM APIs

**Package Manager:**
- npm 10+ (inferred from package-lock.json)
- Lockfile: Present (package-lock.json)

## Frameworks

**Core:**
- React 19.2.4 - UI component framework
- React Router 7.14.0 - Client-side routing for multiple pages (/settings, /)

**Styling:**
- TailwindCSS 4.2.2 - Utility-first CSS framework
- @tailwindcss/vite 4.2.2 - Vite integration for Tailwind

**State Management:**
- Zustand 5.0.12 - Lightweight state management for settings and comparison state
  - Uses persist middleware for localStorage integration

**Charting:**
- Recharts 3.8.1 - React components for performance metrics visualization

**Testing:**
- No test framework detected (Jest, Vitest, or similar not installed)

**Build/Dev:**
- Vite 8.0.4 - Build tool and dev server
- @vitejs/plugin-react 6.0.1 - React fast refresh plugin
- TypeScript compiler (tsc) - Type checking before build

## Key Dependencies

**Critical:**
- @huggingface/transformers 4.0.1 - Local LLM inference via ONNX
  - Supports text-generation pipelines
  - Device options: webgpu (GPU acceleration), wasm (CPU fallback)
  - Used in Web Worker for non-blocking inference

**Development/Quality:**
- ESLint 9.39.4 - JavaScript/TypeScript linting
  - eslint-plugin-react-hooks 7.0.1 - React hooks best practices
  - eslint-plugin-react-refresh 0.5.2 - React Fast Refresh compliance
  - typescript-eslint 8.58.0 - TypeScript-specific rules
- @eslint/js 9.39.4 - ESLint recommended config
- @types/react 19.2.14 - React type definitions
- @types/react-dom 19.2.3 - React DOM type definitions
- @types/node 24.12.2 - Node.js type definitions
- globals 17.4.0 - Global variables for browser environment

## Configuration

**Environment:**
- No .env file or environment variables required
- API keys stored in browser localStorage (via Zustand persist middleware)
- No server configuration needed

**Build:**
- `tsconfig.json` - Root configuration that references tsconfig.app.json and tsconfig.node.json
- `tsconfig.app.json` - App-specific settings (ES2023 target, DOM libraries, strict linting)
- `tsconfig.node.json` - Build tool configuration (separate from app)
- `eslint.config.js` - Flat ESLint config with React and TypeScript rules
- `vite.config.ts` - Vite build configuration with React and Tailwind plugins

**Build Output:**
- Target: `dist/` directory (ignored in ESLint)
- Format: ES modules

## Platform Requirements

**Development:**
- Node.js (recent version with npm)
- Modern browser with WebGPU or WebAssembly support
- TypeScript 6.0.2

**Production:**
- Deployment target: Static hosting (HTML + JS bundle)
  - Vercel, Netlify, GitHub Pages, or similar static hosts
  - No server-side runtime required
  - Browser must support:
    - ES2023 JavaScript features
    - DOM APIs (localStorage, fetch, Web Workers)
    - WebGPU (for GPU acceleration) OR WebAssembly (fallback)
    - Cache API (for model caching)

**Browser Compatibility:**
- Modern browsers only (Chrome 115+, Firefox 120+, Safari 17+)
- Requires WebGPU or WASM support for local inference

---

*Stack analysis: 2026-04-10*
