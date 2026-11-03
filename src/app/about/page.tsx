import type { Metadata } from "next";

export const metadata: Metadata = { title: "How it works" };

export default function About() {
  return (
    <article className="mx-auto max-w-2xl px-4 pt-10 sm:px-6">
      <h1 className="text-4xl font-extrabold tracking-tight">How Tripdub works</h1>
      <p className="mt-4 text-lg text-ink-soft">
        Every stat on Tripdub is real. Player ratings are our own model built from those stats. New puzzles unlock at midnight Eastern.
      </p>

      <h2 className="mt-10 text-2xl font-extrabold">Starting Five</h2>
      <div className="mt-3 grid gap-3 leading-relaxed">
        <p>
          Every card is one real season, like 2016 Stephen Curry or 2020 Damian Lillard, with that season’s real per-game
          numbers and team. Each player comes in up to four of his best seasons. Older eras only include the biggest names,
          and spins lean toward the last twenty years.
        </p>
        <p>
          Ratings compare each player to the league in his own seasons, so a 1960s rebounder is measured against 1960s
          rebounders. Where the league didn’t track a stat yet (blocks and steals before 1973-74, threes before 1979-80), the
          rating leans on the closest real signal, like free-throw shooting for touch or defensive win shares for defense.
          Those stats show as a dash on the card.
        </p>
        <p>
          Your lineup is graded on scoring, defense, rebounding, spacing, and playmaking. A lineup without a real playmaker or
          rim protector grades worse there. There’s no out-of-position penalty, but each slot guards and attacks the opposing
          player in the same slot, so matchups matter.
        </p>
        <p>
          The game is simulated possession by possession 400 times. Your score is your win probability, and the game we
          show is the one closest to the median result.
        </p>
      </div>

      <h2 className="mt-10 text-2xl font-extrabold">Data sources</h2>
      <ul className="mt-3 grid list-disc gap-2 pl-5 leading-relaxed">
        <li>
          Season stats, awards and player info:{" "}
          <a className="font-semibold underline" href="https://www.basketball-reference.com/">
            Basketball-Reference
          </a>
          , via the open{" "}
          <a className="underline" href="https://github.com/sumitrodatta/bball-reference-datasets">
            bball-reference-datasets
          </a>{" "}
          mirror.
        </li>
        <li>
          Player headshots and shot locations: <a className="font-semibold underline" href="https://www.nba.com/stats">NBA.com</a>.
          Player IDs matched with the{" "}
          <a className="underline" href="https://github.com/djblechn-su/nba-player-team-ids">
            nba-player-team-ids
          </a>{" "}
          crosswalk.
        </li>
      </ul>
      <p className="mt-6 text-sm text-ink-soft">Tripdub is a fan project and is not affiliated with or endorsed by the NBA.</p>
    </article>
  );
}
