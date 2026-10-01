"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ErrorAlert } from "@/components/shared/error-alert";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { errorMessage } from "@/lib/format";
import { authService } from "@/services";

export function AccountSettings() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ProfileCard />
      <PasswordCard />
    </div>
  );
}

function ProfileCard() {
  const { user, updateUser } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  if (!user) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      updateUser(await authService.updateProfile(name));
      toast.success("Profile updated");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <form onSubmit={submit} className="flex h-full flex-col gap-4">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your name as it appears to others.</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 space-y-4">
          <div className="flex items-center gap-3">
            <UserAvatar name={user.name} size="lg" />
            <div>
              <p className="font-medium">{user.name}</p>
              <Badge variant="secondary" className="mt-1 capitalize">
                {user.role === "admin" ? "Administrator" : "User"}
              </Badge>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-name">Name</Label>
            <Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-email">Email</Label>
            <Input id="profile-email" value={user.email} disabled />
            <p className="text-xs text-muted-foreground">Ask an administrator to change your email.</p>
          </div>
          <ErrorAlert message={error} />
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={saving || name.trim() === user.name}>
            {saving ? "Saving…" : "Save Profile"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

function PasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next !== confirm) {
      setError("New passwords don't match");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await authService.changePassword({ currentPassword: current, newPassword: next });
      toast.success("Password changed");
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <form onSubmit={submit} className="flex h-full flex-col gap-4">
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>Use at least 6 characters.</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">Current password</Label>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              minLength={6}
              value={next}
              onChange={(e) => setNext(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              minLength={6}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </div>
          <ErrorAlert message={error} />
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? "Updating…" : "Update Password"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
