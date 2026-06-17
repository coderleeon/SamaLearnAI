"""Vector retriever using Supabase pgvector.

Performs similarity search against stored chunk embeddings using the
match_chunks() RPC function defined in the database migration.
"""

from backend.services.supabase import get_supabase_client
from backend.rag.embedder import embed_query
from backend.config import get_settings


def retrieve_chunks(
    query: str,
    session_id: str,
    top_k: int | None = None,
    threshold: float | None = None,
) -> list[dict]:
    """Retrieve the most relevant chunks for a query from a session's sources.

    Embeds the query, then calls the match_chunks() Postgres function to find
    similar chunks using cosine distance.

    Args:
        query: User's question.
        session_id: Session UUID to scope the search.
        top_k: Max number of chunks to return (default from settings).
        threshold: Minimum similarity score (default from settings).

    Returns:
        List of dicts with: id, source_id, content, metadata, similarity.
    """
    settings = get_settings()
    k = top_k or settings.RETRIEVAL_TOP_K
    thresh = threshold or settings.RETRIEVAL_THRESHOLD

    # Embed the query
    query_embedding = embed_query(query)

    # Call the match_chunks RPC function
    supabase = get_supabase_client()
    result = supabase.rpc(
        "match_chunks",
        {
            "query_embedding": query_embedding,
            "filter_session_id": session_id,
            "match_count": k,
            "match_threshold": thresh,
        },
    ).execute()

    return result.data or []


def store_chunks(
    source_id: str,
    chunks: list[dict],
    embeddings: list[list[float]],
) -> int:
    """Store chunks with their embeddings in Supabase.

    Args:
        source_id: UUID of the source these chunks belong to.
        chunks: List of dicts with 'content' and 'metadata' keys.
        embeddings: Corresponding embedding vectors.

    Returns:
        Number of chunks stored.
    """
    supabase = get_supabase_client()

    rows = []
    for chunk, embedding in zip(chunks, embeddings):
        rows.append({
            "source_id": source_id,
            "content": chunk["content"],
            "metadata": chunk["metadata"],
            "embedding": embedding,
        })

    # Insert in batches of 50 to avoid payload size limits
    batch_size = 50
    total = 0
    for i in range(0, len(rows), batch_size):
        batch = rows[i : i + batch_size]
        supabase.table("chunks").insert(batch).execute()
        total += len(batch)

    return total
