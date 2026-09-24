# Moving the TRON workspace

Keep both checkouts until the new one has been verified. Never copy `.git` from the original checkout over the website submodule.

From `/Users/steve/_projects/Active/TRON`, preview the local-file transfer:

```sh
python3 scripts/migrate-workspace.py
```

Then perform it:

```sh
python3 scripts/migrate-workspace.py --apply
```

The default destination is `/Users/steve/_projects/Active/dekorte.com/fun/TRON`. Both checkouts must have matching HEAD commits and clean tracked files. The script copies missing ignored/untracked files, including credentials, local spend state, dependencies, browser downloads and test captures. Existing identical files are skipped; differing files abort the transfer before copying. Source files and Git metadata are never removed. Stop servers and tests before copying so files do not change during transfer. Empty directories are not copied. A filesystem error can leave a partial copy; retain the source and inspect any conflicts on the next run.

Credentials remain ignored local files: do not add them to Git. Codex history and personal configuration remain in the existing Codex home, outside both repositories; this script does not relocate or edit them. Keep the same Codex account/home and resume the same session rather than starting a new conversation:

```sh
cd /Users/steve/_projects/Active/dekorte.com/fun/TRON
export PLAYWRIGHT_BROWSERS_PATH="$PWD/.playwright-browsers"
codex resume 01a0b7f9-a834-7151-b638-94b5900ea6a0 \
  -C "$PWD" --sandbox workspace-write --ask-for-approval never \
  -c 'sandbox_workspace_write.network_access=true'
```

Existing servers still serve the old directory until restarted. Run `npm run dev` from the new directory after stopping the old server. Copied dependencies/browser binaries assume the same machine and architecture.

## Handoff notes — September 23, 2026

- Latest pushed game commit: `e347249`, recognizer spotlight surface reach. Prior commit `24f1c3e` includes Solar Sailer, carrier materialization, AI/performance, shadows and docs improvements.
- Read `Goal.md`, `AGENTS.md`, `docs/_index.md`, and `docs/validation/_index.md`. JEV design is in `docs/jev/_index.md`.
- Edit Markdown/JSON documentation sources only; `npm run docs` regenerates HTML through the project wrapper and embeds CSS for local Safari viewing.
- Latest spotlight fix extends downward ribbons beyond the old 260 m limit and removes endpoint fading on clipped surfaces. Eleven targeted tests, Chrome searchlight rendering check, and build passed. It retains existing wall/floor clipping; it did not add dynamic vehicle/debris ray intersections.
- Carrier materialization: fixed world-space panel, front-to-back reveal at travel speed, red wires/live lights, yellow pulsing rim, gray center opacity 0.5 feathering to zero at the rim, two-second solid fade.
- Solar Sailer: first pass after three minutes, speed 280 m/s, beam fades in for three seconds and out for nine seconds, with a gap through the ship.
- Carrier derez audio candidates are extracted and cataloged, but not enabled in gameplay; listening approval remains outstanding.
- Deliberate recognizer landing/block/rest tactics are documented future work, not implemented.
- User changed `docs/credits.txt`; preserve their current text.
- Do not deploy automatically. Commit/push only when requested.
