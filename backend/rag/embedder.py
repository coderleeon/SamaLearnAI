"""Gemini embedding client.

Generates embeddings using Google's gemini-embedding-001 model (3072 dimensions).
Supports batching for efficient processing of multiple chunks.
"""

import google.genai as genai
from backend.config import get_settings

_client: genai.Client | None = None


def _get_client() -> genai.Client:
    """Return a cached Gemini client."""
    global _client
    if _client is None:
        settings = get_settings()
        _client = genai.Client(api_key=settings.GOOGLE_API_KEY)
    return _client


def embed_texts(texts: list[str], batch_size: int = 50) -> list[list[float]]:
    """Generate embeddings for a list of texts using Gemini.

    Processes texts in batches to stay within API limits.

    Args:
        texts: List of text strings to embed.
        batch_size: Number of texts per API call (max ~100 for Gemini).

    Returns:
        List of embedding vectors (each a list of floats, 3072 dimensions).
    """
    settings = get_settings()
    client = _get_client()
    all_embeddings: list[list[float]] = []

    for i in range(0, len(texts), batch_size):
        batch = texts[i : i + batch_size]
        result = client.models.embed_content(
            model=settings.GEMINI_EMBEDDING_MODEL,
            contents=batch,
            config=genai.types.EmbedContentConfig(
                output_dimensionality=settings.EMBEDDING_DIMENSIONS
            ),
        )
        for embedding in result.embeddings:
            all_embeddings.append(embedding.values)

    return all_embeddings


def embed_query(text: str) -> list[float]:
    """Generate a single embedding for a search query.

    Args:
        text: The query string.

    Returns:
        Embedding vector (list of floats, 3072 dimensions).
    """
    result = embed_texts([text])
    return result[0]
