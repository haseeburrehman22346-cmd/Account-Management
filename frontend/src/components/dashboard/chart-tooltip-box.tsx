/** Small tooltip body shared by the dashboard charts; text uses ink tokens, the swatch carries identity. */
export function ChartTooltipBox({
  title,
  value,
  swatch,
  detail,
}: {
  title: string;
  value: string;
  swatch?: string;
  detail?: string;
}) {
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1 flex items-center gap-1.5 font-medium text-popover-foreground">
        {swatch && <span className="size-2.5 rounded-sm" style={{ backgroundColor: swatch }} />}
        {title}
      </p>
      <p className="text-sm font-semibold tabular-nums text-popover-foreground">{value}</p>
      {detail && <p className="text-muted-foreground">{detail}</p>}
    </div>
  );
}
