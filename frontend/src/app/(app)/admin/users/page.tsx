"use client";

import { UserPlusIcon } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ErrorAlert } from "@/components/shared/error-alert";
import { TableSkeleton } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { TableCard } from "@/components/shared/table-card";
import { Button } from "@/components/ui/button";
import { UserFormDialog } from "@/components/users/user-form-dialog";
import { UsersTable } from "@/components/users/users-table";
import { useAuth } from "@/hooks/use-auth";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useFetch } from "@/hooks/use-fetch";
import { usersService } from "@/services";
import type { ManagedUser } from "@/types";

export default function UsersPage() {
  const { user: me } = useAuth();
  const [query, setQuery] = useState("");
  const q = useDebouncedValue(query.trim());
  const fetcher = useCallback(() => usersService.list(q), [q]);
  const { data: users, error, isLoading, reload } = useFetch(fetcher);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ManagedUser>();
  const [deleting, setDeleting] = useState<ManagedUser | null>(null);

  const openForm = (user?: ManagedUser) => {
    setEditing(user);
    setFormOpen(true);
  };

  return (
    <>
      <PageHeader title="Users & Category Access" description="Create users and choose which categories they can see" />
      <ErrorAlert message={error} />

      <TableCard
        title={`Users${users ? ` (${users.length})` : ""}`}
        actions={
          <>
            <SearchInput value={query} onChange={setQuery} placeholder="Search users…" />
            <Button onClick={() => openForm()}>
              <UserPlusIcon /> Add User
            </Button>
          </>
        }
      >
        {isLoading ? (
          <div className="p-4">
            <TableSkeleton />
          </div>
        ) : users?.length ? (
          <UsersTable users={users} currentUserId={me?.id} onEdit={openForm} onDelete={setDeleting} />
        ) : (
          <p className="py-10 text-center text-sm text-muted-foreground">No users match your search.</p>
        )}
      </TableCard>

      <UserFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        user={editing}
        isSelf={!!editing && editing.id === me?.id}
        onSaved={() => {
          setFormOpen(false);
          reload();
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.name}?`}
        description="Users who have recorded expenses can't be deleted — deactivate them instead to keep the history."
        onConfirm={async () => {
          await usersService.remove(deleting!.id);
          toast.success("User deleted");
          reload();
        }}
      />
    </>
  );
}
