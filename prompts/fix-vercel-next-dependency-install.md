# Fix Vercel Next.js Dependency Installation

## Goal

Fix the Vercel production build failure `sh: line 1: next: command not found` without changing the CampusLink server architecture or production API environment values.

## Verified repository facts

- The repository root `package.json` defines `build` as `npm --prefix client run build` and does not declare npm workspaces.
- `client/package.json` already declares `next@16.3.5`, `react@19.2.8`, and `react-dom@19.2.8`, with `dev`, `build`, and `start` scripts.
- `client/package-lock.json` is lockfile version 3 and records those dependencies.
- The server has its own package manifest and lockfile; it is a separate backend and is not part of the Next.js build.
- Root `vercel.json` currently has `installCommand: "npm install && npm --prefix client ci"`.
- The supplied Vercel log shows a single successful install message, then runs root `npm run build`, which delegates to the client. This is consistent with Vercel installing only root dependencies (for example, due to a dashboard install-command override), rather than installing the client dependency tree.
- `client/next.config.ts` uses `API_SERVER_URL` for rewrites; keep that behavior and all deployment environment values unchanged.

## Planned implementation

1. Configure Vercel to use `client` as the Root Directory so install and build commands resolve against `client/package.json` and `client/package-lock.json` directly.
2. Simplify the checked-in Vercel configuration for that root: use standard client-local `npm ci` and `npm run build` commands, removing the root-plus-client install chain that can select the wrong package directory. Keep the root package scripts intact for local monorepo development and preserve `server/` configuration.
3. Do not add or upgrade dependencies: the client already has compatible Next.js and React versions.
4. Run the requested client install/build verification (`npm ci`, then `npm run build` from `client`) and diagnose any subsequent actual build error without changing API URL configuration.

## Acceptance criteria

- Vercel project Root Directory is set to `client`.
- The client retains `dev`, `build`, and `start` scripts and its existing dependency versions.
- A clean client install makes the `next` executable available and `npm run build` completes.
- Root and server manifests and server deployment behavior remain unchanged.
- Final report identifies files changed, Root Directory setting needed, verification outcome, and Git commands to commit and push.
