# Docs Site Setup — VitePress

## Why VitePress

- Already using Vite in the project — same ecosystem, no new build tool
- Markdown files work as-is with zero changes
- Beautiful default theme with dark mode, search, sidebar, mobile responsive
- Builds to static HTML — host anywhere (GitHub Pages, Vercel, Netlify, Cloudflare Pages)
- Fast: instant hot-reload in dev, sub-second builds

---

## Install

```bash
cd docs
npm init -y
npm install -D vitepress
```

Or from the project root if you want it as a workspace:

```bash
npm install -D vitepress --save-dev
```

---

## Config

Create `docs/.vitepress/config.ts`:

```ts
import { defineConfig } from "vitepress";

export default defineConfig({
  title: "CursorBuddy",
  description: "Drop-in animated cursor companion for any web page or Electron app",
  
  // Base path — change if hosting at a subpath (e.g. /docs/)
  base: "/",

  // Clean URLs (no .html extension)
  cleanUrls: true,

  head: [
    // Favicon — drop a favicon.ico in docs/public/
    // ['link', { rel: 'icon', href: '/favicon.ico' }],
  ],

  themeConfig: {
    // Logo in the nav bar — drop a logo in docs/public/
    // logo: '/logo.svg',

    nav: [
      { text: "Guide", link: "/getting-started" },
      { text: "API", link: "/api-reference" },
      { text: "GitHub", link: "https://github.com/your-org/cursor-buddy" },
    ],

    sidebar: [
      {
        text: "Introduction",
        items: [
          { text: "Overview", link: "/" },
          { text: "Getting Started", link: "/getting-started" },
        ],
      },
      {
        text: "Usage",
        items: [
          { text: "Web Embed", link: "/web-embed" },
          { text: "Electron Desktop App", link: "/electron-app" },
          { text: "JavaScript API", link: "/api-reference" },
        ],
      },
      {
        text: "Features",
        items: [
          { text: "Voice Pipeline", link: "/voice-pipeline" },
          { text: "AI & Inference", link: "/ai-inference" },
          { text: "Screen Capture", link: "/screen-capture" },
          { text: "Cursor Animation", link: "/cursor-animation" },
          { text: "Element Selector", link: "/element-selector" },
          { text: "MCP Integration", link: "/mcp-integration" },
          { text: "Custom Tools", link: "/custom-tools" },
        ],
      },
      {
        text: "Customization",
        items: [
          { text: "Runtime Config", link: "/customization" },
          { text: "Design Tokens", link: "/design-tokens" },
          { text: "Event Bus", link: "/event-bus" },
        ],
      },
      {
        text: "Internals",
        items: [
          { text: "Architecture", link: "/architecture" },
        ],
      },
    ],

    socialLinks: [
      { icon: "github", link: "https://github.com/your-org/cursor-buddy" },
    ],

    search: {
      provider: "local", // Built-in search, no external service needed
    },

    footer: {
      message: "Built with VitePress",
    },
  },
});
```

---

## Scripts

Add to `package.json` (project root or docs-level):

```json
{
  "scripts": {
    "docs:dev": "vitepress dev docs",
    "docs:build": "vitepress build docs",
    "docs:preview": "vitepress preview docs"
  }
}
```

---

## Run

```bash
# Dev server with hot-reload
npm run docs:dev
# → http://localhost:5173

# Production build (static HTML)
npm run docs:build
# → Output in docs/.vitepress/dist/

# Preview the production build
npm run docs:preview
```

---

## File Structure After Setup

```
docs/
├── .vitepress/
│   ├── config.ts          ← Site config (sidebar, nav, theme)
│   └── dist/              ← Built static site (after docs:build)
├── public/                ← Static assets (favicon, logo, images)
│   ├── favicon.ico
│   └── logo.svg
├── index.md               ← Home page
├── getting-started.md
├── web-embed.md
├── electron-app.md
├── api-reference.md
├── event-bus.md
├── voice-pipeline.md
├── ai-inference.md
├── screen-capture.md
├── cursor-animation.md
├── mcp-integration.md
├── custom-tools.md
├── element-selector.md
├── customization.md
├── design-tokens.md
├── architecture.md
└── SITE.md                ← This file
```

---

## Optional: Hero Landing Page

To get the VitePress hero layout on the home page, add frontmatter to `index.md`:

```yaml
---
layout: home
hero:
  name: CursorBuddy
  text: Animated cursor companion
  tagline: A friendly blue triangle that follows your mouse, flies to UI elements, and talks to AI.
  actions:
    - theme: brand
      text: Get Started
      link: /getting-started
    - theme: alt
      text: API Reference
      link: /api-reference
features:
  - title: 🎯 Fly to Elements
    details: Smooth bezier arc animations with rotation, scale pulse, and speech bubbles.
  - title: 🎤 Voice Pipeline
    details: Push-to-talk with AssemblyAI, Deepgram, or Whisper. TTS via ElevenLabs or Cartesia.
  - title: 🤖 AI Vision
    details: Claude, GPT-4o, Ollama, or LM Studio — sees your screen and points at things.
  - title: 🔌 MCP Integration
    details: Use CursorBuddy as an MCP server or connect external tools.
  - title: 🌐 Drop-in Embed
    details: One script tag. Works on any web page. Zero dependencies.
  - title: 🖥️ Desktop Overlay
    details: Transparent Electron overlay follows your real cursor across the entire OS.
---
```

If using the hero layout, move the current `index.md` body content below the frontmatter `---` or into a separate overview page.

---

## Deploying

### GitHub Pages

Add `.github/workflows/docs.yml`:

```yaml
name: Deploy Docs
on:
  push:
    branches: [main]
    paths: ['docs/**']
jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm install
      - run: npm run docs:build
      - uses: actions/upload-pages-artifact@v3
        with: { path: docs/.vitepress/dist }
      - id: deployment
        uses: actions/deploy-pages@v4
```

### Vercel

```bash
# Framework: VitePress
# Build command: vitepress build docs
# Output dir: docs/.vitepress/dist
```

### Netlify

```toml
# netlify.toml
[build]
  command = "vitepress build docs"
  publish = "docs/.vitepress/dist"
```

### Cloudflare Pages

```
Build command: vitepress build docs
Build output directory: docs/.vitepress/dist
```

---

## Theming

VitePress supports custom CSS. Create `docs/.vitepress/theme/custom.css`:

```css
/* Override the brand color to CursorBuddy blue */
:root {
  --vp-c-brand-1: #3b82f6;
  --vp-c-brand-2: #60a5fa;
  --vp-c-brand-3: #2563eb;
  --vp-c-brand-soft: rgba(59, 130, 246, 0.14);
}
```

And register it in `docs/.vitepress/theme/index.ts`:

```ts
import DefaultTheme from "vitepress/theme";
import "./custom.css";

export default DefaultTheme;
```

---

## Alternatives Considered

| Tool | Verdict |
|------|---------|
| **VitePress** | ✅ Chosen — Vite-native, zero friction, great defaults |
| **Starlight (Astro)** | Good but adds Astro as a new dependency |
| **Docusaurus** | Overkill, Webpack-based, slow |
| **Fumadocs** | Requires Next.js |
| **Mintlify** | SaaS, not self-hosted |
| **docsify** | No SSG, less polished |
