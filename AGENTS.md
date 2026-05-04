# AGENTS.md

## Repo Shape
- This is a dependency-free Chrome Manifest V3 extension; there is no package manager, build step, lint config, test suite, or CI in the repo.
- Load/test it manually from `chrome://extensions` with Developer Mode -> Load unpacked -> this repo root.
- `manifest.json` is the source of truth for entrypoints, permissions, and host access.

## Runtime Flow
- `popup.html` / `popup.js` is the extension action UI and starts generation.
- `content.js` is injected on `https://azc.defensoria.mg.def.br/*` and extracts rows from AZC using brittle page CSS selectors such as `.GB2UA-DDKIC` and `tr.GB2UA-DDMIC`.
- `options.html` / `options.js` stores user configuration in `chrome.storage.local`: `name`, `masp`, and `signature`.
- `popup.js` builds `draftData` in `chrome.storage.local`, then opens `preview.html`.
- `preview.html` / `preview.js` lets the user edit punches, then opens a generated printable HTML document for PDF/printing.

## Verification
- After changes, reload the unpacked extension in Chrome and test against an open AZC tab; there is no automated verification command.
- Focused checks: options save/load, popup finds an AZC tab, extraction works on the "Minha Frequencia" / AP01 page, preview edits persist into final printable output.
- If changing `manifest.json`, reload the extension before retesting because Chrome does not apply manifest changes live.

## Constraints
- Keep the app dependency-free unless explicitly requested; current files are plain HTML/CSS/JS.
- Avoid breaking stored `chrome.storage.local` keys (`name`, `masp`, `signature`, `draftData`) without a migration plan.
- Treat AZC DOM selectors as integration points; selector changes must be verified on the real portal.
- `logo.png` is declared as a web-accessible resource and is loaded into the generated draft as base64.
