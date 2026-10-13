"use client";

import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { CategoryFormDialog } from "@/components/categories/category-form-dialog";
import { ExpenseFormDialog } from "@/components/expenses/expense-form-dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { categoryHref, homeFor, profileHref, ROUTES, voiceHref } from "@/constants/routes";
import { VOICE_RESULT_EVENT } from "@/data";
import { useAuth } from "@/hooks/use-auth";
import { categoriesService, expensesService, usersService } from "@/services";
import type { User, VoiceCommandResult, VoiceConfirmDeleteAction, VoiceEditAction, VoiceNavigateAction } from "@/types";

const REMOVERS = {
  category: categoriesService.remove,
  expense: expensesService.remove,
  user: usersService.remove,
};

function hrefFor(user: User, action: VoiceNavigateAction) {
  const withQuery = (path: string) => (action.q ? `${path}?q=${encodeURIComponent(action.q)}` : path);
  switch (action.page) {
    case "category":
      return withQuery(categoryHref(user, action.categoryId!));
    case "categories":
      return user.role === "admin" ? ROUTES.admin.categories : ROUTES.user.categories;
    case "expenses":
      return withQuery(ROUTES.admin.expenses);
    case "users":
      return withQuery(ROUTES.admin.users);
    case "settings":
      return profileHref(user);
    case "voice":
      return voiceHref(user);
    default:
      return homeFor(user);
  }
}

/** Carries out what a command from the Voice Entry page or the chat asks for: navigation, theme, edit forms and delete confirmations. */
export function VoiceAssistant({ user, onDataChanged }: { user: User; onDataChanged: () => void }) {
  const router = useRouter();
  const { logout } = useAuth();
  const { setTheme } = useTheme();
  const [confirming, setConfirming] = useState<VoiceConfirmDeleteAction | null>(null);
  const [editing, setEditing] = useState<VoiceEditAction | null>(null);

  const remove = useCallback(
    async (target: VoiceConfirmDeleteAction) => {
      await REMOVERS[target.target](target.id);
      toast.success(`${target.target[0].toUpperCase()}${target.target.slice(1)} deleted`);
      if (target.target === "category") {
        router.push(user.role === "admin" ? ROUTES.admin.categories : ROUTES.user.categories);
      }
      onDataChanged();
    },
    [router, user, onDataChanged],
  );

  const apply = useCallback(
    async (result: VoiceCommandResult) => {
      if (!result.quiet) (result.ok ? toast.success : toast.error)(result.message);
      if (result.changed) onDataChanged();

      const { action } = result;
      if (action.type === "navigate") router.push(hrefFor(user, action));
      else if (action.type === "back") router.back();
      else if (action.type === "theme") setTheme(action.theme);
      else if (action.type === "confirm-delete") setConfirming(action);
      else if (
        action.type === "edit-category" ||
        action.type === "edit-expense" ||
        action.type === "new-category" ||
        action.type === "new-expense"
      )
        setEditing(action);
      else if (action.type === "logout") {
        await logout();
        router.replace(ROUTES.login);
      }
    },
    [onDataChanged, router, user, setTheme, logout],
  );

  useEffect(() => {
    const onResult = (e: Event) => void apply((e as CustomEvent<VoiceCommandResult>).detail);
    window.addEventListener(VOICE_RESULT_EVENT, onResult);
    return () => window.removeEventListener(VOICE_RESULT_EVENT, onResult);
  }, [apply]);

  return (
    <>
      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(next) => !next && setConfirming(null)}
        title={confirming?.title ?? ""}
        description={confirming?.description}
        onConfirm={() => remove(confirming!)}
      />

      {editing?.type === "edit-category" && (
        <CategoryFormDialog
          open
          onOpenChange={(next) => !next && setEditing(null)}
          category={editing.category}
          onSaved={() => {
            setEditing(null);
            onDataChanged();
          }}
        />
      )}

      {editing?.type === "new-category" && (
        <CategoryFormDialog
          open
          onOpenChange={(next) => !next && setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onDataChanged();
          }}
        />
      )}

      {editing?.type === "new-expense" && (
        <ExpenseFormDialog
          open
          onOpenChange={(next) => !next && setEditing(null)}
          categoryId={editing.categoryId}
          categories={editing.categories}
          withReceipt
          onSaved={() => {
            setEditing(null);
            onDataChanged();
          }}
        />
      )}

      {editing?.type === "edit-expense" && (
        <ExpenseFormDialog
          open
          onOpenChange={(next) => !next && setEditing(null)}
          categoryId={editing.expense.categoryId}
          expense={editing.expense}
          onSaved={() => {
            setEditing(null);
            onDataChanged();
          }}
        />
      )}
    </>
  );
}
