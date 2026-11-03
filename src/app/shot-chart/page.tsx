import type { Metadata } from "next";
import { ShotChartGame } from "@/components/shot-chart/ShotChartGame";

export const metadata: Metadata = {
  title: "Shot Chart",
  description: "Five real shot charts a day, from a star season to a deep cut. Name the player.",
};

export default function ShotChartPage() {
  return <ShotChartGame />;
}
