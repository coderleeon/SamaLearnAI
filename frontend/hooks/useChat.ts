"use client";

import { useState, useCallback, useRef } from "react";
import { streamChat } from "@/lib/api";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  isStreaming?: boolean;
  created_at?: string;
}

export interface Citation {
  source_id: string;
  source_name: string;
  source_type: string;
  label: string;
  chunk_id?: string;
}

interface UseChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (sessionId: string, message: string) => Promise<void>;
  loadHistory: (sessionId: string) => Promise<void>;
  clearError: () => void;
}

let messageIdCounter = 0;
function nextId() {
  return `msg-${Date.now()}-${++messageIdCounter}`;
}

export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const loadHistory = useCallback(async (sessionId: string) => {
    try {
      const res = await fetch(`/api/v1/sessions/${sessionId}/messages`);
      if (!res.ok) return;
      const data = await res.json();
      const loaded: ChatMessage[] = (data || []).map(
        (m: { id: string; role: string; content: string; citations?: Citation[]; created_at: string }) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.content,
          citations: m.citations || undefined,
          created_at: m.created_at,
        })
      );
      setMessages(loaded);
    } catch {
      // Silently fail — history is optional
    }
  }, []);

  const sendMessage = useCallback(
    async (sessionId: string, message: string) => {
      if (!message.trim() || isLoading) return;

      setError(null);

      // Add user message
      const userMsg: ChatMessage = {
        id: nextId(),
        role: "user",
        content: message.trim(),
      };

      // Add placeholder assistant message
      const assistantId = nextId();
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        isStreaming: true,
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsLoading(true);

      try {
        const stream = streamChat("/chat", {
          session_id: sessionId,
          message: message.trim(),
        });

        for await (const { event, data } of stream) {
          if (event === "token") {
            try {
              const parsed = JSON.parse(data);
              const token = parsed.text || "";
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: m.content + token }
                    : m
                )
              );
            } catch {
              // Skip malformed tokens
            }
          } else if (event === "citations") {
            try {
              const citations: Citation[] = JSON.parse(data);
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, citations } : m
                )
              );
            } catch {
              // Skip malformed citations
            }
          } else if (event === "error") {
            try {
              const parsed = JSON.parse(data);
              setError(parsed.error || "An error occurred");
            } catch {
              setError("An error occurred while streaming");
            }
          } else if (event === "done") {
            // Stream complete
          }
        }

        // Mark streaming as complete
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, isStreaming: false } : m
          )
        );
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to send message";
        setError(errorMessage);

        // Remove the empty assistant message on error
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading]
  );

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    loadHistory,
    clearError,
  };
}
