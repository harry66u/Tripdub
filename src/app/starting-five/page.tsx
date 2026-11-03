import type { Metadata } from "next";
import { Game } from "@/components/starting-five/Game";

export const metadata: Metadata = {
  title: "Starting Five",
  description: "Spin for five real NBA players, slot them into your lineup, and take on tonight’s Mystery Five.",
};

export default function StartingFivePage() {
  return <Game />;
}
