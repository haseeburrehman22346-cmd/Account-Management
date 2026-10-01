"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CHART_RANGE_OPTIONS } from "@/data";
import { formatCompact, formatMonth, formatMoney } from "@/lib/format";
import { ChartTooltipBox } from "./chart-tooltip-box";

const config = { total: { label: "Expenses", color: "var(--chart-1)" } } satisfies ChartConfig;

export function MonthlyExpensesChart({
  data,
  months,
  onMonthsChange,
}: {
  data: { month: string; total: number }[];
  months: number;
  onMonthsChange: (months: number) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthly Expenses</CardTitle>
        <CardAction>
          <Select value={String(months)} onValueChange={(v) => onMonthsChange(Number(v))}>
            <SelectTrigger size="sm" className="w-36" aria-label="Chart range">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {CHART_RANGE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={String(o.value)}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="aspect-auto h-64 w-full">
          <BarChart data={data} margin={{ left: 4, right: 4, top: 8 }} barCategoryGap="28%">
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(m: string) => formatMonth(m, months > 6)}
            />
            <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={(v: number) => formatCompact(v)} />
            <ChartTooltip
              cursor={{ fill: "var(--muted)" }}
              content={({ active, payload }) => {
                const row = active && payload?.[0]?.payload;
                return row ? (
                  <ChartTooltipBox title={formatMonth(row.month, true)} value={formatMoney(row.total)} />
                ) : null;
              }}
            />
            <Bar dataKey="total" fill="var(--color-total)" radius={[4, 4, 0, 0]} maxBarSize={36} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
