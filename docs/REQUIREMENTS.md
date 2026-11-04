# PDF Desk — version one scope

Status: Focus visual direction approved. Version one implemented and accepted by the user after a real document workflow. The public v1.0.0 release under MIT is authorised. Verification results and measured limitations are recorded in the project's README and docs/VALIDATION.md.

## Purpose and delivery

A single-user Windows application running in a local browser. A Windows shortcut launches a loopback-only local server and opens the app. The installed app works offline; all scripts, fonts, icons, and PDF libraries are bundled. No accounts, file uploads, analytics, or external services. Public GitHub publication as `pdf-desk` is authorised by the user.

## Workspace

- Thumbnail sidebar and a large selected-page preview.
- Page navigation, zoom, fit-to-page, and fit-to-width. No text search or text selection in version one.
- Click, Ctrl-click, Shift-click, select all, and explicit page ranges such as `1–5, 8, 12–15`.
- Selected pages remain visibly marked; the active page drives the preview.
- Accessible names, keyboard operation, visible focus, and clear empty, loading, error, selection, and unsaved states.
- Desktop first, usable in current Windows Chrome and Edge. Adapt controls to narrower windows. Mobile is not a version-one support target.

## Inputs and limits

- Unencrypted, regular PDFs, JPEGs, and PNGs. Drag-and-drop and file picker.
- 100 MB combined source-file limit per working document, interpreted as 100,000,000 bytes. Validate before importing; explain the limit and keep the existing workspace intact on rejection.
- File size is an initial supported-input boundary, not a performance guarantee. Validate representative scanned and text-heavy documents during implementation. Lazy previews and background processing should keep ordinary interactions responsive.
- No additional page-count limit initially. Add one only if testing reveals a clear need and review the resulting scope change with the user.
- Reject encrypted, corrupt, and unsupported files with an actionable error. Allow other valid files in an import batch to proceed, with a clear per-file result.
- Importing another PDF preserves its internal page order and original page sizes.
- Insert one JPEG or PNG per page, preserving aspect ratio, fitting without cropping. Default A4 portrait; allow Letter, matching the selected page, and portrait/landscape. Respect image orientation metadata.
- Blank pages: A4, Letter, or match the selected page; portrait/landscape. Matching falls back to A4 if there is no selected page.

## Page operations

- Merge multiple inputs into one working document.
- Append new files by default; alternatively insert before or after the active page.
- Reorder by dragging thumbnails and by an explicit move-before/after-page command.
- Move selected groups together, retaining their relative document order.
- Delete, duplicate, and rotate selected pages in 90-degree increments.
- Insert blank pages. All supported page operations work with multiple selection where applicable.
- Undo and redo imports and page operations for the current session. Editing after undo clears the redo branch.
- No automatic session recovery in version one. Warn before browser refresh/close when changes are unsaved, within browser restrictions, and confirm before clearing the current document.

## Export and original protection

- Export the complete working document or selected pages, preserving current order and rotations.
- Save a new PDF using a descriptive default filename ending in `-edited.pdf`; allow renaming.
- Source files are read-only inputs. The app does not write changes back to original files. Use a browser download/save-copy flow; the user controls the final destination through browser/OS UI.
- Do not claim to prevent a user manually choosing an existing filename in the OS save dialog. Default to a distinct filename and never offer an in-place overwrite action.
- Disable export when no pages exist; selected-page export requires a nonempty selection.
- Preserve text and vector content when copying PDF pages; do not rasterize ordinary PDF pages. Imported images are embedded as image content.
- Show progress and actionable export errors; failed export leaves the arrangement available for retry.

## Out of scope

Editing existing page content, annotations, signatures, cropping, watermarks, page numbering, OCR, compression controls, automatic multi-file splitting, cloud sync, collaboration, accounts, and session recovery. No support guarantees for interactive forms, bookmarks, links, attachments, PDF accessibility tags, digital signatures, or specialist archival/print standards. These are not part of the regular-PDF acceptance set.

## Design review

- Working name: PDF Desk. Restrained light interface, clear labelled actions.
- Focus direction: vertical thumbnail list, compact page toolbar, dominant document canvas.
- Workbench alternative: two-column thumbnail sidebar and a more explicit tool ribbon.
- Prototype interactions demonstrate selection, ranges, reorder, rotation, duplication, deletion, undo/redo, insertion, empty workspace, and save-copy dialog using sample content.
- Prototype insertion settings and save controls communicate intended layout; actual file import, page-size rendering, full zoom/fit behaviour, downloads, and persistent sessions belong to implementation.
- User approval of visual direction is required before implementation, as requested.

## Acceptance criteria

1. After installation, the Windows shortcut opens a usable app without internet access; app runtime makes no external network requests.
2. Import two known PDFs, one JPEG, and one PNG. Page counts and order match the inputs, and images are proportional and uncropped.
3. Reject an input batch that would exceed the 100 MB combined limit without corrupting the current document. Surface clear feedback for encrypted/corrupt inputs.
4. Select pages through click, Ctrl/Shift selection, select-all, and a valid range; reject invalid ranges without silently selecting the wrong pages.
5. Reorder a multi-page selection, rotate, duplicate, delete, and insert a blank page; undo and redo restore the expected page sequence and rotations.
6. Export all pages and a noncontiguous selection. Independently reopen the resulting PDFs and verify page count, order, dimensions, rotation, representative visual content, and retained text content.
7. Original source-file hashes remain unchanged after import, editing, and export.
8. Import/export failures leave the app usable and preserve the current document for retry.
9. Verify unsaved-change confirmation when starting over and browser close/refresh warnings where supported.
10. Validate the selected visual design at ordinary laptop and desktop widths, keyboard navigation, and representative small and near-limit documents. Record measured performance and any confirmed limitations in the README.

## Portfolio deliverables

Source code, dependency/launch instructions, suitable automated checks for PDF correctness and state transitions, a polished README, screenshots using synthetic documents, known limitations, and a factual note describing AI assistance. No personal documents, secrets, or generated private data in the repository. Choose a licence explicitly before public release.
