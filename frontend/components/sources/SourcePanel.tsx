"use client";

import React, { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import type { Source } from "@/hooks/useSources";
import {
  Upload,
  FileText,
  Presentation,
  CirclePlay,
  Globe,
  CheckCircle2,
  Loader2,
  AlertCircle,
  X,
  Link2,
} from "lucide-react";

function SourceIcon({ type }: { type: string }) {
  const cls = "w-4 h-4";
  switch (type) {
    case "pdf":
      return <FileText className={cls} />;
    case "pptx":
      return <Presentation className={cls} />;
    case "youtube":
      return <CirclePlay className={cls} />;
    case "website":
      return <Globe className={cls} />;
    default:
      return <FileText className={cls} />;
  }
}

function statusIcon(status: string) {
  switch (status) {
    case "ready":
      return <CheckCircle2 className="w-3.5 h-3.5 text-success" />;
    case "processing":
      return <Loader2 className="w-3.5 h-3.5 text-warning animate-spin" />;
    case "error":
      return <AlertCircle className="w-3.5 h-3.5 text-destructive" />;
    default:
      return null;
  }
}

function sourceTypeColor(type: string) {
  switch (type) {
    case "pdf":
      return "text-red-400";
    case "pptx":
      return "text-orange-400";
    case "youtube":
      return "text-red-400";
    case "website":
      return "text-blue-400";
    default:
      return "text-muted-foreground";
  }
}

function sourceTypeLabel(type: string) {
  switch (type) {
    case "pdf":
      return "PDF";
    case "pptx":
      return "PPTX";
    case "youtube":
      return "YouTube";
    case "website":
      return "Website";
    default:
      return type.toUpperCase();
  }
}

function SourceCard({ source }: { source: Source }) {
  const meta = source.metadata as Record<string, unknown> | undefined;
  const chunkCount = meta?.chunk_count as number | undefined;
  const pageCount = meta?.page_count as number | undefined;

  return (
    <div
      className="glass rounded-xl p-3 animate-fade-in group hover:bg-card-hover transition-colors"
      id={`source-card-${source.id}`}
    >
      <div className="flex items-start gap-2.5">
        <div className={`flex-shrink-0 mt-0.5 ${sourceTypeColor(source.source_type)}`}>
          <SourceIcon type={source.source_type} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium text-foreground truncate" title={source.name}>
              {source.name}
            </span>
            {statusIcon(source.status)}
          </div>

          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-[10px] px-1.5 py-0.2 rounded bg-muted font-medium ${sourceTypeColor(source.source_type)}`}>
              {sourceTypeLabel(source.source_type)}
            </span>
            {pageCount && (
              <span className="text-xs text-muted-foreground">
                {pageCount} pages
              </span>
            )}
            {chunkCount && (
              <span className="text-xs text-muted-foreground">
                {chunkCount} chunks
              </span>
            )}
          </div>

          {source.summary && (
            <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 italic">
              &ldquo;{source.summary}&rdquo;
            </p>
          )}

          {source.status === "processing" && (
            <p className="text-[11px] text-warning mt-1 animate-pulse-dot">
              Parsing &amp; chunking context...
            </p>
          )}

          {source.status === "error" && (
            <p className="text-[11px] text-destructive mt-1">
              Processing failed. Check format.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton card for loading feedback
// ---------------------------------------------------------------------------
function SkeletonCard() {
  return (
    <div className="glass rounded-xl p-3 animate-pulse space-y-2.5">
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 bg-border rounded" />
        <div className="h-3.5 bg-border rounded w-2/3" />
      </div>
      <div className="flex gap-2">
        <div className="h-3 bg-border rounded w-12" />
        <div className="h-3 bg-border rounded w-16" />
      </div>
    </div>
  );
}

interface SourcePanelProps {
  sources: Source[];
  isUploading: boolean;
  uploadError: string | null;
  onUpload: (file: File) => void;
  onAddUrl: (url: string, type: "youtube" | "website") => void;
  onClearError: () => void;
  disabled?: boolean;
}

export default function SourcePanel({
  sources,
  isUploading,
  uploadError,
  onUpload,
  onAddUrl,
  onClearError,
  disabled,
}: SourcePanelProps) {
  const [activeTab, setActiveTab] = useState<"file" | "url">("file");
  const [urlInput, setUrlInput] = useState("");
  const [urlType, setUrlType] = useState<"youtube" | "website">("youtube");

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (disabled) return;
      for (const file of acceptedFiles) {
        onUpload(file);
      }
    },
    [onUpload, disabled]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.presentationml.presentation":
        [".pptx"],
    },
    disabled: disabled || isUploading,
    multiple: true,
  });

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim() || disabled) return;
    onAddUrl(urlInput.trim(), urlType);
    setUrlInput("");
  };

  return (
    <div className="flex flex-col h-full bg-card/20">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">Sources</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Grounded contexts for RAG answering
        </p>
      </div>

      {/* Navigation tabs */}
      <div className="flex px-3 pt-2 gap-1">
        <button
          onClick={() => setActiveTab("file")}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1 ${
            activeTab === "file"
              ? "bg-primary/15 text-primary border border-primary/20"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/35"
          }`}
        >
          <Upload className="w-3.5 h-3.5" />
          Files
        </button>
        <button
          onClick={() => setActiveTab("url")}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1 ${
            activeTab === "url"
              ? "bg-primary/15 text-primary border border-primary/20"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/35"
          }`}
        >
          <Link2 className="w-3.5 h-3.5" />
          URLs
        </button>
      </div>

      {/* Tab contents */}
      <div className="px-3 pt-3">
        {activeTab === "file" ? (
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
              isDragActive
                ? "border-primary bg-primary/5"
                : disabled
                ? "border-border/50 opacity-50 cursor-not-allowed"
                : "border-border hover:border-primary/50 hover:bg-muted/30"
            }`}
            id="source-dropzone"
          >
            <input {...getInputProps()} />
            {isUploading ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
                <span className="text-xs text-muted-foreground">
                  Processing document...
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="w-6 h-6 text-muted-foreground" />
                <span className="text-xs text-muted-foreground font-medium">
                  {isDragActive
                    ? "Drop files here"
                    : "Drag PDF / PPTX or browse"}
                </span>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleUrlSubmit} className="glass rounded-xl p-3 space-y-2.5">
            <div className="flex gap-2">
              <select
                value={urlType}
                onChange={(e) => setUrlType(e.target.value as "youtube" | "website")}
                disabled={disabled || isUploading}
                className="bg-muted border border-border text-xs rounded-lg px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="youtube">YouTube</option>
                <option value="website">Website</option>
              </select>
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder={urlType === "youtube" ? "https://youtube.com/watch?v=..." : "https://example.com"}
                disabled={disabled || isUploading}
                required
                className="flex-1 min-w-0 bg-muted/65 border border-border text-xs rounded-lg px-3 py-1.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <button
              type="submit"
              disabled={disabled || isUploading || !urlInput.trim()}
              className="w-full h-8 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-semibold transition-colors disabled:opacity-50"
            >
              {isUploading ? "Adding Link..." : "Add Source"}
            </button>
          </form>
        )}
      </div>

      {/* Upload error banner */}
      {uploadError && (
        <div className="mx-3 mt-2 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/30 flex items-start gap-2 animate-fade-in">
          <AlertCircle className="w-3.5 h-3.5 text-destructive flex-shrink-0 mt-0.5" />
          <span className="text-xs text-destructive flex-1">
            {uploadError}
          </span>
          <button onClick={onClearError} className="text-destructive/60 hover:text-destructive">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Source lists */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {isUploading && sources.filter((s) => s.status === "processing").length === 0 && (
          <SkeletonCard />
        )}

        {sources.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">
              No sources added yet.
            </p>
          </div>
        ) : (
          sources.map((source) => (
            <SourceCard key={source.id} source={source} />
          ))
        )}
      </div>
    </div>
  );
}
