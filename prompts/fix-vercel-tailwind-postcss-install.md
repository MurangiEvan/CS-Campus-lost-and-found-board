# Fix Vercel Tailwind PostCSS Dependency Install

## Goal

Fix the Vercel Next.js production build failure where PostCSS cannot resolve `@tailwindcss/postcss`, without changing application code, runtime dependencies, server behavior, or deployment environment values.

## Verified repository facts

- `client/package.json` declares `@tailwindcss/postcss` and `tailwindcss` under `devDependencies`.
- `client/package-lock.json` contains `@tailwindcss/postcss` and records it as a development dependency.
- `client/postcss.config.mjs` loads the `@tailwindcss/postcss` plugin during the CSS build.
- `client/vercel.json` currently configures `installCommand` as `npm ci` and `buildCommand` as `npm run build`.
- The supplied Vercel log runs `npm ci`, installs 22 packages, and then fails because `@tailwindcss/postcss` is unavailable.

## Local hypothesis

The Vercel install is omitting development dependencies (for example, because `NODE_ENV=production` is set for the build environment). Since the CSS build needs the plugin, explicitly include development dependencies in the install command.

## Planned implementation

1. Change only `client/vercel.json` so `installCommand` is `npm ci --include=dev`.
2. Preserve the existing `buildCommand`, package manifests, lockfile, application code, and all server/deployment settings.
3. Verify a clean client install using the explicit include flag and run the client production build. Confirm the plugin resolves; report any unrelated build blocker without expanding scope.

## Acceptance criteria

- Vercel's configured install command explicitly includes development dependencies.
- The PostCSS plugin is available during `next build`.
- `npm run build` from `client` completes, or any remaining independent failure is reported precisely.
- No runtime dependency or server behavior changes are introduced.
