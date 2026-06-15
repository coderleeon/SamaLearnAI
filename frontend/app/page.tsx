"use client";

import Link from "next/link";
import { BookOpen, GraduationCap, Sparkles } from "lucide-react";

const tasks = [
  {
    href: "/learning",
    icon: BookOpen,
    title: "Learning Assistant",
    description:
      "Upload PDFs, presentations, YouTube videos, and websites — then ask questions. Get grounded answers with source citations.",
    gradient: "from-indigo-500 to-cyan-400",
    badge: "Task 1 — RAG",
  },
  {
    href: "/courses",
    icon: GraduationCap,
    title: "Course Planner",
    description:
      "Design structured course plans through conversation. Define modules, lessons, objectives, and assessments — all validated as JSON.",
    gradient: "from-violet-500 to-fuchsia-400",
    badge: "Task 2 — Planning",
  },
];

export default function HomePage() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4 py-16">
      {/* Header */}
      <div className="text-center mb-12 animate-fade-in">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass text-sm text-muted-foreground mb-6">
          <Sparkles className="w-4 h-4 text-primary" />
          Powered by Gemini &middot; LangGraph &middot; Supabase
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
          <span className="gradient-text">SamaSocial</span>{" "}
          <span className="text-foreground">AI Assistant</span>
        </h1>
        <p className="text-muted-foreground text-lg max-w-xl mx-auto">
          Two AI-powered tools for learning and teaching. Choose a task below to
          get started.
        </p>
      </div>

      {/* Task Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl w-full">
        {tasks.map((task, i) => (
          <Link
            key={task.href}
            href={task.href}
            id={`task-card-${i + 1}`}
            className="group relative rounded-2xl p-[1px] transition-all duration-300 hover:scale-[1.02]"
            style={{ animationDelay: `${i * 100}ms` }}
          >
            {/* Gradient border */}
            <div
              className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${task.gradient} opacity-20 group-hover:opacity-40 transition-opacity`}
            />

            {/* Card content */}
            <div className="relative glass rounded-2xl p-6 h-full flex flex-col gap-4">
              {/* Badge */}
              <span className="self-start text-xs font-medium px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
                {task.badge}
              </span>

              {/* Icon */}
              <div
                className={`w-12 h-12 rounded-xl bg-gradient-to-br ${task.gradient} flex items-center justify-center`}
              >
                <task.icon className="w-6 h-6 text-white" />
              </div>

              {/* Text */}
              <h2 className="text-xl font-semibold text-card-foreground group-hover:text-foreground transition-colors">
                {task.title}
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                {task.description}
              </p>

              {/* CTA */}
              <div className="flex items-center gap-1 text-sm font-medium text-primary group-hover:text-primary-hover transition-colors">
                Get started
                <span className="group-hover:translate-x-1 transition-transform">
                  →
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Footer */}
      <p className="mt-12 text-xs text-muted-foreground">
        SamaSocial AI Assignment &middot; Built with Next.js 15, FastAPI,
        LangGraph, Supabase
      </p>
    </main>
  );
}
