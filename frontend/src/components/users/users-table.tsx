"use client";

import { MoreVerticalIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
import { UserAvatarWithName } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ManagedUser } from "@/types";

export function UsersTable({
  users,
  currentUserId,
  onEdit,
  onDelete,
}: {
  users: ManagedUser[];
  currentUserId?: string;
  onEdit: (user: ManagedUser) => void;
  onDelete: (user: ManagedUser) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/50 hover:bg-muted/50">
          <TableHead className="w-10">#</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Category Access</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="w-14 text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((u, i) => {
          const isMe = u.id === currentUserId;
          return (
            <TableRow key={u.id}>
              <TableCell className="text-muted-foreground">{i + 1}</TableCell>
              <TableCell>
                <UserAvatarWithName name={u.name} isYou={isMe} />
              </TableCell>
              <TableCell className="text-muted-foreground">{u.email}</TableCell>
              <TableCell>
                <Badge variant={u.role === "admin" ? "default" : "secondary"} className="capitalize">
                  {u.role}
                </Badge>
              </TableCell>
              <TableCell className="max-w-64 truncate">
                {u.role === "admin" ? (
                  "All Categories"
                ) : u.categories.length ? (
                  u.categories.map((c) => c.name).join(", ")
                ) : (
                  <span className="text-muted-foreground">No access</span>
                )}
              </TableCell>
              <TableCell>
                <StatusBadge active={u.active} />
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${u.name}`}>
                      <MoreVerticalIcon />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => onEdit(u)}>
                      <PencilIcon /> Edit
                    </DropdownMenuItem>
                    {!isMe && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onSelect={() => onDelete(u)}>
                          <Trash2Icon /> Delete
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
