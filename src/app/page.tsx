import Link from "next/link";
import { LogoLockup } from "@/components/brand/Logo";

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-8 sm:px-6 sm:pt-12">
      <section className="flex flex-col items-center text-center">
        <LogoLockup className="w-full max-w-[420px]" />
        <p className="mt-4 max-w-md text-lg text-ink-soft">Three daily games for hoops heads. New puzzles every midnight ET.</p>
      </section>

      <section className="mt-10">
        <Link
          href="/starting-five"
          className="pop group block rounded-[var(--radius-card)] bg-white p-6 transition-transform hover:-translate-y-0.5 sm:p-8"
        >
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Starting Five</h2>
          <p className="mt-2 max-w-xl text-ink-soft">
            Spin for five real NBA players, slot each one into your lineup, and take on today’s Mystery Five.
          </p>
          <span className="btn btn-coral mt-6">Play today’s game</span>
        </Link>
      </section>
    </div>
  );
}
