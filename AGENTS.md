# AGENTS.md

## Repo Shape
- This is a plain HTML/CSS/JS Chrome Manifest V3 extension. PDF/OCR dependencies are vendored locally; there is no package manager, build step, lint config, or CI.
- Load/test it manually from `chrome://extensions` with Developer Mode -> Load unpacked -> this repo root.
- `manifest.json` is the source of truth for entrypoints, permissions, and host access.

## Runtime Flow
- `popup.html` / `popup.js` is the extension action UI and starts generation.
- `content.js` is injected on `https://azc.defensoria.mg.def.br/*` and extracts rows from AZC using brittle page CSS selectors such as `.GB2UA-DDKIC` and `tr.GB2UA-DDMIC`.
- `options.html` / `options.js` stores user configuration in `chrome.storage.local`: `name`, `masp`, and `signature`.
- `popup.js` builds `draftData` in `chrome.storage.local`, then opens `preview.html`.
- The popup also opens `import.html` / `import.js` for local PDF imports. `pdf-extractor.js` orchestrates PDF.js and OCR; `pdf-parser.js` validates table geometry, dates and punches. `ocr-worker.js` owns the nested Tesseract worker for cancellable initialization and recognition.
- `preview.html` / `preview.js` lets the user edit punches, then opens a generated printable HTML document for PDF/printing.
- `timesheet.js` shares schedule validation and printable document generation. Imported drafts add optional `timesheet.source`, `timesheet.period` and row review metadata while retaining legacy drafts.

## Verification
- Run `node --test tests/*.test.mjs` with Node.js 22.7+ for parser and document rules. No package installation is needed.
- After changes, reload the unpacked extension in Chrome and test against an open AZC tab, and test PDF import offline using a local monthly report. Keep personal PDFs out of the repo.
- Focused checks: options save/load, popup finds an AZC tab, extraction works on the "Minha Frequencia" / AP01 page, preview edits persist into final printable output.
- If changing `manifest.json`, reload the extension before retesting because Chrome does not apply manifest changes live.

## Constraints
- Keep dependencies limited to the explicitly requested, locally vendored PDF/OCR libraries. Do not introduce a package manager or build step without a request. Preserve versions, hashes and licenses in `vendor/` when updating those libraries.
- Avoid breaking stored `chrome.storage.local` keys (`name`, `masp`, `signature`, `draftData`) without a migration plan.
- Treat AZC DOM selectors as integration points; selector changes must be verified on the real portal.
- `logo.png` is declared as a web-accessible resource and is loaded into the generated draft as base64.
