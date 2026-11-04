"""Synthetic documents for browser QA; no personal data. Run with Python + reportlab/Pillow/pypdf."""
from pathlib import Path
from io import BytesIO
import sys
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from PIL import Image, ImageDraw
from pypdf import PdfReader, PdfWriter

destination = Path(sys.argv[1])
destination.mkdir(parents=True, exist_ok=True)
ink, muted, accent = map(HexColor, ['#263e50', '#60717e', '#236b83'])

def document(path, titles):
    c = canvas.Canvas(str(path), pagesize=(595.28, 841.89), pageCompression=1)
    c.setTitle('Garden studio - synthetic sample')
    for index, title in enumerate(titles):
        c.setFillColor(ink); c.setFont('Helvetica', 10); c.drawString(55, 785, 'FIELDWORK / STUDIO')
        c.setFillColor(accent); c.rect(504, 785, 36, 7, fill=1, stroke=0)
        c.setFillColor(muted); c.setFont('Helvetica', 10); c.drawString(55, 668, 'GARDEN STUDIO / PROJECT DOCUMENTS')
        c.setFillColor(ink); c.setFont('Times-Roman', 48)
        for i, line in enumerate(title.split('|')): c.drawString(55, 610 - i * 51, line)
        c.setFont('Helvetica', 12); c.setFillColor(muted)
        c.drawString(55, 465, 'A quiet place for everyday work.')
        c.drawString(55, 443, 'Synthetic sample for PDF Desk - no personal information.')
        if index == 0:
            c.setStrokeColor(HexColor('#dbe7ec')); c.setLineWidth(0.5)
            for x in range(55, 541, 24): c.line(x, 180, x, 380)
            for y in range(180, 381, 24): c.line(55, y, 540, y)
            c.setFillColor(HexColor('#f4f8fa')); c.setStrokeColor(accent); c.setLineWidth(2)
            c.rect(150, 228, 276, 108, fill=1, stroke=1); c.line(260, 228, 260, 336)
            c.setLineWidth(5); c.line(170, 228, 225, 228)
        else:
            c.setStrokeColor(HexColor('#e2e8ed')); c.setLineWidth(1)
            for y in range(220, 391, 28): c.line(55, y, 515 - (y % 3) * 40, y)
        c.setStrokeColor(HexColor('#e2e8ed')); c.setLineWidth(0.7); c.line(55, 70, 540, 70)
        c.setFont('Helvetica', 9); c.setFillColor(muted); c.drawString(55, 48, 'Garden studio - project documents'); c.drawRightString(540, 48, f'{index + 1:02}')
        c.showPage()
    c.save()

document(destination / 'Project brief.pdf', ['A little more|room to grow.', 'The brief.', 'Materials|and finishes.'])
document(destination / 'Estimate.pdf', ['A clear|starting point.'])
reader = PdfReader(destination / 'Estimate.pdf'); writer = PdfWriter(); writer.append(reader); writer.encrypt('test-password'); writer.write(destination / 'Encrypted.pdf')
(destination / 'Broken.pdf').write_bytes(b'%PDF-1.7\nnot a valid document')
image = Image.new('RGB', (900, 450), '#e4edf1'); draw = ImageDraw.Draw(image); draw.rectangle((80, 70, 820, 380), fill='#236b83'); draw.rectangle((140, 125, 390, 325), fill='#f7fbfc'); draw.text((455, 210), 'GARDEN STUDIO', fill='white'); image.save(destination / 'Landscape.png')
exif = Image.Exif(); exif[274] = 6
image.save(destination / 'Orientation.jpg', quality=94, exif=exif)
print(destination)
