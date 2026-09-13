# Project instructions

- The user requires every subsequent project update to use Git version control. The canonical repository is https://github.com/s950329/wiring-panel-simulator, default branch `main`.
- Read `VERSION_CONTROL.md` and `ARCHITECTURE.md` before changing the project. Inspect the working tree and remote branch first; preserve concurrent user changes.
- For each authorized update, make a focused commit after relevant validation, push it to GitHub, and verify the remote commit. Report the commit link and validation outcome. Routine commits and pushes are part of the user's requested workflow; do not introduce an extra approval gate.
- Never force-push, rewrite existing history, or silently replace a newer remote tree. If remote work has advanced, integrate it before publishing. Use a feature branch and PR when requested or required by actual branch protection.
- Keep the website and downloadable HTML tied to the same application source and revision. Regenerate exports when application changes affect them. Preserve `.openai/hosting.json` and the existing Sites project identity when deploying this Site.
- Keep credentials, `node_modules/`, `dist/`, and preview runtime files out of Git. Do not store access tokens in remote URLs or configuration.
- The accepted geometry and terminal coordinates are protected by `qa/fixtures/model-baseline.json`. Do not replace that fixture merely to hide a regression. Report any intentionally changed geometry and its validation.
- Keep the TypeScript core strict. Do not conceal migration errors with `any`, `@ts-ignore`, or disabled checks. The existing JS model and routing modules are intentionally documented incremental migration boundaries.

