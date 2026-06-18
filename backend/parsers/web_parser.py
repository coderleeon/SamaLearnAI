"""Website scraper using httpx and BeautifulSoup.

Fetches html pages, strips scripts/styles, cleans tags, and divides text into section chunks.
"""

import httpx
from bs4 import BeautifulSoup


def parse_website(url: str) -> list[dict]:
    """Scrape web pages and parse clean text sections.

    Args:
        url: The web page link.

    Returns:
        List of dicts with keys: content, metadata.
        metadata includes: source_type, filename (title), url, section_title.
    """
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        )
    }

    with httpx.Client(follow_redirects=True, timeout=15.0, headers=headers) as client:
        response = client.get(url)
        if response.status_code != 200:
            raise Exception(f"Failed to fetch website (status code {response.status_code})")

        soup = BeautifulSoup(response.text, "html.parser")

        # Decompose interactive/style elements
        for el in soup(["script", "style", "noscript", "iframe", "header", "footer", "nav", "aside"]):
            el.decompose()

        title = soup.title.string.strip() if (soup.title and soup.title.string) else url

        # Retrieve text-heavy blocks
        tags = soup.find_all(["p", "h1", "h2", "h3", "h4", "li"])
        paragraphs = [t.get_text().strip() for t in tags if len(t.get_text().strip()) > 20]

        pages = []
        current_text = []
        current_len = 0
        section_idx = 1

        for p in paragraphs:
            current_text.append(p)
            current_len += len(p)
            if current_len > 1500:
                pages.append({
                    "content": "\n".join(current_text),
                    "metadata": {
                        "source_type": "website",
                        "filename": title,
                        "url": url,
                        "section_title": f"Section {section_idx}",
                    },
                })
                current_text = []
                current_len = 0
                section_idx += 1

        if current_text:
            pages.append({
                "content": "\n".join(current_text),
                "metadata": {
                    "source_type": "website",
                    "filename": title,
                    "url": url,
                    "section_title": f"Section {section_idx}",
                },
            })

        return pages
