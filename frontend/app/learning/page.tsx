import type { Metadata } from "next";
import LearningClient from "./LearningClient";

export const metadata: Metadata = {
  title: "Learning Assistant — SamaSocial AI",
  description:
    "Upload PDFs, presentations, YouTube videos, and websites. Ask questions and get grounded answers with source citations.",
};

export default function LearningPage() {
  return <LearningClient />;
}
