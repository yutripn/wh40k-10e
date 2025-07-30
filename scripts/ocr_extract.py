"""
OCR extraction utility for scanned Warhammer 40K/30K catalog PDFs.

This script converts each PDF page to an image using pdf2image,
performs OCR with pytesseract and attempts to parse catalog
entries arranged in rows and columns. It outputs a CSV with
Catalog Number, Faction, Model Name and Price.

Assumptions:
  * Text blocks are read in natural reading order (sorted by top then left).
  * The first line of each entry contains a catalog number.
  * The following line is the faction name.
  * One to three subsequent lines make up the model name.
  * The final line containing currency figures is treated as the price.

These heuristics may need tuning for different catalogs.
Debug mode saves images with bounding boxes to help refine them.
"""

import csv
import re
from pathlib import Path
from typing import List, Dict, Optional

from pdf2image import convert_from_path
from PIL import Image, ImageDraw
import pytesseract


def convert_pdf_to_images(pdf_path: Path, dpi: int = 300) -> List[Image.Image]:
    """Convert each page of the PDF to a PIL image."""
    return convert_from_path(str(pdf_path), dpi=dpi)


def ocr_page(image: Image.Image) -> List[Dict[str, str]]:
    """Run OCR on an image and return pytesseract data dictionaries sorted by position."""
    data = pytesseract.image_to_data(image, output_type=pytesseract.Output.DICT)
    entries = []
    for i in range(len(data["text"])):
        if int(data["conf"][i]) > -1 and data["text"][i].strip():
            entries.append(
                {
                    "text": data["text"][i].strip(),
                    "left": data["left"][i],
                    "top": data["top"][i],
                    "width": data["width"][i],
                    "height": data["height"][i],
                }
            )
    # Sort text boxes roughly in reading order
    entries.sort(key=lambda e: (e["top"], e["left"]))
    return entries


def clean_catalog_number(text: str) -> str:
    """Clean common OCR mistakes in catalog numbers."""
    text = text.replace("O", "0").replace("o", "0")
    text = text.replace("I", "1").replace("l", "1")
    return re.sub(r"\s", "", text)


def is_price(text: str) -> bool:
    """Return True if text looks like a price."""
    return bool(re.search(r"[$£€]?\d+(\.\d{2})?", text))


def parse_entries(lines: List[Dict[str, str]]) -> List[Dict[str, str]]:
    """Parse OCR text lines into structured catalog entries."""
    entries = []
    current: Optional[Dict[str, str]] = None
    name_lines: List[str] = []

    for line in lines:
        text = line["text"]
        # Price line signals the end of the entry
        if is_price(text):
            if current:
                current["model_name"] = " ".join(name_lines).strip()
                current["price"] = text
                entries.append(current)
            # Reset state for the next entry
            current = None
            name_lines = []
            continue

        # Start of a new entry assumed to be catalog number
        if current is None:
            current = {"catalog_number": clean_catalog_number(text)}
            continue

        if "faction" not in current:
            # Second line is expected to be the faction name
            current["faction"] = text
            continue

        # Remaining lines form the model name
        name_lines.append(text)

    return entries


def extract_catalog(pdf_path: Path, output_csv: Path, dpi: int = 300, debug: bool = False) -> None:
    """Extract catalog data from a scanned PDF and save to CSV."""
    pages = convert_pdf_to_images(pdf_path, dpi)
    results = []
    for page_num, page in enumerate(pages, 1):
        lines = ocr_page(page)
        entries = parse_entries(lines)
        for entry in entries:
            entry["page"] = page_num
            results.append(entry)

        if debug:
            draw = ImageDraw.Draw(page)
            for line in lines:
                bbox = [line["left"], line["top"], line["left"] + line["width"], line["top"] + line["height"]]
                draw.rectangle(bbox, outline="red", width=1)
            debug_path = output_csv.with_name(f"debug_page_{page_num}.png")
            page.save(debug_path)

    with open(output_csv, "w", newline="") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=["catalog_number", "faction", "model_name", "price", "page"],
        )
        writer.writeheader()
        writer.writerows(results)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Extract Warhammer catalog data from a scanned PDF"
    )
    parser.add_argument("pdf", type=Path, help="Path to input PDF file")
    parser.add_argument("output", type=Path, help="Output CSV path")
    parser.add_argument("--dpi", type=int, default=300, help="DPI for PDF to image conversion")
    parser.add_argument("--debug", action="store_true", help="Output debug images with OCR bounding boxes")
    args = parser.parse_args()

    extract_catalog(args.pdf, args.output, dpi=args.dpi, debug=args.debug)
