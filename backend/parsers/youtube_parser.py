"""YouTube transcript scraper using youtube-transcript-api.

Extracts text transcripts and timestamps from video IDs for RAG citation matching.

Compatible with youtube-transcript-api >= 1.0.0 (instance-based API).
"""

import re
from youtube_transcript_api import (
    YouTubeTranscriptApi,
    TranscriptsDisabled,
    NoTranscriptFound,
    VideoUnavailable,
    InvalidVideoId,
)


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

    Raises:
        ValueError: If the URL format is invalid or no transcript content found.
        RuntimeError: If the video is unavailable or transcripts are disabled.
    """
    video_id = extract_video_id(url)
    if not video_id:
        raise ValueError("Invalid YouTube URL format")

    try:
        # youtube-transcript-api v1.x uses instance-based API
        ytt_api = YouTubeTranscriptApi()
        transcript = ytt_api.fetch(video_id)
    except TranscriptsDisabled:
        raise RuntimeError(
            f"Transcripts are disabled for YouTube video {video_id}. "
            "The video owner has not enabled captions."
        )
    except NoTranscriptFound:
        raise RuntimeError(
            f"No transcript found for YouTube video {video_id}. "
            "This video does not have any available captions."
        )
    except VideoUnavailable:
        raise RuntimeError(
            f"YouTube video {video_id} is unavailable. "
            "It may have been removed or set to private."
        )
    except InvalidVideoId:
        raise ValueError(
            f"Invalid YouTube video ID: {video_id}"
        )
    except Exception as e:
        raise RuntimeError(
            f"Could not retrieve transcript for YouTube video {video_id}: {e}"
        )

    pages = []
    current_content = []
    start_time = 0.0
    current_char_len = 0

    # FetchedTranscript is iterable over FetchedTranscriptSnippet dataclasses
    # Each snippet has .text, .start, .duration attributes
    for snippet in transcript:
        if not current_content:
            start_time = snippet.start

        current_content.append(snippet.text)
        current_char_len += len(snippet.text)

        # Group transcript sentences into ~1000 character context windows
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

    if not pages:
        raise ValueError(
            f"Transcript for YouTube video {video_id} was empty — no content extracted."
        )

    return pages
