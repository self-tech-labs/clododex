# Agent Arena Agent Guide

Use this guide when a coding agent is asked to work in this repository.

## Project Shape

Agent Arena is a Next.js app that turns the AI agent race into a public, remixable arena. The dashboard renders data from file-first arena manifests and generated snapshots.

Key paths:

- `app/`: Next.js routes.
- `app.jsx` and sibling `*.jsx` files: dashboard UI.
- `src/arena/`: file-first arena core, snapshot building, validation, metrics, evidence, and battle logic.
- `data/arena/`: contenders, characters, concepts, signals, battle config, and generated arena snapshots.
- `data/intel/`: compatibility intel snapshots and daily data.
- `scripts/`: validation, snapshot generation, and concept creation scripts.
- `test/`: Node test suite.

## Commands

```bash
npm install
npm run dev
npm run test
npm run lint
npm run arena:validate
npm run arena:offline
npm run build
```

Use `npm run concept:new -- --kind <kind> --id <id>` to scaffold a concept manifest.

## Working Rules

- Prefer small, reviewable PRs.
- Preserve the file-first arena data model.
- Update tests when changing shared logic, data contracts, reducers, validation, or battle behavior.
- Run `npm run arena:validate` after editing `data/arena/`.
- Run `npm run build` before claiming a release-ready UI or route change.
- Keep generated dependency folders and local build output out of git.

## Evidence and Safety

This project can reference real people, companies, products, and social posts. Keep it credible:

- Use public sources for factual claims.
- Do not present weak model inferences as facts.
- Avoid harassment, impersonation, defamatory claims, and private personal information.
- Keep game mechanics, jokes, and predictions clearly separate from sourced facts.

## Fresh Intel Workflow

The baseline app can build from seeded/offline data. A maintainer with local credentials can fetch fresh X data and rebuild snapshots:

```bash
npm run intel:build
npm run arena:build
```

Expected local environment variables:

```bash
X_BEARER_TOKEN=...
XAI_API_KEY=...
```

Do not commit `.env` or fetched secrets. Commit only reviewed snapshot/data changes that should become part of the public dashboard.

## PR Notes

When preparing a PR, include:

- Summary of the user-facing change.
- Files or data surfaces touched.
- Checks run.
- Screenshots for UI changes.
- Coding agent/tool disclosure when applicable.
