"use client";

import { motion } from "motion/react";
import { GRADE_LABELS, GRADE_ORDER, letter, type Grades } from "@/games/starting-five/engine/grades";

type Props = {
  grades: Grades;
  /** Show a second, thinner bar for comparison (e.g. the Mystery Five) */
  compare?: Grades;
  compareLabel?: string;
  dim?: boolean;
};

export function GradeBars({ grades, compare, compareLabel, dim }: Props) {
  return (
    <div className={`grid gap-2.5 ${dim ? "opacity-60" : ""}`}>
      {GRADE_ORDER.map((k) => (
        <div key={k} className="grid grid-cols-[6.5rem_1fr_2.6rem] items-center gap-3">
          <span className="text-sm font-semibold">{GRADE_LABELS[k]}</span>
          <div className="grid gap-1">
            <span className="relative h-3.5 overflow-hidden rounded-full border-2 border-ink bg-white">
              <motion.span
                className="absolute inset-y-0 left-0 rounded-full bg-coral"
                initial={false}
                animate={{ width: `${Math.max(3, grades[k])}%` }}
                transition={{ type: "spring", stiffness: 160, damping: 22 }}
              />
            </span>
            {compare && (
              <span className="relative h-2 overflow-hidden rounded-full bg-ink/10" aria-label={`${compareLabel}: ${letter(compare[k])}`}>
                <motion.span
                  className="absolute inset-y-0 left-0 rounded-full bg-ink"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(3, compare[k])}%` }}
                  transition={{ type: "spring", stiffness: 120, damping: 22, delay: 0.15 }}
                />
              </span>
            )}
          </div>
          <span className="varsity tnum text-right text-lg">{dim ? "–" : letter(grades[k])}</span>
        </div>
      ))}
    </div>
  );
}
