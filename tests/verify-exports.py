"""Independent checks on browser-suite downloads. Requires pypdf; no app dependency."""
from pathlib import Path
import sys
from pypdf import PdfReader

results = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent / 'test-results'
all_pages = PdfReader(results / 'all-pages.pdf')
selected = PdfReader(results / 'selected-pages.pdf')
assert len(all_pages.pages) == 7
assert len(selected.pages) == 3
assert [page.rotation for page in all_pages.pages] == [0, 0, 0, 0, 0, 90, 90]
assert (float(all_pages.pages[4].mediabox.width), float(all_pages.pages[4].mediabox.height)) == (792, 612)
assert 'The brief.' in all_pages.pages[0].extract_text()
assert 'A clear' in all_pages.pages[1].extract_text()
assert 'A little more' in all_pages.pages[5].extract_text()
assert 'Materials' in all_pages.pages[6].extract_text()
assert [page.extract_text() for page in selected.pages] == [all_pages.pages[i].extract_text() for i in (0, 5, 6)]
print('Independent PDF checks passed: page count, selection, order, dimensions, rotations and retained text.')
