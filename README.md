# PDF Desk

A small, offline PDF page organiser. Open files, arrange your pages, and save a new PDF. Built for a single user on Windows, with the **Focus** interface agreed during the design prototype stage.

![PDF Desk Focus workspace](docs/focus-workspace.png)

## Run it

1. Have **Node.js 22.13 or newer** installed and available on PATH.
2. Keep this folder together: the app includes its offline PDF libraries and assets.
3. Double-click **Start PDF Desk.cmd** or **Launch PDF Desk.vbs**. You can also create a Windows shortcut using the command below.

Your default browser opens PDF Desk, usually at <http://127.0.0.1:43127>. Reopening the launcher reuses the running app server. It opens another browser tab; it does not restore another tab's document. Each tab has its own in-memory document.

No npm install, account, internet connection, or cloud service is needed to run the supplied application. Do not open `public/index.html` directly: browser workers require the local HTTP server.

If you move the folder, the VBS/CMD launchers still work. Recreate the Windows shortcut with:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ".\Create shortcut.ps1"
```

To run with a visible terminal for diagnostics:

```powershell
npm run serve
# Or: node server.mjs --open
```

Use Ctrl+C to stop a terminal-launched server. For the hidden Windows launcher, close your app tabs after saving, then run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ".\Stop PDF Desk.ps1"
```

The stop script targets only launcher processes whose command line names this folder's server. Closing a browser tab alone leaves the small local server running until it is stopped or you sign out. If VBScript is unavailable on your Windows installation, use `node server.mjs --open` instead.

## What v1 does

- Merge regular PDFs and insert JPEG/PNG images or blank pages.
- Select pages with Ctrl-click, Shift-click, select-all, or ranges such as `1–5, 8, 12–15`.
- Drag pages to reorder them, or move selected groups before/after another page.
- Rotate, delete, and duplicate selected pages; undo and redo changes.
- Preview pages, jump to a page, zoom, fit a page, or fit its width.
- Insert before/after the active page or append to the end. Blank/image pages support A4, Letter, matching the selected page, and portrait/landscape.
- Export the complete document or selected pages to a new PDF.

Ordinary PDF pages keep their text and vector content; they are not screenshots. Images are fitted without cropping. JPEG orientation metadata is applied during import; JPEGs are normalised at high quality, while PNG transparency is retained.

**Originals remain read-only inputs.** The app never writes back to imported file paths. Export defaults to a separate `-edited.pdf` filename. The browser controls the download destination and may save directly into Downloads; enable its “ask where to save” option if you prefer a location prompt. A user can still manually choose an existing filename in the browser/OS save dialog.

The “Copy exported” indicator means the browser download was started; the app cannot verify that the user completed or retained that download. Exporting selected pages does not clear the full document's unsaved status.

## File limits and boundaries

The combined limit is **100 MB (100,000,000 bytes)** of imported source files. Files kept by undo/redo history count towards the limit, even after their pages are deleted. Starting a new document releases them. Duplicating a page does not count its source file again. Generated blank pages do not consume the source-file budget.

There is no fixed page-count cap. Memory and performance depend on the contents and your browser, not just file size. The current validation includes a 300-page text PDF and a 94.7 MB synthetic image-heavy PDF. Measurements and verification details are in [docs/VALIDATION.md](docs/VALIDATION.md).

V1 supports regular, unencrypted PDFs. Encrypted or password-protected files are rejected. Corrupt and unsupported files produce individual errors; valid files in the same import batch can still be added. A batch that would exceed the total size limit is rejected before import.

Content editing, annotations, OCR, cropping, watermarks, compression settings, automatic multi-file splitting, and session recovery are outside v1. Forms, bookmarks, links, attachments, signatures, accessibility tags, and archival/print conformance are not guaranteed to survive page assembly. Use ordinary PDFs for this version.

Documents and undo history exist only in the current browser tab's memory. Closing or refreshing loses the arrangement; the app requests a browser warning for unsaved changes, subject to browser restrictions. It does not save files or sessions into browser storage.

## Keyboard shortcuts

| Action | Shortcut |
| --- | --- |
| Add files | Ctrl+O |
| Save a copy | Ctrl+S |
| Select all pages | Ctrl+A outside a text field |
| Undo | Ctrl+Z |
| Redo | Ctrl+Shift+Z or Ctrl+Y |
| Duplicate selection | Ctrl+D |
| Delete selection | Delete |
| Previous / next page | Up / Down outside a text field |
| Extend selection | Shift+Up / Shift+Down |

## How it works

`server.mjs` serves static files on **127.0.0.1 only**. It accepts no file uploads and has no document-writing API. Input bytes, thumbnails, and PDF output stay in the browser process and its workers. A content security policy restricts resources and connections to the local app. No analytics, remote fonts, or external runtime scripts are used.

- `public/core.mjs`: selection, page ordering, and metadata-only undo/redo.
- `public/pdf-worker.mjs`: import validation, image normalisation, and document work off the main UI thread.
- `public/pdf-service.mjs`: page assembly using pdf-lib; shared page resources keep duplicates compact.
- `public/app.mjs`: Focus UI, lazy thumbnails, PDF.js preview, and browser downloads.
- `public/vendor/`: pinned, bundled offline dependencies, including PDF.js fonts, character maps and decoders.

The launchers require Node.js; PDF processing itself runs in browser workers. This is a local utility, not a hosted web service.

## Development and checks

The supplied assets are ready to run. Rebuilding them or installing browser test tooling uses npm:

```powershell
npm install
npm run vendor
npm run check
npm test
```

For browser integration checks, start the app in a separate terminal with `npm run serve`, then run:

```powershell
npm run test:browser
```

The integration script uses installed Microsoft Edge by default. Set `PDF_DESK_BROWSER=chrome` to check Chrome instead. Synthetic fixtures are included in `tests/fixtures/`. Tests generate files under ignored `test-results/`; the browser suite also refreshes README screenshots under `docs/`.

The optional `tests/generate-fixtures.py` regenerates synthetic fixtures and requires Python with ReportLab, Pillow and pypdf. These Python packages are not required to run PDF Desk.

After browser checks, `python tests/verify-exports.py` independently reopens the downloads with pypdf to check page count, order, dimensions, rotations and retained text.

## AI-assisted development

This project was developed with OpenAI Codex. The user defined the workflow, answered scope questions, approved an interactive Focus design prototype, and authorised v1. Codex drafted the implementation and tests, exercised the UI with synthetic documents in real browsers, and checked exported PDFs independently. AI involvement does not replace the recorded test evidence or the limitations above.

Read the [portfolio case study](docs/PORTFOLIO.md) for the scope, design decisions, human/AI roles and verification approach. The user has completed acceptance testing of a real document workflow and approved the saved result.

## Release and licence

Version **1.0.0** is released under the [MIT licence](LICENSE). See [CHANGELOG.md](CHANGELOG.md) for the release notes. Upstream dependencies retain their own licences, preserved in [docs/THIRD-PARTY.md](docs/THIRD-PARTY.md) and `docs/licenses/`.

GitHub: [jackhipperson/pdf-desk](https://github.com/jackhipperson/pdf-desk). Download the packaged app from [Releases](https://github.com/jackhipperson/pdf-desk/releases).
