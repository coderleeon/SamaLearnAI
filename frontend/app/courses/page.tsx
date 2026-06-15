import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Course Planner — SamaSocial AI",
  description:
    "Design structured course plans through conversation with AI. Generate modules, lessons, and assessments.",
};

export default function CoursesPage() {
  return (
    <main className="flex-1 flex items-center justify-center">
      <div className="text-center animate-fade-in">
        <h1 className="text-2xl font-bold mb-2">Course Planner</h1>
        <p className="text-muted-foreground">
          Coming in Phase 5 — Plan courses with AI assistance.
        </p>
      </div>
    </main>
  );
}
