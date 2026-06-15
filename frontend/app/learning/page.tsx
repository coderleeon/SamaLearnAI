import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Learning Assistant — SamaSocial AI",
  description:
    "Upload PDFs, presentations, YouTube videos, and websites. Ask questions and get grounded answers with source citations.",
};

export default function LearningPage() {
  return (
    <main className="flex-1 flex items-center justify-center">
      <div className="text-center animate-fade-in">
        <h1 className="text-2xl font-bold mb-2">Learning Assistant</h1>
        <p className="text-muted-foreground">
          Coming in Phase 2 — Upload sources and chat with AI.
        </p>
      </div>
    </main>
  );
}
