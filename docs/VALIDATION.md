# Version-one validation

Validated on 4 November 2026 on this Windows machine. These checks establish the exercised cases; they are not a guarantee for every PDF or every 100 MB document.

User acceptance is complete: the user confirmed a real document workflow and its saved result worked, then approved the MIT-licensed public v1.0.0 release.

## Automated and browser checks

- 28 Node tests: page range validation, group ordering, insertion positions, page dimensions, selection anchors, undo/redo branching, source retention, export naming, PDF copying/rotation/duplication, input immutability, resource sharing, and local server behaviour.
- Browser integration passed in installed Microsoft Edge and Google Chrome: offline-only requests; actual multi-file import and previews; lazy thumbnails; drag reordering; range selection; rotate/duplicate/move/delete; undo/redo; Letter landscape blank-page insertion; preview sizing; full and selected-page downloads.
- Invalid/corrupt/encrypted files: valid images in the same batch continue importing with individual errors.
- A synthetic file over the 100 MB combined cap is rejected without changing the document.
- Original source SHA-256 hashes remain unchanged after import, editing and export.
- Keyboard shortcuts, new-document confirmation, browser unsaved-refresh warning, and 1024/768/390-pixel layouts.
- A simulated worker-side export error retains the document and permits retry.
- Zero app runtime exceptions and zero external runtime requests in the passing browser suite.

## Independent PDF review

Browser-produced files were reopened with Python pypdf and rendered with Poppler, independently of the authoring library. The small mixed-file export was checked for:

- Seven output pages and the correct noncontiguous three-page selection.
- Expected page order, retained text markers, and 90-degree rotations.
- The inserted 792 × 612 pt Letter landscape blank page.
- Proportional PNG placement and the JPEG's applied EXIF orientation.
- Visual review of all seven exported pages with no clipping or missing content.

The large text and image-heavy exports were independently checked for page counts, page sizes, matching extracted text, and byte-identical compressed image streams.

## Measured large-document checks

Headless Microsoft Edge, 1366 × 900 viewport; synthetic fixtures; one local run. Times include browser automation and are rounded, so treat them as indicative rather than benchmarks.

| Input | Size | Pages | Import ready | First preview | Last-page navigation | Export/download |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Text-heavy PDF | 0.23 MB | 300 | 0.21 s | 0.45 s | 0.42 s | 0.60 s |
| Synthetic image-heavy PDF | 94.65 MB | 7 | 0.24 s | 0.46 s | 0.19 s | 1.11 s |

Only nearby thumbnails were rendered for the 300-page test (nine canvases after jumping to the last page). PDF assembly runs in a dedicated worker; PDF.js uses its own worker for parsing. Preview canvas resolution is capped to avoid excessive allocations at high zoom.

The image-heavy fixture contains deterministic, poorly compressible image data. Real scans with unusual encodings or very high page dimensions can behave differently. Memory profiling across browsers and exhaustive file-format compatibility testing have not been performed.

## Reproducing checks

See the README for Node and browser test commands. Synthetic small fixtures are included in `tests/fixtures/`. The optional Python fixture script requires ReportLab, Pillow and pypdf. It is not required by the application.

## Supported boundary

Windows Chrome/Edge desktop workflow, regular unencrypted PDFs, JPEG/PNG images, in-memory editing, and a 100,000,000-byte combined source-file cap. No persistence across refresh/close, content editing, OCR, password handling, or preservation guarantee for forms/bookmarks/signatures and specialist PDF features. Browser download completion cannot be confirmed by the app.
