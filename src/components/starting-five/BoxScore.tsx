import type { TeamBox } from "@/games/starting-five/engine/sim";
import { SLOTS, type Lineup } from "@/games/starting-five/types";

const COLS = ["PTS", "REB", "AST", "STL", "BLK", "FG", "3P", "FT"] as const;

export function BoxScore({ title, lineup, box }: { title: string; lineup: Lineup; box: TeamBox }) {
  const rows = SLOTS.map((s) => {
    const b = box.players[s];
    return {
      slot: s,
      name: lineup[s].name,
      cells: [b.pts, b.reb, b.ast, b.stl, b.blk, `${b.fgm}-${b.fga}`, `${b.fg3m}-${b.fg3a}`, `${b.ftm}-${b.fta}`],
    };
  });
  const sum = (k: keyof TeamBox["players"]["PG"]) => SLOTS.reduce((a, s) => a + box.players[s][k], 0);
  const totals = [
    box.score,
    sum("reb"),
    sum("ast"),
    sum("stl"),
    sum("blk"),
    `${sum("fgm")}-${sum("fga")}`,
    `${sum("fg3m")}-${sum("fg3a")}`,
    `${sum("ftm")}-${sum("fta")}`,
  ];
  return (
    <div className="overflow-x-auto rounded-[20px] border-[2.5px] border-ink bg-white">
      <table className="tnum w-full min-w-[560px] text-sm">
        <caption className="border-b-2 border-ink bg-sky-soft px-4 py-2 text-left font-bold">{title}</caption>
        <thead>
          <tr className="text-xs text-ink-soft">
            <th className="px-4 py-2 text-left font-semibold">Player</th>
            {COLS.map((c) => (
              <th key={c} className="px-2 py-2 text-right font-semibold">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.slot} className="border-t border-ink/10">
              <td className="px-4 py-2 text-left">
                <span className="varsity mr-2 text-xs text-ink-soft">{r.slot}</span>
                <span className="font-semibold">{r.name}</span>
              </td>
              {r.cells.map((c, i) => (
                <td key={i} className={`px-2 py-2 text-right ${i === 0 ? "font-bold" : ""}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
          <tr className="border-t-2 border-ink font-bold">
            <td className="px-4 py-2 text-left">Team</td>
            {totals.map((c, i) => (
              <td key={i} className="px-2 py-2 text-right">
                {c}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
