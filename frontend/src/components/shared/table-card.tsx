import { Card, CardAction, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

/** Card with a titled toolbar, an edge-to-edge table and an optional footer (e.g. pagination). */
export function TableCard({
  title,
  actions,
  footer,
  children,
}: {
  title?: React.ReactNode;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="gap-0 py-0">
      {(title || actions) && (
        <CardHeader className="flex flex-wrap items-center gap-3 border-b py-4">
          {title && <CardTitle className="text-base">{title}</CardTitle>}
          {actions && <CardAction className="col-start-auto row-span-1 flex flex-wrap items-center gap-2 sm:ml-auto">{actions}</CardAction>}
        </CardHeader>
      )}
      <CardContent className="overflow-x-auto px-0">{children}</CardContent>
      {footer && <CardFooter className="border-t py-3">{footer}</CardFooter>}
    </Card>
  );
}
