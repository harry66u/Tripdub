import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t-[2.5px] border-ink bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-ink-soft sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          Stats from{" "}
          <a className="underline decoration-sky-deep underline-offset-2" href="https://www.basketball-reference.com/">
            Basketball-Reference
          </a>{" "}
          and NBA.com. Not affiliated with the NBA.
        </p>
        <Link href="/about" className="font-semibold text-ink">
          Data and methodology
        </Link>
      </div>
    </footer>
  );
}
