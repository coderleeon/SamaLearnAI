"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, GraduationCap, Plus } from "lucide-react";
import { createSession } from "@/lib/api";
import { useCoursePlanner } from "@/hooks/useCoursePlanner";
import CoursePlannerChat from "@/components/courses/CoursePlannerChat";
import CoursePlanPreview from "@/components/courses/CoursePlanPreview";

export default function CoursesClient() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);

  const {
    messages,
    requirements,
    activePlan,
    planVersion,
    isLoading: plannerLoading,
    error: plannerError,
    sendPlannerMessage,
    loadSessionPlan,
    clearError,
  } = useCoursePlanner();

  // Initialize session on mount
  useEffect(() => {
    initSession();
  }, []);

  async function initSession() {
    setIsCreatingSession(true);
    try {
      const session = await createSession("course", "Course Planning Session");
      setSessionId(session.id);
      await loadSessionPlan(session.id);
    } catch (err) {
      console.error("Failed to create planning session:", err);
    } finally {
      setIsCreatingSession(false);
    }
  }

  const handleNewSession = useCallback(async () => {
    setIsCreatingSession(true);
    try {
      const session = await createSession("course", "Course Planning Session");
      setSessionId(session.id);
      // Refresh local state by reloading page
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
        sendPlannerMessage(sessionId, message);
      }
    },
    [sessionId, sendPlannerMessage]
  );

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      {/* Top Header */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card/50 backdrop-blur-sm z-10">
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

      {/* Main split screens */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Chat Refinement Pane */}
        <div className="w-1/2 flex flex-col border-r border-border" id="planner-chat-area">
          {isCreatingSession ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3 animate-fade-in">
                <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                <p className="text-sm text-muted-foreground">
                  Initializing planner...
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
        <div className="w-1/2 flex flex-col bg-card/25" id="planner-preview-area">
          <CoursePlanPreview
            plan={activePlan}
            requirements={requirements}
            version={planVersion}
          />
        </div>
      </div>
    </div>
  );
}
