import type { Metadata } from "next";

export const metadata: Metadata = { title: "How it works" };

export default function About() {
  return (
    <article className="mx-auto max-w-2xl px-4 pt-10 sm:px-6">
      <h1 className="text-4xl font-extrabold tracking-tight">How Tripdub works</h1>
      <p className="mt-4 text-lg text-ink-soft">
        Every stat on Tripdub is real. Player ratings are our own model, built from those stats.
      </p>
    </article>
  );
}
