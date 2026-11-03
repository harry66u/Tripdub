import type { Metadata } from "next";
import { DeepCutGame } from "@/components/deep-cut/DeepCutGame";

export const metadata: Metadata = {
  title: "Deep Cut",
  description: "Seven NBA prompts a day with many right answers. Name a player: the rarer your answer, the deeper your shot.",
};

export default function DeepCutPage() {
  return <DeepCutGame />;
}
