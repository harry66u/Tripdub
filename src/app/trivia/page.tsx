import type { Metadata } from "next";
import { TriviaGame } from "@/components/trivia/TriviaGame";

export const metadata: Metadata = {
  title: "NBA Trivia",
  description: "Seven NBA questions a day, built from real stats. The faster you answer, the more you score.",
};

export default function TriviaPage() {
  return <TriviaGame />;
}
