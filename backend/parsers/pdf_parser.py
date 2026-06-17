"""PDF parser using PyMuPDF.

Extracts text from each page of a PDF file, preserving page number metadata
for citation support.
"""

import fitz  # PyMuPDF


def parse_pdf(file_bytes: bytes, filename: str) -> list[dict]:
    """Extract text from a PDF file, returning one entry per page.

    Args:
        file_bytes: Raw bytes of the PDF file.
        filename: Original filename for metadata.

    Returns:
        List of dicts with keys: content, metadata.
        metadata includes: source_type, filename, page_number, total_pages.
    """
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    total_pages = len(doc)
    pages = []

    for page_num in range(total_pages):
        page = doc[page_num]
        text = page.get_text("text").strip()

        if not text:
            continue

        pages.append({
            "content": text,
            "metadata": {
                "source_type": "pdf",
                "filename": filename,
                "page_number": page_num + 1,  # 1-indexed for user display
                "total_pages": total_pages,
            },
        })

    doc.close()
    return pages
