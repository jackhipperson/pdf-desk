# PDF Desk: an AI-assisted local PDF organiser

## The problem

I wanted a small tool for an everyday document task: merge PDFs, put their pages in the right order, insert extra pages, and save a new copy. The application needed to run locally and keep original files untouched.

## My role

I defined the workflow, worked through scope questions, selected the features and limits, and reviewed an interactive design prototype before authorising implementation. I chose the Focus layout: a thumbnail sidebar with a large preview. I then tested a real document workflow and accepted the saved result.

## How I used AI

I used OpenAI Codex to turn the agreed scope into a requirements document, prototype, implementation and tests. Codex wrote the application and ran automated and real-browser checks. My decisions and acceptance testing provided the product direction; the code is AI-assisted work, with the verification evidence and limitations documented alongside it.

## Decisions that kept the project focused

- **Page management first.** Existing text editing, OCR and annotation were excluded from v1.
- **Local processing.** The server serves bundled application assets; document processing happens in browser workers.
- **A visual workflow.** Thumbnails support selection and ordering, while a large preview helps inspect the active page.
- **Copy-based export.** Source files are read-only inputs and export uses a separate filename.
- **A defined boundary.** Inputs have a 100 MB combined cap and version one targets regular, unencrypted PDFs.

## Implementation

Plain JavaScript modules, CSS and a small Node.js static server keep the runtime simple. PDF.js renders previews, and pdf-lib assembles the output. Undo/redo stores page metadata rather than duplicate document bytes. Lazy thumbnails and worker-based processing help handle larger documents. All runtime libraries, fonts, character maps and decoders are bundled for offline use.

## Evidence

The release passed 28 Node tests and browser integration checks in Microsoft Edge and Google Chrome. The browser checks exercised imports, page operations, downloads, errors, keyboard controls, unsaved-change warnings and narrower layouts. They also checked that original-file hashes remained unchanged and the application made no external runtime requests.

Generated PDFs were independently reopened and rendered to inspect page count, order, dimensions, rotation, retained text and image orientation. Larger synthetic checks included a 300-page text document and a 94.7 MB image-heavy PDF. These checks show what was exercised; they do not imply compatibility with every PDF or machine. Full details are in [VALIDATION.md](VALIDATION.md).

## Result and boundaries

PDF Desk v1 completes the intended local page-management workflow and passed my acceptance test. It deliberately stops short of a full PDF content editor. Session recovery, encrypted files and reliable preservation of specialist PDF features are outside the release scope.

The finished source, screenshots, test fixtures, requirements and known limitations make the project reviewable as an example of scoping, design approval and evidence-based AI-assisted development.
