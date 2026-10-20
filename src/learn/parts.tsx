import { cn } from "@/utils/cn";

// 원리 페이지에서 같이 쓰는 작은 부품: 교훈·발견 상자, 표, 막대그래프

const CALLOUT_STYLE = {
  lesson: {
    icon: "💡",
    label: "교훈",
    tone: "border-amber-300/50 bg-amber-300/10",
  },
  found: { icon: "🔍", label: "발견", tone: "border-sky-300/50 bg-sky-300/10" },
  fail: {
    icon: "🧱",
    label: "헛디딘 길",
    tone: "border-rose-300/40 bg-rose-300/10",
  },
};

export function Callout({
  kind,
  title,
  children,
}: {
  kind: keyof typeof CALLOUT_STYLE;
  title?: string;
  children: React.ReactNode;
}) {
  const style = CALLOUT_STYLE[kind];

  return (
    <aside
      className={cn("rounded-box border-l-4 px-4 py-3 text-sm", style.tone)}
    >
      <div className="mb-1 font-bold">
        {style.icon} {title ?? style.label}
      </div>
      <div className="flex flex-col gap-2 leading-relaxed opacity-90">
        {children}
      </div>
    </aside>
  );
}

// 머리줄과 줄들로 그리는 표. 강조할 줄은 highlight로
export function DataTable({
  head,
  rows,
  highlight,
}: {
  head: string[];
  rows: React.ReactNode[][];
  highlight?: number[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="table-sm table w-full text-sm">
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} className="text-xs opacity-70">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className={cn(
                highlight?.includes(i) && "bg-indigo-400/15 font-bold",
              )}
            >
              {row.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// 가로 막대그래프. log가 참이면 로그 눈금(값이 수십~수천만으로 벌어질 때)
export function BarChart({
  items,
  log,
  format = (v) => v.toLocaleString("ko-KR"),
}: {
  items: { label: string; value: number; note?: string; highlight?: boolean }[];
  log?: boolean;
  format?: (v: number) => string;
}) {
  const scale = (v: number) => (log ? Math.log10(Math.max(1, v)) : v);
  const max = Math.max(...items.map((i) => scale(i.value)));

  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => (
        <div key={item.label} className="flex flex-col gap-0.5 text-sm">
          <div className="flex justify-between gap-2">
            <span className={cn(item.highlight && "font-bold")}>
              {item.label}
            </span>
            <span className="font-mono text-xs opacity-80">
              {format(item.value)}
              {item.note && <span className="opacity-60"> · {item.note}</span>}
            </span>
          </div>
          <div className="bg-base-300/60 h-2.5 overflow-hidden rounded-full">
            <div
              className={cn(
                "h-full rounded-full",
                item.highlight ? "bg-amber-300" : "bg-indigo-400/80",
              )}
              style={{ width: `${(scale(item.value) / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
      {log && (
        <div className="text-right text-xs opacity-50">
          로그 눈금 (한 칸에 10배)
        </div>
      )}
    </div>
  );
}
