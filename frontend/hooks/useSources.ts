"use client";

import { useState, useCallback } from "react";
import { uploadSource } from "@/lib/api";

export interface Source {
  id: string;
  session_id: string;
  source_type: "pdf" | "pptx" | "youtube" | "website";
  name: string;
  status: "processing" | "ready" | "error";
  summary?: string;
  metadata?: Record<string, unknown>;
}

interface UseSourcesReturn {
  sources: Source[];
  isUploading: boolean;
  uploadError: string | null;
  handleUpload: (sessionId: string, file: File) => Promise<void>;
  loadSources: (sessionId: string) => Promise<void>;
  clearUploadError: () => void;
}

export function useSources(): UseSourcesReturn {
  const [sources, setSources] = useState<Source[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const clearUploadError = useCallback(() => setUploadError(null), []);

  const loadSources = useCallback(async (sessionId: string) => {
    try {
      const res = await fetch(`/api/v1/sessions/${sessionId}/sources`);
      if (!res.ok) return;
      const data = await res.json();
      setSources(data || []);
    } catch {
      // Silently fail
    }
  }, []);

  const handleUpload = useCallback(
    async (sessionId: string, file: File) => {
      setIsUploading(true);
      setUploadError(null);

      // Add optimistic "processing" source
      const tempId = `temp-${Date.now()}`;
      const optimistic: Source = {
        id: tempId,
        session_id: sessionId,
        source_type: file.name.endsWith(".pdf") ? "pdf" : "pptx",
        name: file.name,
        status: "processing",
      };

      setSources((prev) => [...prev, optimistic]);

      try {
        const result = await uploadSource(sessionId, file);

        // Replace optimistic with real source
        setSources((prev) =>
          prev.map((s) =>
            s.id === tempId
              ? {
                  ...result,
                  status: result.status || "ready",
                }
              : s
          )
        );
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Upload failed";
        setUploadError(errorMessage);

        // Mark optimistic source as error
        setSources((prev) =>
          prev.map((s) =>
            s.id === tempId ? { ...s, status: "error" } : s
          )
        );
      } finally {
        setIsUploading(false);
      }
    },
    []
  );

  return {
    sources,
    isUploading,
    uploadError,
    handleUpload,
    loadSources,
    clearUploadError,
  };
}
