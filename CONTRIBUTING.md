# Contributing to Clododex

Clododex is meant to be hacked on by humans and coding agents. Small PRs are welcome. Strange PRs are welcome. Keep the work focused enough that another maintainer can understand, run, and review it.

## Good First Contributions

- Add a new arena concept in `data/arena/concepts/`.
- Improve a character or contender manifest with public-source evidence.
- Add a daily battle, share card, leaderboard, season, or prediction surface.
- Improve the dashboard UI, motion, copy, or responsive behavior.
- Harden validation, tests, source handling, or deployment safety.

## Agent-Assisted PR Loop

1. Fork or clone the repository.
2. Ask your coding agent to read `README.md`, `CONTRIBUTING.md`, and `AGENTS.md`.
3. Give it one focused direction.
4. Review the diff like an owner.
5. Run the checks you can.
6. Open a PR with screenshots for UI changes and notes about what was verified.

Suggested prompt:

```text
You are contributing to Clododex, an open-source arcade intelligence platform for the AI agent race.

Read README.md, CONTRIBUTING.md, AGENTS.md, and the relevant source files. Pick one focused improvement that makes the platform more viral, useful, beautiful, monetizable, or community-driven. Implement it, run the available checks, and prepare a PR summary with screenshots or verification notes.
```

## Local Setup

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:3000`.

## Checks

Run the checks that match your change:

```bash
npm run test
npm run lint
npm run arena:validate
npm run build
```

For arena data changes, also run:

```bash
npm run arena:offline
```

## Data and Claims

- Use public sources for claims about real companies, products, or people.
- Do not add private personal information, leaked data, or unsourced allegations.
- Keep speculative content visibly framed as a prediction, inference, or game mechanic.
- Do not commit secrets, API keys, generated dependency folders, `.env`, `.next`, or local build output.

## Pull Request Expectations

Each PR should include:

- What changed.
- Why it matters.
- Screenshots or a short screen recording for UI changes.
- Which checks passed.
- Which coding agent or tools helped, if any.

Keep the PR narrow. Follow-up issues are better than one oversized diff.
