# FORK.md

This is `jasonsims/excalidraw`, a fork of [`excalidraw/excalidraw`](https://github.com/excalidraw/excalidraw). This file records how the fork is maintained and every way it differs from upstream.

## Branches

| Branch | Purpose |
| --- | --- |
| `master` | Clean mirror of `upstream/master`. Fast-forward only. Never commit here. |
| `deploy` | `master` plus this fork's changes. This is what gets deployed. |

## Remotes

| Remote     | URL                     |
| ---------- | ----------------------- |
| `origin`   | `jasonsims/excalidraw`  |
| `upstream` | `excalidraw/excalidraw` |

`git rerere` is enabled so conflict resolutions are remembered between syncs.

## Syncing with upstream

Sync regularly (weekly or monthly). Small, frequent syncs are much easier than one large one.

```bash
git fetch upstream
git checkout master && git merge --ff-only upstream/master
git push origin master

git checkout -b sync/upstream-YYYY-MM deploy
git merge master
yarn test:typecheck && yarn test:update
```

Open a PR from the `sync/*` branch into `deploy`, check the Vercel preview, then merge. After resolving conflicts, check the "Changes from upstream" list below.

## Rules for keeping the diff small

- Prefer configuration (env vars, `vercel.json`) over editing upstream source.
- Put new code in new files or folders (for example `api/`) so it can't conflict.
- Don't reformat or refactor upstream files.
- Mark unavoidable edits to upstream files with a `// FORK:` comment so `grep -rn "FORK:"` finds them all.
- Contribute generic fixes upstream so they stop being this fork's burden.

## Claude Code instructions

`CLAUDE.md` and `AGENTS.md` are upstream's files. Do not edit them, because any change conflicts on the next sync. Fork-specific instructions for Claude Code live in `.claude/rules/fork.md`, which Claude Code loads alongside `CLAUDE.md`.

`.claude` is in upstream's `.gitignore`. The rules file was added with `git add -f`, so it is tracked and edits to it show up normally. A new file under `.claude/` also needs `git add -f`. This avoids editing upstream's `.gitignore`.

## Deployment

- Host: Vercel, project imported from this repo.
- Production branch: `deploy` (Settings → Git).
- Root directory: `./`, preset Vite, build command `yarn build`, output directory `excalidraw-app/build` (set in `vercel.json`).
- Node.js: 22.x or 24.x (Node 20 is deprecated).
- Environment variables:
  - `VITE_APP_DISABLE_SENTRY=true`
- `VITE_APP_*` values are baked in at build time, so changing them needs a new build.

## Testing the build locally

Do this before pushing to `deploy` and after every upstream sync.

### Prerequisites

- Node.js 22 or 24 (the repo's `Dockerfile` builds on Node 24). `package.json` only requires `>=18`, but use a current version to match Vercel. `nvm install 24 && nvm use 24`
- Yarn classic (1.22.x), as pinned by `packageManager` in `package.json`. `corepack enable` (or `npm i -g yarn`)

### Production build (same steps Vercel runs)

```bash
yarn install
VITE_APP_DISABLE_SENTRY=true yarn build
```

- `yarn build` runs `vite build` in `excalidraw-app/` and then writes `build/version.json`.
- Output goes to `excalidraw-app/build/`. That is the directory Vercel serves.
- Setting `VITE_APP_DISABLE_SENTRY=true` matches the Vercel environment variable.
- The build needs a lot of memory. If it dies with an out-of-memory error, run it with `NODE_OPTIONS=--max-old-space-size=4096`.

### Serve the production build

```bash
yarn --cwd excalidraw-app build:preview   # builds, then serves on http://localhost:5000
```

To serve an existing build without rebuilding:

```bash
cd excalidraw-app && npx vite preview --port 5000
```

### Dev server (not a production check)

```bash
yarn start   # http://localhost:3000 by default, or VITE_APP_PORT if set
```

### Docker build (optional)

Builds with `yarn build:app:docker` (Sentry disabled) and serves with nginx:

```bash
docker build -t excalidraw-fork .
docker run --rm -p 3000:80 excalidraw-fork   # http://localhost:3000
```

### Checks to run before committing

```bash
yarn test:typecheck   # TypeScript
yarn test:update      # unit tests (updates snapshots)
yarn test:code        # eslint
yarn test:other       # prettier
yarn fix              # auto-fix formatting and lint issues
```

### Smoke test checklist

Open the built app and check:

- [ ] Page loads with no errors in the browser console
- [ ] Draw a rectangle, an arrow, and some text
- [ ] Hand-drawn fonts render (not a fallback font)
- [ ] Reload the page, and the drawing is still there (local autosave)
- [ ] Export to PNG and SVG works
- [ ] Save to file, then load the file back
- [ ] Dark mode toggle works

Expected to **not** work until backends are set up (see Backends): live collaboration, shareable links, and the AI features. Don't count those as build failures.

### Troubleshooting

| Symptom | Likely cause and fix |
| --- | --- |
| `yarn: command not found` | Run `corepack enable`, or `npm i -g yarn`. |
| Odd syntax or engine errors during install or build | Wrong Node version. Check `node -v` and switch to 22 or 24. |
| `Cannot find module @rollup/rollup-...` | Optional dependencies were skipped. Remove `node_modules` and run `yarn install` again without `--ignore-optional`. |
| Build killed or "heap out of memory" | Use `NODE_OPTIONS=--max-old-space-size=4096`. |
| Fonts missing on the deployed site only | The CORS headers in `vercel.json` are hardcoded to excalidraw.com. See "Known items to revisit". |
| Build passes locally but fails on Vercel | Compare the Node version and build command in Vercel settings with this section. |

## Backends

By default the app points at excalidraw.com's hosted services via `.env.production`. Only the editor itself is expected to work until backends are set up.

| Feature | Env var(s) | Status |
| --- | --- | --- |
| Share links | `VITE_APP_BACKEND_V2_GET_URL`, `VITE_APP_BACKEND_V2_POST_URL` | Not set up |
| Live collaboration | `VITE_APP_WS_SERVER_URL`, `VITE_APP_FIREBASE_CONFIG` | Not set up |
| AI (text-to-diagram, diagram-to-code) | `VITE_APP_AI_BACKEND` | Not set up |

## Changes from upstream

Add an entry here for every change on `deploy`, with the file(s) and the reason.

| Date | Files | Change | Why |
| --- | --- | --- | --- |
| 2026-10-13 | `excalidraw-app/index.html`, `excalidraw-app/index.tsx` | Install the Novus by Pendo web SDK: install snippet in `<head>`, anonymous `pendo.initialize` at app start. A `location` transform records only the URL fragment's parameter names. | Product analytics for this deployment. The fragment carries the collaboration and share-link encryption keys, which must not reach Pendo. |
| 2026-10-13 | `packages/excalidraw/analytics.ts`, `packages/excalidraw/components/TTDDialog/*` | `trackAgent` helper, and Pendo agent analytics on the text-to-diagram chat (prompt, response, retry and undo reactions). | Agent analytics for the AI chat. |
| 2026-10-13 | `packages/excalidraw/global.d.ts` | The only declaration of `Window.pendo`, with `initialize`, `track` and `trackAgent`. `excalidraw-app/global.d.ts` is identical to upstream. | Two separate declarations of `Window.pendo` conflicted and broke the typecheck and the production build. |
| 2026-10-13 | About 50 files in `excalidraw-app/` and `packages/excalidraw/` (`analytics.ts`, actions, `App.tsx`, collab, library, TTD, export) | Pendo track events through `trackPendoEvent`, 45 named events, plus optional `source` arguments on a few internal functions. `loadFileToCanvas` and `exportToExcalidrawPlus` now require a new argument. | Product analytics on editor and app usage. No URLs, keys or user content are sent. **High conflict risk on upstream sync.** |
| 2026-10-13 | `.claude/rules/fork.md` (new file) | Fork-specific Claude Code rules, kept separate from upstream's `CLAUDE.md` and `AGENTS.md`. | Lets the fork carry its own agent instructions without conflicting with upstream on sync. |
| 2026-10-14 | `excalidraw-app/fork/pendoVisitorId.ts` (new file), `excalidraw-app/index.tsx` | `pendo.initialize` takes its visitor id from localStorage key `pendo-visitor-id`, falling back to anonymous. | Lets automation (bots) identify itself to Pendo by writing the key before page load. Unauthenticated, so any browser can set any id. |
| 2026-10-22 | `packages/excalidraw/components/TTDDialog/common.ts` | `TTD_AGENT_ID` changed to the agent id Novus specifies for the text-to-diagram chat. The existing `trackAgent` calls (prompt, response, retry and undo reactions) are unchanged and report under the new id. | The chat's agent analytics were sent under a different agent id than the one selected in Novus. |

## Known items to revisit

- `vercel.json` has headers and redirects hardcoded for excalidraw.com (CORS origin, `vscode.excalidraw.com`, `/webex`). Change them if fonts or assets fail to load on this deployment's domain.
- Links to Excalidraw+ remain in the app.
