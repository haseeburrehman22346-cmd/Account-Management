"use client";

import { Cell, Label, Pie, PieChart } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { categoryColorIndex, getCategoryColor } from "@/data";
import { formatCompact, formatMoney } from "@/lib/format";
import type { DashboardOverview } from "@/types";
import { ChartTooltipBox } from "./chart-tooltip-box";

type Slice = DashboardOverview["byCategory"][number];

export function CategoryBreakdownChart({ data }: { data: Slice[] }) {
  const total = data.reduce((sum, s) => sum + s.total, 0);
  // Ring follows the palette's validated order so neighbouring slices stay distinguishable;
  // the legend lists by amount and carries the exact figures.
  const ring = [...data].sort((a, b) => categoryColorIndex(a.color) - categoryColorIndex(b.color));
  const legend = [...data].sort((a, b) => b.total - a.total);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Expenses by Category</CardTitle>
      </CardHeader>
      <CardContent className="@container">
        {total === 0 ? (
          <p className="flex h-56 items-center justify-center text-sm text-muted-foreground">No expenses yet.</p>
        ) : (
          <div className="flex flex-col items-center gap-6 @md:flex-row">
            <ChartContainer config={{}} className="aspect-square h-52 shrink-0">
              <PieChart>
                <ChartTooltip
                  content={({ active, payload }) => {
                    const s = active && (payload?.[0]?.payload as Slice | undefined);
                    return s ? (
                      <ChartTooltipBox
                        title={s.name}
                        swatch={getCategoryColor(s.color)}
                        value={formatMoney(s.total)}
                        detail={`${s.percent}% of total`}
                      />
                    ) : null;
                  }}
                />
                <Pie
                  data={ring}
                  dataKey="total"
                  nameKey="name"
                  innerRadius="62%"
                  outerRadius="100%"
                  stroke="var(--card)"
                  strokeWidth={2}
                  isAnimationActive={false}
                >
                  {ring.map((s) => (
                    <Cell key={s.id} fill={getCategoryColor(s.color)} />
                  ))}
                  <Label
                    content={({ viewBox }) => {
                      if (!viewBox || !("cx" in viewBox)) return null;
                      const { cx, cy } = viewBox as { cx: number; cy: number };
                      return (
                        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
                          <tspan x={cx} dy="-0.6em" className="fill-muted-foreground text-xs">
                            PKR
                          </tspan>
                          <tspan x={cx} dy="1.3em" className="fill-foreground text-lg font-semibold">
                            {formatCompact(total)}
                          </tspan>
                          <tspan x={cx} dy="1.4em" className="fill-muted-foreground text-xs">
                            Total
                          </tspan>
                        </text>
                      );
                    }}
                  />
                </Pie>
              </PieChart>
            </ChartContainer>

            <ul className="w-full space-y-2.5 text-sm" aria-label="Expenses by category">
              {legend.map((s) => (
                <li key={s.id} className="flex items-center gap-2">
                  <span className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: getCategoryColor(s.color) }} />
                  <span className="min-w-0 flex-1 truncate">{s.name}</span>
                  <span className="w-12 text-right text-muted-foreground tabular-nums">{s.percent}%</span>
                  <span className="text-right font-medium whitespace-nowrap tabular-nums">{formatMoney(s.total)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
