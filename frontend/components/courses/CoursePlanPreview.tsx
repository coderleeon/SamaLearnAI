"use client";

import React, { useState } from "react";
import type { CoursePlan, CourseRequirements } from "@/hooks/useCoursePlanner";
import {
  Download,
  BookOpen,
  ChevronDown,
  ChevronUp,
  FileJson,
  Target,
  GraduationCap,
  Clock,
  Layers,
  CheckCircle,
  HelpCircle,
} from "lucide-react";

interface CoursePlanPreviewProps {
  plan: CoursePlan | null;
  requirements: CourseRequirements;
  version: number;
}

export default function CoursePlanPreview({
  plan,
  requirements,
  version,
}: CoursePlanPreviewProps) {
  const [expandedModules, setExpandedModules] = useState<Record<number, boolean>>({
    0: true, // Expand first module by default
  });

  const toggleModule = (index: number) => {
    setExpandedModules((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const handleExport = () => {
    if (!plan) return;
    const blob = new Blob([JSON.stringify(plan, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(plan.course_title || "course_plan")
      .toLowerCase()
      .replace(/\s+/g, "_")}_v${version}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const hasRequirements = Object.values(requirements).some(
    (v) => v !== null && (Array.isArray(v) ? v.length > 0 : true)
  );

  return (
    <div className="flex flex-col h-full bg-card/10">
      {/* Top Header */}
      <div className="px-4 py-3 border-b border-border bg-card/40 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-primary" />
            Live Preview
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {plan ? `Version ${version}` : "Drafting requirements"}
          </p>
        </div>

        {plan && (
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-primary text-primary-foreground hover:bg-primary-hover font-medium transition-colors"
            id="export-plan-btn"
          >
            <Download className="w-3.5 h-3.5" />
            Export JSON
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Requirements status board */}
        {hasRequirements && !plan && (
          <div className="glass rounded-xl p-4 animate-fade-in space-y-3">
            <h3 className="text-xs font-semibold text-foreground tracking-wider uppercase">
              Intake Checklist
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Subject", value: requirements.subject },
                { label: "Audience", value: requirements.audience },
                { label: "Skill Level", value: requirements.skill_level },
                { label: "Duration", value: requirements.duration },
                { label: "Frequency", value: requirements.session_frequency },
                {
                  label: "Learning Goals",
                  value: requirements.learning_goals?.length
                    ? `${requirements.learning_goals.length} goals`
                    : null,
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border/40"
                >
                  {item.value ? (
                    <CheckCircle className="w-4 h-4 text-success flex-shrink-0" />
                  ) : (
                    <HelpCircle className="w-4 h-4 text-muted-foreground/50 flex-shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted-foreground uppercase leading-tight">
                      {item.label}
                    </p>
                    <p className="text-xs font-medium text-foreground truncate leading-tight mt-0.5">
                      {item.value || "Not specified"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!plan && !hasRequirements && (
          <div className="h-full flex flex-col items-center justify-center text-center py-20 animate-fade-in">
            <FileJson className="w-12 h-12 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-card-foreground">No plan generated yet</p>
            <p className="text-xs text-muted-foreground max-w-xs mt-1">
              Start chatting on the left to set course targets, then click generate.
            </p>
          </div>
        )}

        {/* Course Plan Visual Preview */}
        {plan && (
          <div className="space-y-4 animate-fade-in">
            {/* Plan Header Card */}
            <div className="glass rounded-xl p-4 space-y-3 border-l-4 border-l-primary">
              <h1 className="text-lg font-bold text-foreground leading-snug">
                {plan.course_title}
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {plan.description}
              </p>

              {/* Badges */}
              <div className="flex flex-wrap gap-2 pt-1">
                {plan.target_audience && (
                  <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                    <GraduationCap className="w-3.5 h-3.5" />
                    {plan.target_audience}
                  </span>
                )}
                {plan.skill_level && (
                  <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full bg-secondary/10 text-secondary border border-secondary/20">
                    <Layers className="w-3.5 h-3.5" />
                    {plan.skill_level}
                  </span>
                )}
                {plan.total_duration && (
                  <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20">
                    <Clock className="w-3.5 h-3.5" />
                    {plan.total_duration}
                  </span>
                )}
              </div>
            </div>

            {/* Modules List */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-muted-foreground tracking-wider uppercase px-1">
                Modules
              </h3>

              {plan.modules?.map((mod, modIdx) => {
                const isOpen = expandedModules[modIdx];
                return (
                  <div
                    key={modIdx}
                    className="glass rounded-xl overflow-hidden border border-border"
                    id={`module-card-${modIdx}`}
                  >
                    {/* Module Header */}
                    <button
                      onClick={() => toggleModule(modIdx)}
                      className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-muted/30 transition-colors text-left"
                    >
                      <div className="min-w-0 pr-4">
                        <span className="text-[10px] text-primary font-bold tracking-wider uppercase">
                          Module {modIdx + 1}
                        </span>
                        <h4 className="text-sm font-semibold text-foreground truncate mt-0.5">
                          {mod.title}
                        </h4>
                      </div>
                      {isOpen ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </button>

                    {/* Module Content */}
                    {isOpen && (
                      <div className="px-4 pb-4 pt-1 border-t border-border/40 space-y-4 bg-muted/10">
                        {mod.description && (
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {mod.description}
                          </p>
                        )}

                        {/* Lessons */}
                        {mod.lessons?.length > 0 && (
                          <div className="space-y-2.5">
                            <h5 className="text-[11px] font-bold text-foreground uppercase tracking-wide">
                              Lessons
                            </h5>
                            <div className="space-y-2">
                              {mod.lessons.map((les, lesIdx) => (
                                <div
                                  key={lesIdx}
                                  className="p-3 rounded-lg bg-card border border-border/50 space-y-2"
                                >
                                  <div className="flex items-start justify-between gap-4">
                                    <h6 className="text-xs font-semibold text-foreground leading-snug">
                                      {les.title}
                                    </h6>
                                    <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded flex-shrink-0">
                                      {les.duration}
                                    </span>
                                  </div>

                                  {/* Objectives */}
                                  {les.objectives?.length > 0 && (
                                    <div className="space-y-1">
                                      <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">
                                        Objectives:
                                      </span>
                                      <ul className="list-disc list-inside space-y-0.5 pl-1">
                                        {les.objectives.map((obj, oIdx) => (
                                          <li
                                            key={oIdx}
                                            className="text-[11px] text-muted-foreground list-item"
                                          >
                                            {obj}
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}

                                  {/* Resources */}
                                  {les.resources?.length > 0 && (
                                    <div className="flex flex-wrap gap-1 items-center">
                                      <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider mr-1">
                                        Resources:
                                      </span>
                                      {les.resources.map((res, rIdx) => (
                                        <span
                                          key={rIdx}
                                          className="text-[10px] px-1.5 py-0.5 rounded bg-muted/60 text-foreground border border-border/30"
                                        >
                                          {res}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Assignments */}
                        {mod.assignments?.length > 0 && (
                          <div className="space-y-1.5">
                            <h5 className="text-[11px] font-bold text-foreground uppercase tracking-wide">
                              Assignments
                            </h5>
                            <ul className="space-y-1 pl-1">
                              {mod.assignments.map((ass, aIdx) => (
                                <li
                                  key={aIdx}
                                  className="text-xs text-muted-foreground flex items-start gap-1.5"
                                >
                                  <span className="text-primary mt-0.5">•</span>
                                  <span>{ass}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Assessments */}
                        {mod.assessments?.length > 0 && (
                          <div className="space-y-1.5">
                            <h5 className="text-[11px] font-bold text-foreground uppercase tracking-wide">
                              Assessments
                            </h5>
                            <div className="grid grid-cols-1 gap-2">
                              {mod.assessments.map((asmt, asIdx) => (
                                <div
                                  key={asIdx}
                                  className="p-2 rounded-lg bg-card/50 border border-border/30 flex items-start gap-2"
                                >
                                  <Target className="w-3.5 h-3.5 text-accent flex-shrink-0 mt-0.5" />
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs font-semibold text-foreground truncate">
                                        {asmt.title}
                                      </span>
                                      <span className="text-[9px] font-bold uppercase px-1 rounded bg-accent/10 text-accent border border-accent/20">
                                        {asmt.type}
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                                      {asmt.description}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
