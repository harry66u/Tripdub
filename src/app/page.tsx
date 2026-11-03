import { LogoLockup } from "@/components/brand/Logo";
import { HomeDashboard } from "@/components/home/HomeDashboard";

export default function Home() {
  return (
    <>
      <section className="flex flex-col items-center px-4 pt-8 text-center sm:pt-10">
        <LogoLockup className="w-full max-w-[360px]" />
        <p className="mt-3 max-w-md text-lg text-ink-soft">Three daily basketball games. New puzzles every midnight ET.</p>
      </section>
      <HomeDashboard />
    </>
  );
}
