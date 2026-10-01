import { UserAvatarWithName } from "@/components/shared/user-avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney } from "@/lib/format";
import type { CategoryMember } from "@/types";

export function CategoryMembersTable({ members }: { members: CategoryMember[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/50 hover:bg-muted/50">
          <TableHead>User</TableHead>
          <TableHead className="text-right">Expenses Paid</TableHead>
          <TableHead className="text-right">Total Paid</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.map((m) => (
          <TableRow key={m.id}>
            <TableCell>
              <UserAvatarWithName name={m.name} subtitle={m.email} />
            </TableCell>
            <TableCell className="text-right tabular-nums">{m.expenseCount}</TableCell>
            <TableCell className="text-right font-medium tabular-nums">{formatMoney(m.totalSpent)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
