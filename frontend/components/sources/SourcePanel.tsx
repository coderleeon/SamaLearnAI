"use client";

import React, { useCallback } from "react";
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
} from "lucide-react";

// ---------------------------------------------------------------------------
// Source badge component
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Source card
// ---------------------------------------------------------------------------

function SourceCard({ source }: { source: Source }) {
  const meta = source.metadata as Record<string, unknown> | undefined;
  const chunkCount = meta?.chunk_count as number | undefined;
  const pageCount = meta?.page_count as number | undefined;

  return (
    <div
      className="glass rounded-xl p-3 animate-fade-in group"
      id={`source-card-${source.id}`}
    >
      <div className="flex items-start gap-2.5">
        {/* Icon */}
        <div className={`flex-shrink-0 mt-0.5 ${sourceTypeColor(source.source_type)}`}>
          <SourceIcon type={source.source_type} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium text-foreground truncate">
              {source.name}
            </span>
            {statusIcon(source.status)}
          </div>

          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-xs ${sourceTypeColor(source.source_type)}`}>
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
            <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
              {source.summary}
            </p>
          )}

          {source.status === "processing" && (
            <p className="text-xs text-warning mt-1 animate-pulse-dot">
              Processing...
            </p>
          )}

          {source.status === "error" && (
            <p className="text-xs text-destructive mt-1">
              Processing failed
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Source panel (main export)
// ---------------------------------------------------------------------------

interface SourcePanelProps {
  sources: Source[];
  isUploading: boolean;
  uploadError: string | null;
  onUpload: (file: File) => void;
  onClearError: () => void;
  disabled?: boolean;
}

export default function SourcePanel({
  sources,
  isUploading,
  uploadError,
  onUpload,
  onClearError,
  disabled,
}: SourcePanelProps) {
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

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">Sources</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Upload documents to chat about
        </p>
      </div>

      {/* Upload zone */}
      <div className="px-3 pt-3">
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
                Uploading &amp; processing...
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="w-6 h-6 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {isDragActive
                  ? "Drop files here"
                  : "Drop PDF / PPTX or click to browse"}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Upload error */}
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

      {/* Source list */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {sources.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">
              No sources yet
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
