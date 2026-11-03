import type { Metadata } from "next";
import { TriviaGame } from "@/components/trivia/TriviaGame";

export const metadata: Metadata = {
  title: "Daily Trivia",
  description: "Seven general-knowledge questions a day. Faster right answers score more.",
};

export default function TriviaPage() {
  return <TriviaGame />;
}
