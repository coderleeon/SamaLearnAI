/**
 * API client helpers for communicating with the FastAPI backend.
 *
 * All requests go through Next.js rewrites (/api/v1/* → FastAPI),
 * so we use relative URLs. This avoids CORS and keeps the frontend
 * agnostic to the backend host.
 */

const API_BASE = "/api/v1";

// ---------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------

export async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`API Error ${res.status}: ${error}`);
  }

  return res.json();
}

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

export async function checkHealth(): Promise<{
  status: string;
  service: string;
  version: string;
}> {
  return apiFetch("/health");
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export async function createSession(taskType: "learning" | "course", title?: string) {
  return apiFetch<{ id: string }>("/sessions", {
    method: "POST",
    body: JSON.stringify({ task_type: taskType, title }),
  });
}

// ---------------------------------------------------------------------------
// Sources (Task 1) — file upload uses FormData, not JSON
// ---------------------------------------------------------------------------

export async function uploadSource(sessionId: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("session_id", sessionId);

  const res = await fetch(`${API_BASE}/sources/upload`, {
    method: "POST",
    body: formData,
    // Don't set Content-Type — browser sets it with boundary for multipart
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Upload Error ${res.status}: ${error}`);
  }

  return res.json();
}

export async function addUrlSource(
  sessionId: string,
  url: string,
  sourceType: "youtube" | "website"
) {
  return apiFetch("/sources/url", {
    method: "POST",
    body: JSON.stringify({
      session_id: sessionId,
      url,
      source_type: sourceType,
    }),
  });
}

// ---------------------------------------------------------------------------
// SSE Stream helper
// ---------------------------------------------------------------------------

/**
 * Opens an SSE connection to a streaming endpoint and yields parsed events.
 * Used by useSSEStream hook — not called directly.
 */
export async function* streamChat(
  endpoint: string,
  body: { session_id: string; message: string }
): AsyncGenerator<{ event: string; data: string }> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Stream Error ${res.status}: ${await res.text()}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    let currentEvent = "message";

    for (const line of lines) {
      if (line.startsWith("event: ")) {
        currentEvent = line.slice(7).trim();
      } else if (line.startsWith("data: ")) {
        const data = line.slice(6);
        yield { event: currentEvent, data };
        currentEvent = "message";
      }
      // Empty line = end of event (handled by the split)
    }
  }
}
