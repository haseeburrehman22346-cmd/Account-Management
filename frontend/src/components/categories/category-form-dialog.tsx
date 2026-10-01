"use client";

import { CheckIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { CategoryAvatar } from "@/components/shared/category-avatar";
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
import { Textarea } from "@/components/ui/textarea";
import {
  CATEGORY_COLORS,
  CATEGORY_ICONS,
  CATEGORY_STATUS_OPTIONS,
  DEFAULT_CATEGORY_COLOR,
  DEFAULT_CATEGORY_ICON,
} from "@/data";
import { useFetch } from "@/hooks/use-fetch";
import { errorMessage } from "@/lib/format";
import { cn } from "@/lib/utils";
import { categoriesService, usersService } from "@/services";
import type { Category, CategoryStatus } from "@/types";

/** Add (no `category`) or edit a category. */
export interface CategoryFormDefaults {
  name?: string;
  icon?: string | null;
  color?: string | null;
  budgetLimit?: number | null;
  assignedUserIds?: string[];
}

export function CategoryFormDialog({
  open,
  onOpenChange,
  category,
  defaults,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: Category;
  /** Pre-filled values for a new category, e.g. from voice entry. */
  defaults?: CategoryFormDefaults;
  onSaved: (category: Category) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{category ? "Edit Category" : "Add Category"}</DialogTitle>
          <DialogDescription>
            {category ? "Update details, status or who can access it." : "Create a category and choose who can use it."}
          </DialogDescription>
        </DialogHeader>
        <CategoryForm category={category} defaults={defaults} onCancel={() => onOpenChange(false)} onSaved={onSaved} />
      </DialogContent>
    </Dialog>
  );
}

const listUsers = () => usersService.list();

function CategoryForm({
  category,
  defaults,
  onCancel,
  onSaved,
}: {
  category?: Category;
  defaults?: CategoryFormDefaults;
  onCancel: () => void;
  onSaved: (category: Category) => void;
}) {
  const { data: users } = useFetch(listUsers);
  const [name, setName] = useState(category?.name ?? defaults?.name ?? "");
  const [description, setDescription] = useState(category?.description ?? "");
  const [icon, setIcon] = useState(category?.icon ?? defaults?.icon ?? DEFAULT_CATEGORY_ICON);
  const [color, setColor] = useState(category?.color ?? defaults?.color ?? DEFAULT_CATEGORY_COLOR);
  const [budget, setBudget] = useState(category?.budgetLimit?.toString() ?? defaults?.budgetLimit?.toString() ?? "");
  const [status, setStatus] = useState<CategoryStatus>(category?.status ?? "active");
  const [assigned, setAssigned] = useState<string[]>(category?.assignedUsers.map((u) => u.id) ?? defaults?.assignedUserIds ?? []);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const input = {
      name,
      description,
      icon,
      color,
      status,
      budgetLimit: budget === "" ? null : Number(budget),
      assignedUserIds: assigned,
    };
    try {
      const saved = category
        ? await categoriesService.update(category.id, input)
        : await categoriesService.create(input);
      toast.success(category ? "Category updated" : "Category created");
      onSaved(saved);
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="flex items-start gap-4">
        <CategoryAvatar icon={icon} color={color} size="lg" />
        <div className="flex-1 space-y-2">
          <Label htmlFor="category-name">Name</Label>
          <Input id="category-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Food" required autoFocus />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="category-description">Description</Label>
        <Textarea
          id="category-description"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Meals, groceries, dining"
        />
      </div>

      <div className="space-y-2">
        <Label>Icon</Label>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Icon">
          {CATEGORY_ICONS.map(({ key, label, icon: Icon }) => (
            <button
              type="button"
              key={key}
              role="radio"
              aria-checked={icon === key}
              aria-label={label}
              title={label}
              onClick={() => setIcon(key)}
              className={cn(
                "flex size-9 items-center justify-center rounded-md border bg-background text-muted-foreground transition hover:text-foreground",
                icon === key && "border-primary bg-accent text-accent-foreground ring-2 ring-primary/30",
              )}
            >
              <Icon className="size-4" />
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Color</Label>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Color">
          {CATEGORY_COLORS.map((c) => (
            <button
              type="button"
              key={c.key}
              role="radio"
              aria-checked={color === c.key}
              aria-label={c.label}
              title={c.label}
              onClick={() => setColor(c.key)}
              className={cn(
                "flex size-7 items-center justify-center rounded-full text-white ring-offset-2 ring-offset-background transition",
                color === c.key && "ring-2 ring-foreground/60",
              )}
              style={{ backgroundColor: c.value }}
            >
              {color === c.key && <CheckIcon className="size-3.5" />}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="category-budget">Monthly budget (optional)</Label>
          <Input
            id="category-budget"
            type="number"
            min="0"
            step="0.01"
            placeholder="No limit"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="category-status">Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as CategoryStatus)}>
            <SelectTrigger id="category-status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORY_STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="category-users">Assign to users</Label>
        <MultiSelect
          id="category-users"
          options={(users ?? []).map((u) => ({
            value: u.id,
            label: u.name,
            description: `${u.email}${u.role === "admin" ? " · admin" : ""}${u.active ? "" : " · inactive"}`,
          }))}
          value={assigned}
          onChange={setAssigned}
          placeholder="Select users"
          searchPlaceholder="Search users…"
          emptyText="No users found."
        />
      </div>

      <ErrorAlert message={error} />

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : category ? "Save Changes" : "Create Category"}
        </Button>
      </DialogFooter>
    </form>
  );
}
