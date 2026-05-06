# Icosa - BG3 Mod Translator

Desktop application for translating Baldur's Gate 3 mods. Built with Electron, React 19 and TypeScript on the electron-vite scaffold.

For full architectural context, IPC surface, hot spots and conventions, see [CLAUDE.md](CLAUDE.md). For the active refactoring plan, see [REFACTORING.md](REFACTORING.md).

## Recommended IDE setup

- [VSCode](https://code.visualstudio.com/) with the [Biome](https://marketplace.visualstudio.com/items?itemName=biomejs.biome) extension. Biome replaces ESLint and Prettier in this project, so do not install or enable them.

## Runtime requirements

- Node.js 20+
- pnpm
- **.NET 8.0 runtime** on the host machine - required by the bundled `Divine.exe` (LSLib) used to pack and unpack `.pak` files.

## Setup

```bash
pnpm install
```

## Development

```bash
pnpm dev               # Start Electron + Vite HMR
pnpm typecheck         # Run both node and web typechecks
pnpm lint              # Biome lint
pnpm format            # Biome auto-format
pnpm db:studio         # Open Drizzle Studio (DB GUI)
```

After changing the Drizzle schema, generate a new migration:

```bash
pnpm drizzle-kit generate
```

## Build

```bash
pnpm build:win         # Windows installer
pnpm build:mac         # macOS bundle
pnpm build:linux       # Linux package
```

`pnpm build` runs typecheck and produces an unpacked build without an installer.
