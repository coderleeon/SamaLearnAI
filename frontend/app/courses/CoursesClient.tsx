"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, GraduationCap, Plus, WifiOff, RefreshCw } from "lucide-react";
import { createSession } from "@/lib/api";
import { useCoursePlanner } from "@/hooks/useCoursePlanner";
import CoursePlannerChat from "@/components/courses/CoursePlannerChat";
import CoursePlanPreview from "@/components/courses/CoursePlanPreview";

export default function CoursesClient() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [sessionError, setSessionError] = useState(false);

  const {
    messages,
    requirements,
    activePlan,
    planVersion,
    versions,
    isLoading: plannerLoading,
    error: plannerError,
    sendPlannerMessage,
    loadSessionPlan,
    switchVersion,
    clearError,
  } = useCoursePlanner();

  // Initialize session on mount
  useEffect(() => {
    initSession();
  }, []);

  async function initSession() {
    setIsCreatingSession(true);
    setSessionError(false);
    try {
      const session = await createSession("course", "Course Planning Session");
      setSessionId(session.id);
      await loadSessionPlan(session.id);
    } catch (err) {
      console.error("Failed to create planning session:", err);
      setSessionError(true);
    } finally {
      setIsCreatingSession(false);
    }
  }

  const handleNewSession = useCallback(async () => {
    setIsCreatingSession(true);
    setSessionError(false);
    try {
      const session = await createSession("course", "Course Planning Session");
      setSessionId(session.id);
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
        sendPlannerMessage(sessionId, message);
      }
    },
    [sessionId, sendPlannerMessage]
  );

  if (sessionError) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-screen bg-background px-6">
        <div className="glass max-w-md w-full rounded-2xl p-6 text-center animate-fade-in glow space-y-4 border-destructive/20">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center mx-auto">
            <WifiOff className="w-8 h-8 text-destructive animate-pulse" />
          </div>
          <h2 className="text-lg font-bold text-foreground">Database Connection Error</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Could not initialize course planner session. Make sure the backend service is running and configured correctly.
          </p>
          <button
            onClick={initSession}
            className="w-full py-2.5 px-4 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      {/* Top Header */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card/50 backdrop-blur-sm z-15">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
            id="back-home-courses"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm hidden sm:inline">Home</span>
          </Link>

          <div className="h-4 w-px bg-border" />

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-400 flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-sm font-semibold text-foreground">
              Course Planner
            </h1>
          </div>
        </div>

        <button
          onClick={handleNewSession}
          disabled={isCreatingSession}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          id="new-planner-session-btn"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New Plan</span>
        </button>
      </header>

      {/* Main split screens - responsive stacking on mobile/tablet */}
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        {/* Left: Chat Refinement Pane */}
        <div className="w-full md:w-1/2 h-1/2 md:h-full flex flex-col border-b md:border-b-0 md:border-r border-border" id="planner-chat-area">
          {isCreatingSession ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3 animate-fade-in">
                <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                <p className="text-sm text-muted-foreground">
                  Initializing planner sandbox...
                </p>
              </div>
            </div>
          ) : (
            <CoursePlannerChat
              messages={messages}
              isLoading={plannerLoading}
              error={plannerError}
              onClearError={clearError}
              onSend={handleSend}
              disabled={!sessionId}
            />
          )}
        </div>

        {/* Right: Live visual course structure preview */}
        <div className="w-full md:w-1/2 h-1/2 md:h-full flex flex-col bg-card/25" id="planner-preview-area">
          <CoursePlanPreview
            plan={activePlan}
            requirements={requirements}
            version={planVersion}
            versions={versions}
            onSwitchVersion={switchVersion}
          />
        </div>
      </div>
    </div>
  );
}
