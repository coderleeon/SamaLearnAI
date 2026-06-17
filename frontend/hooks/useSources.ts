"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { uploadSource, addUrlSource } from "@/lib/api";

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
  handleAddUrl: (sessionId: string, url: string, type: "youtube" | "website") => Promise<void>;
  loadSources: (sessionId: string) => Promise<void>;
  clearUploadError: () => void;
}

export function useSources(): UseSourcesReturn {
  const [sources, setSources] = useState<Source[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const activeSessionIdRef = useRef<string | null>(null);

  const clearUploadError = useCallback(() => setUploadError(null), []);

  const loadSources = useCallback(async (sessionId: string) => {
    activeSessionIdRef.current = sessionId;
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
      activeSessionIdRef.current = sessionId;
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
        const result = (await uploadSource(sessionId, file)) as any;

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

  const handleAddUrl = useCallback(
    async (sessionId: string, url: string, type: "youtube" | "website") => {
      activeSessionIdRef.current = sessionId;
      setIsUploading(true);
      setUploadError(null);

      // Extract display name from url
      let displayName = url;
      try {
        const parsed = new URL(url);
        displayName = parsed.hostname + (parsed.pathname !== "/" ? parsed.pathname : "");
      } catch {
        // ignore
      }

      const tempId = `temp-url-${Date.now()}`;
      const optimistic: Source = {
        id: tempId,
        session_id: sessionId,
        source_type: type,
        name: displayName,
        status: "processing",
      };

      setSources((prev) => [...prev, optimistic]);

      try {
        const result = (await addUrlSource(sessionId, url, type)) as any;
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
          err instanceof Error ? err.message : "Failed to add URL source";
        setUploadError(errorMessage);
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

  // Auto polling effect: poll if any source has status "processing"
  useEffect(() => {
    const hasProcessing = sources.some((s) => s.status === "processing");
    if (!hasProcessing) return;

    const interval = setInterval(() => {
      const activeId = activeSessionIdRef.current;
      if (activeId) {
        loadSources(activeId);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [sources, loadSources]);

  return {
    sources,
    isUploading,
    uploadError,
    handleUpload,
    handleAddUrl,
    loadSources,
    clearUploadError,
  };
}
