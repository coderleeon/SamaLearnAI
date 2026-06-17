"""Text chunker with metadata preservation.

Splits parsed content into smaller overlapping chunks suitable for embedding,
while carrying forward source metadata (page numbers, slide numbers, timestamps)
for citation support.
"""

from langchain_text_splitters import RecursiveCharacterTextSplitter
from backend.config import get_settings


def chunk_pages(
    pages: list[dict],
    chunk_size: int | None = None,
    chunk_overlap: int | None = None,
) -> list[dict]:
    """Split a list of parsed pages/sections into smaller chunks.

    Each page dict must have 'content' (str) and 'metadata' (dict).
    The metadata is copied onto every chunk produced from that page,
    with an additional 'chunk_index' field.

    Args:
        pages: Output from any parser (pdf_parser, pptx_parser, etc.).
        chunk_size: Maximum characters per chunk (default from settings).
        chunk_overlap: Overlap between consecutive chunks (default from settings).

    Returns:
        List of dicts with keys: content, metadata (including chunk_index).
    """
    settings = get_settings()
    size = chunk_size or settings.CHUNK_SIZE
    overlap = chunk_overlap or settings.CHUNK_OVERLAP

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=size,
        chunk_overlap=overlap,
        length_function=len,
        separators=["\n\n", "\n", ". ", " ", ""],
    )

    all_chunks = []
    global_index = 0

    for page in pages:
        text = page["content"]
        meta = page["metadata"]

        # Skip empty or very short content
        if len(text.strip()) < 20:
            continue

        # Split this page's text into chunks
        text_chunks = splitter.split_text(text)

        for chunk_text in text_chunks:
            all_chunks.append({
                "content": chunk_text,
                "metadata": {
                    **meta,
                    "chunk_index": global_index,
                },
            })
            global_index += 1

    return all_chunks
