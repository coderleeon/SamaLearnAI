"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpen, Plus, PanelLeftClose, PanelLeft, WifiOff, RefreshCw } from "lucide-react";
import { createSession } from "@/lib/api";
import { useChat } from "@/hooks/useChat";
import { useSources } from "@/hooks/useSources";
import ChatPanel from "@/components/chat/ChatPanel";
import SourcePanel from "@/components/sources/SourcePanel";

export default function LearningClient() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [sessionError, setSessionError] = useState<boolean>(false);
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
    handleAddUrl,
    loadSources,
    clearUploadError,
  } = useSources();

  // Initialize session on mount
  useEffect(() => {
    initSession();
  }, []);

  // Set default sidebar state depending on viewport width on initial render
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (window.innerWidth < 768) {
        setSidebarOpen(false);
      }
    }
  }, []);

  async function initSession() {
    setIsCreatingSession(true);
    setSessionError(false);
    try {
      const session = await createSession("learning", "Learning Session");
      setSessionId(session.id);
      await loadSources(session.id);
    } catch (err) {
      console.error("Failed to create session:", err);
      setSessionError(true);
    } finally {
      setIsCreatingSession(false);
    }
  }

  const handleNewSession = useCallback(async () => {
    setIsCreatingSession(true);
    setSessionError(false);
    try {
      const session = await createSession("learning", "Learning Session");
      setSessionId(session.id);
      // Clear state by refreshing page
      window.location.reload();
    } catch (err) {
      console.error("Failed to create session:", err);
      setSessionError(true);
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

  const handleAddLink = useCallback(
    (url: string, type: "youtube" | "website") => {
      if (sessionId) {
        handleAddUrl(sessionId, url, type);
      }
    },
    [sessionId, handleAddUrl]
  );

  const readySources = sources.filter((s) => s.status === "ready");
  const hasReadySources = readySources.length > 0;

  // Offline / connection failure full screen overlay
  if (sessionError) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-screen bg-background px-6">
        <div className="glass max-w-md w-full rounded-2xl p-6 text-center animate-fade-in glow space-y-4 border-destructive/20">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center mx-auto">
            <WifiOff className="w-8 h-8 text-destructive animate-pulse" />
          </div>
          <h2 className="text-lg font-bold text-foreground">Connection Error</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Could not connect to the database. Make sure the backend server and Supabase database connection details are correctly configured.
          </p>
          <button
            onClick={initSession}
            className="w-full py-2.5 px-4 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4 animate-spin-hover" />
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card/50 backdrop-blur-sm z-20">
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
      <div className="flex flex-1 overflow-hidden relative">
        {/* Source sidebar */}
        {sidebarOpen && (
          <aside
            className="w-72 border-r border-border bg-card/30 flex-shrink-0 animate-fade-in absolute md:relative h-full z-10 md:z-0 backdrop-blur-md md:backdrop-blur-none"
            id="source-sidebar"
          >
            <SourcePanel
              sources={sources}
              isUploading={isUploading}
              uploadError={uploadError}
              onUpload={handleFileUpload}
              onAddUrl={handleAddLink}
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
                  Initializing sandbox...
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
