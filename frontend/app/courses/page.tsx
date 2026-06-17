import type { Metadata } from "next";
import CoursesClient from "./CoursesClient";

export const metadata: Metadata = {
  title: "Course Planner — SamaSocial AI",
  description:
    "Design structured course plans through conversation with AI. Generate modules, lessons, and assessments.",
};

export default function CoursesPage() {
  return <CoursesClient />;
}
