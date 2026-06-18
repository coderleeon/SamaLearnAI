"""YouTube transcript scraper using youtube-transcript-api.

Extracts text transcripts and timestamps from video IDs for RAG citation matching.
"""

import re
from youtube_transcript_api import YouTubeTranscriptApi


def extract_video_id(url: str) -> str | None:
    """Extract YouTube 11-character video ID from varied URL formats."""
    match = re.search(r"(?:v=|\/embed\/|youtu\.be\/|\/v\/)([^#\&\?]{11})", url)
    if match:
        return match.group(1)
    return None


def parse_youtube(url: str) -> list[dict]:
    """Retrieve text transcript blocks mapped to time timestamps.

    Args:
        url: YouTube watch/share link.

    Returns:
        List of dicts with keys: content, metadata.
        metadata includes: source_type, filename, url, timestamp, video_id.
    """
    video_id = extract_video_id(url)
    if not video_id:
        raise ValueError("Invalid YouTube URL format")

    try:
        transcript = YouTubeTranscriptApi.get_transcript(video_id)
    except Exception as e:
        raise Exception(f"Could not retrieve transcript for YouTube video {video_id}: {str(e)}")

    pages = []
    current_content = []
    start_time = 0.0
    current_char_len = 0

    for entry in transcript:
        if not current_content:
            start_time = entry["start"]

        current_content.append(entry["text"])
        current_char_len += len(entry["text"])

        # Group transcript sentences into 1000 character context windows
        if current_char_len > 1000:
            minutes = int(start_time // 60)
            seconds = int(start_time % 60)
            timestamp_str = f"{minutes:02d}:{seconds:02d}"

            pages.append({
                "content": " ".join(current_content),
                "metadata": {
                    "source_type": "youtube",
                    "filename": f"YouTube Video {video_id}",
                    "url": url,
                    "timestamp": timestamp_str,
                    "video_id": video_id,
                },
            })
            current_content = []
            current_char_len = 0

    if current_content:
        minutes = int(start_time // 60)
        seconds = int(start_time % 60)
        timestamp_str = f"{minutes:02d}:{seconds:02d}"
        pages.append({
            "content": " ".join(current_content),
            "metadata": {
                "source_type": "youtube",
                "filename": f"YouTube Video {video_id}",
                "url": url,
                "timestamp": timestamp_str,
                "video_id": video_id,
            },
        })

    return pages
