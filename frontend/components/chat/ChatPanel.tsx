"use client";

import React, { useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage, Citation } from "@/hooks/useChat";
import {
  User,
  Bot,
  FileText,
  Presentation,
  CirclePlay,
  Globe,
  AlertCircle,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Source badge icon resolver
// ---------------------------------------------------------------------------

function SourceIcon({
  type,
  className,
}: {
  type: string;
  className?: string;
}) {
  const cls = className || "w-3 h-3";
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

function sourceColor(type: string) {
  switch (type) {
    case "pdf":
      return "bg-red-500/20 text-red-400 border-red-500/30";
    case "pptx":
      return "bg-orange-500/20 text-orange-400 border-orange-500/30";
    case "youtube":
      return "bg-red-600/20 text-red-400 border-red-600/30";
    case "website":
      return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

// ---------------------------------------------------------------------------
// Citation badges
// ---------------------------------------------------------------------------

function CitationBadges({ citations }: { citations: Citation[] }) {
  if (!citations.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-border/50">
      <span className="text-xs text-muted-foreground mr-1 self-center">
        Sources:
      </span>
      {citations.map((c, i) => (
        <span
          key={`${c.source_id}-${i}`}
          className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${sourceColor(
            c.source_type
          )}`}
        >
          <SourceIcon type={c.source_type} className="w-3 h-3" />
          {c.label}
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Typing indicator
// ---------------------------------------------------------------------------

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-3 py-2">
      <span className="typing-dot w-1.5 h-1.5 rounded-full bg-primary" />
      <span className="typing-dot w-1.5 h-1.5 rounded-full bg-primary" />
      <span className="typing-dot w-1.5 h-1.5 rounded-full bg-primary" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single message bubble
// ---------------------------------------------------------------------------

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div
      className={`flex gap-3 animate-fade-in ${
        isUser ? "flex-row-reverse" : ""
      }`}
    >
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
          isUser
            ? "bg-gradient-to-br from-indigo-500 to-cyan-400"
            : "bg-gradient-to-br from-violet-500 to-fuchsia-400"
        }`}
      >
        {isUser ? (
          <User className="w-4 h-4 text-white" />
        ) : (
          <Bot className="w-4 h-4 text-white" />
        )}
      </div>

      {/* Content */}
      <div
        className={`flex-1 max-w-[80%] ${isUser ? "text-right" : ""}`}
      >
        <div
          className={`inline-block text-left rounded-2xl px-4 py-3 ${
            isUser
              ? "bg-primary/15 border border-primary/20 text-foreground"
              : "glass text-foreground"
          }`}
        >
          {isUser ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {message.content}
            </p>
          ) : (
            <div className="text-sm leading-relaxed prose prose-invert prose-sm max-w-none">
              {message.content ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {message.content}
                </ReactMarkdown>
              ) : message.isStreaming ? (
                <TypingIndicator />
              ) : null}
              {message.isStreaming && message.content && (
                <span className="streaming-cursor" />
              )}
            </div>
          )}

          {/* Citations */}
          {!isUser && message.citations && message.citations.length > 0 && (
            <CitationBadges citations={message.citations} />
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 animate-fade-in">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-cyan-400/20 flex items-center justify-center mb-4 glow">
        <Bot className="w-8 h-8 text-primary" />
      </div>
      <h3 className="text-lg font-semibold mb-2">
        Welcome to the Learning Assistant
      </h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        Upload PDF documents using the panel on the left, then ask me anything
        about their content. I&apos;ll provide grounded answers with source
        citations.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error banner
// ---------------------------------------------------------------------------

function ErrorBanner({
  error,
  onDismiss,
}: {
  error: string;
  onDismiss: () => void;
}) {
  return (
    <div className="mx-4 mb-2 px-4 py-2 rounded-lg bg-destructive/10 border border-destructive/30 flex items-center gap-2 animate-fade-in">
      <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
      <span className="text-sm text-destructive flex-1">{error}</span>
      <button
        onClick={onDismiss}
        className="text-destructive/60 hover:text-destructive text-sm"
      >
        Dismiss
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChatPanel (main export)
// ---------------------------------------------------------------------------

interface ChatPanelProps {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  onClearError: () => void;
  onSend: (message: string) => void;
  disabled?: boolean;
}

export default function ChatPanel({
  messages,
  isLoading,
  error,
  onClearError,
  onSend,
  disabled,
}: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll on new messages or streaming content
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const input = inputRef.current;
    if (!input) return;
    const value = input.value.trim();
    if (!value) return;
    onSend(value);
    input.value = "";
    input.style.height = "auto";
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 150) + "px";
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
      >
        {messages.length === 0 ? (
          <EmptyState />
        ) : (
          messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))
        )}
      </div>

      {/* Error */}
      {error && <ErrorBanner error={error} onDismiss={onClearError} />}

      {/* Input area */}
      <form
        onSubmit={handleSubmit}
        className="border-t border-border px-4 py-3"
      >
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            rows={1}
            placeholder={
              disabled
                ? "Upload a source to start chatting..."
                : "Ask about your sources..."
            }
            disabled={disabled || isLoading}
            onKeyDown={handleKeyDown}
            onChange={handleInput}
            className="flex-1 resize-none bg-muted/50 border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
            id="chat-input"
          />
          <button
            type="submit"
            disabled={disabled || isLoading}
            className="flex-shrink-0 h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            id="chat-send-btn"
          >
            {isLoading ? (
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Thinking
              </span>
            ) : (
              "Send"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
