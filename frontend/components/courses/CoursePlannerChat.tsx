"use client";

import React, { useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage } from "@/hooks/useCoursePlanner";
import { User, Bot, AlertCircle, Sparkles } from "lucide-react";

interface CoursePlannerChatProps {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  onClearError: () => void;
  onSend: (message: string) => void;
  disabled?: boolean;
}

const SUGGESTIONS = [
  "Build a 4-week Python course for absolute beginners",
  "Design a self-paced Machine Learning curriculum for undergraduates",
  "Plan a 10-hour crash course on Web Development for designers",
];

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div
      className={`flex gap-3 animate-fade-in ${
        isUser ? "flex-row-reverse" : ""
      }`}
    >
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

      <div className={`flex-1 max-w-[80%] ${isUser ? "text-right" : ""}`}>
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
                <div className="flex items-center gap-1 px-3 py-2">
                  <span className="typing-dot w-1.5 h-1.5 rounded-full bg-primary" />
                  <span className="typing-dot w-1.5 h-1.5 rounded-full bg-primary" />
                  <span className="typing-dot w-1.5 h-1.5 rounded-full bg-primary" />
                </div>
              ) : null}
              {message.isStreaming && message.content && (
                <span className="streaming-cursor" />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CoursePlannerChat({
  messages,
  isLoading,
  error,
  onClearError,
  onSend,
  disabled,
}: CoursePlannerChatProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
    <div className="flex flex-col h-full bg-card/20">
      {/* Scrollable messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 h-full animate-fade-in">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-400/20 flex items-center justify-center mb-4 glow">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">
              Welcome to the Course Planner
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-6">
              I can help you design professional, structured course plans.
              Provide details like subject, target audience, duration, and goals to get started.
            </p>

            {/* Suggestion Chips */}
            <div className="flex flex-col gap-2 max-w-md w-full">
              {SUGGESTIONS.map((sug, i) => (
                <button
                  key={i}
                  onClick={() => onSend(sug)}
                  className="text-left text-xs px-4 py-2.5 rounded-xl border border-border bg-card/40 hover:bg-muted/40 transition-colors text-muted-foreground hover:text-foreground"
                >
                  {sug}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-4 mb-2 px-4 py-2 rounded-lg bg-destructive/10 border border-destructive/30 flex items-center gap-2 animate-fade-in">
          <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
          <span className="text-sm text-destructive flex-1">{error}</span>
          <button
            onClick={onClearError}
            className="text-destructive/60 hover:text-destructive text-sm"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="border-t border-border px-4 py-3 bg-card/45">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            rows={1}
            placeholder={
              disabled
                ? "Chat session is currently starting..."
                : "Type details or refinement commands (e.g. 'add projects')..."
            }
            disabled={disabled || isLoading}
            onKeyDown={handleKeyDown}
            onChange={handleInput}
            className="flex-1 resize-none bg-muted/50 border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            id="planner-chat-input"
          />
          <button
            type="submit"
            disabled={disabled || isLoading}
            className="flex-shrink-0 h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary-hover disabled:opacity-50 transition-colors"
            id="planner-chat-send-btn"
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
