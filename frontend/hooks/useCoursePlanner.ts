"use client";

import { useState, useCallback } from "react";
import { streamChat } from "@/lib/api";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

export interface CourseRequirements {
  subject?: string | null;
  audience?: string | null;
  skill_level?: string | null;
  duration?: string | null;
  session_frequency?: string | null;
  learning_goals?: string[] | null;
}

export interface Assessment {
  title: string;
  type: "quiz" | "project" | "exam";
  description: string;
}

export interface Lesson {
  title: string;
  objectives: string[];
  resources: string[];
  duration: string;
}

export interface Module {
  title: string;
  description: string;
  lessons: Lesson[];
  assignments: string[];
  assessments: Assessment[];
}

export interface CoursePlan {
  course_title?: string;
  description?: string;
  total_duration?: string;
  target_audience?: string;
  skill_level?: string;
  modules?: Module[];
}

export interface PlanVersionRecord {
  id: string;
  version: number;
  plan: CoursePlan;
  requirements: CourseRequirements;
  created_at: string;
}

interface UseCoursePlannerReturn {
  messages: ChatMessage[];
  requirements: CourseRequirements;
  activePlan: CoursePlan | null;
  planVersion: number;
  versions: PlanVersionRecord[];
  isLoading: boolean;
  error: string | null;
  sendPlannerMessage: (sessionId: string, message: string) => Promise<void>;
  loadSessionPlan: (sessionId: string) => Promise<void>;
  switchVersion: (versionNum: number) => void;
  clearError: () => void;
}

let messageIdCounter = 0;
function nextId() {
  return `plan-msg-${Date.now()}-${++messageIdCounter}`;
}

export function useCoursePlanner(): UseCoursePlannerReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [requirements, setRequirements] = useState<CourseRequirements>({});
  const [activePlan, setActivePlan] = useState<CoursePlan | null>(null);
  const [planVersion, setPlanVersion] = useState(0);
  const [versions, setVersions] = useState<PlanVersionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const loadSessionPlan = useCallback(async (sessionId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      // 1. Get Plan
      const planRes = await fetch(`/api/v1/sessions/${sessionId}/course-plan`);
      if (planRes.ok) {
        const planData = await planRes.json();
        if (planData.plan && planData.plan.course_title) {
          setActivePlan(planData.plan);
        } else {
          setActivePlan(null);
        }
        setRequirements(planData.requirements || {});
        setPlanVersion(planData.version || 0);
      }

      // 2. Get Messages
      const msgRes = await fetch(`/api/v1/sessions/${sessionId}/messages`);
      if (msgRes.ok) {
        const msgData = await msgRes.json();
        setMessages(
          (msgData || []).map((m: { id: string; role: string; content: string }) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            content: m.content,
          }))
        );
      }

      // 3. Get All Plan Versions
      const versionsRes = await fetch(`/api/v1/sessions/${sessionId}/course-plans`);
      if (versionsRes.ok) {
        const versionsData = await versionsRes.json();
        setVersions(versionsData || []);
      }
    } catch (err) {
      setError("Failed to load plan history.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const switchVersion = useCallback(
    (versionNum: number) => {
      const match = versions.find((v) => v.version === versionNum);
      if (match) {
        setActivePlan(match.plan);
        setRequirements(match.requirements);
        setPlanVersion(match.version);
      }
    },
    [versions]
  );

  const sendPlannerMessage = useCallback(
    async (sessionId: string, message: string) => {
      if (!message.trim() || isLoading) return;

      setError(null);

      const userMsg: ChatMessage = {
        id: nextId(),
        role: "user",
        content: message.trim(),
      };

      const assistantId = nextId();
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        isStreaming: true,
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsLoading(true);

      try {
        const stream = streamChat("/courses/chat", {
          session_id: sessionId,
          message: message.trim(),
        });

        let updatedPlan: CoursePlan | null = null;
        let updatedReqs: CourseRequirements | null = null;

        for await (const { event, data } of stream) {
          if (event === "token") {
            try {
              const parsed = JSON.parse(data);
              const token = parsed.text || "";
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: m.content + token } : m
                )
              );
            } catch {
              // skip
            }
          } else if (event === "requirements") {
            try {
              const reqs = JSON.parse(data);
              setRequirements(reqs);
              updatedReqs = reqs;
            } catch {
              // skip
            }
          } else if (event === "plan") {
            try {
              const plan = JSON.parse(data);
              setActivePlan(plan);
              updatedPlan = plan;
              setPlanVersion((prev) => prev + 1);
            } catch {
              // skip
            }
          } else if (event === "error") {
            try {
              const parsed = JSON.parse(data);
              setError(parsed.error || "An error occurred");
            } catch {
              setError("An error occurred during streaming");
            }
          }
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, isStreaming: false } : m
          )
        );

        // Fetch updated versions list from DB
        const versionsRes = await fetch(`/api/v1/sessions/${sessionId}/course-plans`);
        if (versionsRes.ok) {
          const versionsData = await versionsRes.json();
          setVersions(versionsData || []);
        } else if (updatedPlan && updatedReqs) {
          // Fallback update optimistically
          setVersions((prev) => [
            {
              id: `opt-${Date.now()}`,
              version: planVersion + 1,
              plan: updatedPlan!,
              requirements: updatedReqs!,
              created_at: new Date().toISOString(),
            },
            ...prev,
          ]);
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to send message";
        setError(errorMessage);
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, planVersion]
  );

  return {
    messages,
    requirements,
    activePlan,
    planVersion,
    versions,
    isLoading,
    error,
    sendPlannerMessage,
    loadSessionPlan,
    switchVersion,
    clearError,
  };
}
