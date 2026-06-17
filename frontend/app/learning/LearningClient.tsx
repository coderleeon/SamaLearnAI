"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpen, Plus, PanelLeftClose, PanelLeft } from "lucide-react";
import { createSession } from "@/lib/api";
import { useChat } from "@/hooks/useChat";
import { useSources } from "@/hooks/useSources";
import ChatPanel from "@/components/chat/ChatPanel";
import SourcePanel from "@/components/sources/SourcePanel";

export default function LearningClient() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const {
    messages,
    isLoading: chatLoading,
    error: chatError,
    sendMessage,
    loadHistory,
    clearError: clearChatError,
  } = useChat();

  const {
    sources,
    isUploading,
    uploadError,
    handleUpload,
    loadSources,
    clearUploadError,
  } = useSources();

  // Initialize session on mount
  useEffect(() => {
    initSession();
  }, []);

  async function initSession() {
    setIsCreatingSession(true);
    try {
      const session = await createSession("learning", "Learning Session");
      setSessionId(session.id);
    } catch (err) {
      console.error("Failed to create session:", err);
    } finally {
      setIsCreatingSession(false);
    }
  }

  const handleNewSession = useCallback(async () => {
    setIsCreatingSession(true);
    try {
      const session = await createSession("learning", "Learning Session");
      setSessionId(session.id);
      // Clear local state by reloading
      window.location.reload();
    } catch (err) {
      console.error("Failed to create session:", err);
    } finally {
      setIsCreatingSession(false);
    }
  }, []);

  const handleSend = useCallback(
    (message: string) => {
      if (sessionId) {
        sendMessage(sessionId, message);
      }
    },
    [sessionId, sendMessage]
  );

  const handleFileUpload = useCallback(
    (file: File) => {
      if (sessionId) {
        handleUpload(sessionId, file);
      }
    },
    [sessionId, handleUpload]
  );

  const readySources = sources.filter((s) => s.status === "ready");
  const hasReadySources = readySources.length > 0;

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card/50 backdrop-blur-sm z-10">
        <div className="flex items-center gap-3">
          {/* Sidebar toggle */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            title={sidebarOpen ? "Hide sources" : "Show sources"}
            id="sidebar-toggle"
          >
            {sidebarOpen ? (
              <PanelLeftClose className="w-5 h-5" />
            ) : (
              <PanelLeft className="w-5 h-5" />
            )}
          </button>

          <Link
            href="/"
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
            id="back-home"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm hidden sm:inline">Home</span>
          </Link>

          <div className="h-4 w-px bg-border" />

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-sm font-semibold text-foreground">
              Learning Assistant
            </h1>
          </div>
        </div>

        <button
          onClick={handleNewSession}
          disabled={isCreatingSession}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          id="new-session-btn"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New Session</span>
        </button>
      </header>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Source sidebar */}
        {sidebarOpen && (
          <aside
            className="w-72 border-r border-border bg-card/30 flex-shrink-0 animate-fade-in"
            id="source-sidebar"
          >
            <SourcePanel
              sources={sources}
              isUploading={isUploading}
              uploadError={uploadError}
              onUpload={handleFileUpload}
              onClearError={clearUploadError}
              disabled={!sessionId}
            />
          </aside>
        )}

        {/* Chat area */}
        <main className="flex-1 min-w-0" id="chat-area">
          {isCreatingSession ? (
            <div className="flex-1 flex items-center justify-center h-full">
              <div className="flex flex-col items-center gap-3 animate-fade-in">
                <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                <p className="text-sm text-muted-foreground">
                  Creating session...
                </p>
              </div>
            </div>
          ) : (
            <ChatPanel
              messages={messages}
              isLoading={chatLoading}
              error={chatError}
              onClearError={clearChatError}
              onSend={handleSend}
              disabled={!sessionId || !hasReadySources}
            />
          )}
        </main>
      </div>
    </div>
  );
}
