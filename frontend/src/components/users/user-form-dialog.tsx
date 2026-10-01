"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ErrorAlert } from "@/components/shared/error-alert";
import { MultiSelect } from "@/components/shared/multi-select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ROLE_OPTIONS } from "@/data";
import { useFetch } from "@/hooks/use-fetch";
import { errorMessage } from "@/lib/format";
import { categoriesService, usersService } from "@/services";
import type { ManagedUser, Role, UserInput } from "@/types";

/** Add (no `user`) or edit a user, including which categories they can access. */
export function UserFormDialog({
  open,
  onOpenChange,
  user,
  isSelf,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: ManagedUser;
  isSelf?: boolean;
  onSaved: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{user ? "Edit User" : "Add User"}</DialogTitle>
          <DialogDescription>
            {user ? "Update details, status or category access." : "They can sign in with this email and password."}
          </DialogDescription>
        </DialogHeader>
        <UserForm user={user} isSelf={isSelf} onCancel={() => onOpenChange(false)} onSaved={onSaved} />
      </DialogContent>
    </Dialog>
  );
}

const listCategories = () => categoriesService.list();

function UserForm({
  user,
  isSelf,
  onCancel,
  onSaved,
}: {
  user?: ManagedUser;
  isSelf?: boolean;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const { data: categories } = useFetch(listCategories);
  const [form, setForm] = useState<UserInput>({
    name: user?.name ?? "",
    email: user?.email ?? "",
    role: user?.role ?? "user",
    active: user?.active ?? true,
    categoryIds: user?.categories.map((c) => c.id) ?? [],
    password: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const update = <K extends keyof UserInput>(key: K, value: UserInput[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const input: UserInput = { ...form, password: form.password || undefined };
    try {
      if (user) await usersService.update(user.id, input);
      else await usersService.create(input);
      toast.success(user ? "User updated" : `${form.name} added`);
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="user-name">Name</Label>
          <Input id="user-name" value={form.name} onChange={(e) => update("name", e.target.value)} required autoFocus />
        </div>
        <div className="space-y-2">
          <Label htmlFor="user-email">Email</Label>
          <Input id="user-email" type="email" value={form.email} onChange={(e) => update("email", e.target.value)} required />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="user-role">Role</Label>
          <Select value={form.role} onValueChange={(v) => update("role", v as Role)} disabled={isSelf}>
            <SelectTrigger id="user-role" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map(({ value, label }) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="user-password">{user ? "Reset password (optional)" : "Password"}</Label>
          <Input
            id="user-password"
            type="password"
            minLength={6}
            autoComplete="new-password"
            placeholder={user ? "Leave blank to keep" : "At least 6 characters"}
            value={form.password}
            onChange={(e) => update("password", e.target.value)}
            required={!user}
          />
        </div>
      </div>

      {form.role === "user" ? (
        <div className="space-y-2">
          <Label htmlFor="user-categories">Category access</Label>
          <MultiSelect
            id="user-categories"
            options={(categories ?? []).map((c) => ({ value: c.id, label: c.name, description: c.description }))}
            value={form.categoryIds}
            onChange={(v) => update("categoryIds", v)}
            placeholder="Select categories"
            searchPlaceholder="Search categories…"
            emptyText="No categories found."
          />
        </div>
      ) : (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">Admins can access all categories.</p>
      )}

      <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
        <div>
          <Label htmlFor="user-active">Active</Label>
          <p className="text-xs text-muted-foreground">Inactive users can&apos;t sign in.</p>
        </div>
        <Switch id="user-active" checked={form.active} onCheckedChange={(v) => update("active", v)} disabled={isSelf} />
      </div>

      <ErrorAlert message={error} />

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : user ? "Save Changes" : "Create User"}
        </Button>
      </DialogFooter>
    </form>
  );
}
