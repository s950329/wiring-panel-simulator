# Version control

The canonical development repository is https://github.com/s950329/wiring-panel-simulator, branch `main`.

The existing Sites source history through `3291294af2dace9de8f3fe27d0d76357630f9655` is the WIRE-R2 application baseline. The initial GitHub source import preserves GitHub's existing instructions commit as its parent. Earlier source history remains in the existing Sites repository.

For each update:

1. Read `AGENTS.md` and `ARCHITECTURE.md`, inspect local status and GitHub `main`, and integrate concurrent changes.
2. Change the shared application source and advance `src/revision.js` when application behavior changes.
3. Run `npm test`, regenerate the standalone HTML with `npm run offline`, and run `npm run build`.
4. Commit and push the validated source to GitHub without force; verify the remote tree and commit.
5. Push the same source tree to the existing Sites repository, package its build output, and publish. Verify successful deployment and report the GitHub commit link.

`node_modules/`, `dist/`, preview runtime data, and reproducible exports are not source. Original reference photos are excluded from the canonical GitHub tree; the application uses only the cropped nameplate textures. Source photo filenames and crop coordinates are retained as attribution metadata, while the original images remain in prior Sites history. Historical exports remain available in the earlier Sites history; new exports are regenerated from current source. The website download and standalone file must be built from the same revision. Do not store credentials in tracked files, Git configuration, or remote URLs.

When direct Git transport is unavailable, use GitHub's blob/tree/commit/ref APIs. Base the new commit on the current GitHub `main`, preserve its files, upload binary files as base64 blobs, and verify every file's blob hash. Site and GitHub commit hashes may differ in this workflow; verify all application source files against their local blob hashes. The user explicitly approved importing all 54 tracked files, including the four cropped PNG nameplate textures, into the private repository on 2026-09-13. This supersedes the earlier automatic approval blocker for this payload. Original full reference photographs remain outside the imported tree. Use the normal commit/push/verify workflow for subsequent user-authorized project updates.
