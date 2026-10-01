"use client";

import { LightbulbIcon, Trash2Icon } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { CategoryFormDialog } from "@/components/categories/category-form-dialog";
import { ExpenseFormDialog } from "@/components/expenses/expense-form-dialog";
import { CategoryIcon } from "@/components/shared/category-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DEFAULT_VOICE_LANGUAGE, VOICE_EXAMPLES, VOICE_MODES, type VoiceMode } from "@/data";
import { useAuth } from "@/hooks/use-auth";
import { useFetch } from "@/hooks/use-fetch";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { errorMessage, formatMoney } from "@/lib/format";
import { categoriesService, expensesService, voiceService } from "@/services";
import type { Category, CategoryImageResult, Expense, ReceiptReadResult } from "@/types";
import { CategoryImageReviewCard } from "./category-image-review-card";
import { ReceiptReviewCard } from "./receipt-review-card";
import { VoiceCategoryCard, type CategoryVoiceItem } from "./voice-category-card";
import { VoiceRecorder } from "./voice-recorder";
import { VoiceResultCard, type VoiceItem as ExpenseVoiceItem } from "./voice-result-card";

type Item = ExpenseVoiceItem | CategoryVoiceItem;

const listCategories = () => categoriesService.list();

const HINTS: Record<VoiceMode, { idle: string; placeholder: string; help: string }> = {
  expense: {
    idle: "Tap the mic and say your expense",
    placeholder: "Or type it: Food 500 lunch with team",
    help: "Say the category, the amount and what it was for. For example:",
  },
  category: {
    idle: "Tap the mic and say the new category",
    placeholder: "Or type it: Category food amount 20000",
    help: "Say the category name, an optional monthly budget and who can use it. For example:",
  },
};

/** Speak or type to add an expense, or (admins) to create a category. */
export function VoiceEntry() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { data: allCategories, reload: reloadCategories } = useFetch(listCategories);
  const categories = useMemo(() => (allCategories ?? []).filter((c) => c.canAddExpense), [allCategories]);

  const [mode, setMode] = useState<VoiceMode>("expense");
  const [language, setLanguage] = useState(DEFAULT_VOICE_LANGUAGE);
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [undoingId, setUndoingId] = useState<number | null>(null);
  const [completing, setCompleting] = useState<Item | null>(null);
  const [editing, setEditing] = useState<Item | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ReceiptReadResult | null>(null);
  const [categoryImage, setCategoryImage] = useState<CategoryImageResult | null>(null);
  const nextId = useRef(1);

  const updateItem = (id: number, patch: Partial<ExpenseVoiceItem> | Partial<CategoryVoiceItem>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? ({ ...it, ...patch } as Item) : it)));

  const addItem = (item: Item) => setItems((prev) => [item, ...prev].slice(0, 20));

  const submit = useCallback(
    async (transcript: string) => {
      setBusy(true);
      try {
        if (isAdmin && mode === "category") {
          const { parsed, category } = await voiceService.createCategory(transcript);
          addItem({ kind: "category", id: nextId.current++, parsed, category, status: category ? "saved" : "needs-review" });
          if (category) {
            toast.success(`Category “${category.name}” created`);
            reloadCategories();
          }
        } else {
          const { parsed, expense } = await voiceService.createExpense(transcript, receiptUrl);
          addItem({
            kind: "expense",
            id: nextId.current++,
            parsed,
            expense,
            status: expense ? "saved" : "needs-review",
            receiptUrl,
          });
          setReceiptUrl(null);
          if (expense) toast.success(`${formatMoney(expense.amount)} added to ${expense.category.name}`);
        }
      } catch (err) {
        toast.error(errorMessage(err));
      } finally {
        setBusy(false);
      }
    },
    [isAdmin, mode, reloadCategories, receiptUrl],
  );

  const speech = useSpeechRecognition(submit);

  async function readReceipt(url: string) {
    setBusy(true);
    setReceipt(null);
    try {
      setReceipt(await voiceService.readReceipt(url));
      setReceiptUrl(null);
    } catch (err) {
      setReceiptUrl(url);
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function receiptAdded(expenses: Expense[]) {
    for (const expense of expenses) {
      addItem({
        kind: "expense",
        id: nextId.current++,
        status: "saved",
        expense,
        parsed: {
          transcript: expense.title,
          category: expense.category,
          alternatives: [],
          amount: expense.amount,
          title: expense.title,
          date: expense.date,
          missing: [],
        },
      });
    }
    setReceipt(null);
  }

  async function readCategoryImage(url: string) {
    setBusy(true);
    setCategoryImage(null);
    try {
      setCategoryImage(await voiceService.readCategoryImage(url));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function categoriesCreated(created: Category[]) {
    for (const category of created) {
      addItem({
        kind: "category",
        id: nextId.current++,
        status: "saved",
        category,
        parsed: {
          transcript: category.name,
          name: category.name,
          budget: category.budgetLimit,
          icon: category.icon ?? "folder",
          color: category.color ?? "slate",
          users: [],
          duplicate: null,
          missing: [],
        },
      });
    }
    reloadCategories();
  }

  async function undo(item: Item) {
    setUndoingId(item.id);
    try {
      if (item.kind === "expense" && item.expense) {
        await expensesService.remove(item.expense.id);
        toast.success("Expense removed");
      } else if (item.kind === "category" && item.category) {
        await categoriesService.remove(item.category.id);
        toast.success("Category removed");
        reloadCategories();
      }
      updateItem(item.id, { status: "undone" });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setUndoingId(null);
    }
  }

  const expenseSaved = (item: Item, expense: Expense) => updateItem(item.id, { expense, status: "saved" });
  const categorySaved = (item: Item, category: Category) => {
    updateItem(item.id, { category, status: "saved" });
    reloadCategories();
  };
  const dismiss = (item: Item) => setItems((prev) => prev.filter((it) => it.id !== item.id));

  const activeMode: VoiceMode = isAdmin ? mode : "expense";
  const hints = HINTS[activeMode];

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[1fr_20rem]">
      <div className="space-y-4">
        {isAdmin && (
          <Tabs value={mode} onValueChange={(v) => setMode(v as VoiceMode)}>
            <TabsList>
              {VOICE_MODES.map((m) => (
                <TabsTrigger key={m.value} value={m.value} disabled={speech.listening || busy}>
                  {m.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}

        <VoiceRecorder
          supported={speech.supported}
          listening={speech.listening}
          interim={speech.interim}
          error={speech.error}
          busy={busy}
          language={language}
          onLanguageChange={setLanguage}
          onStart={() => speech.start(language)}
          onStop={speech.stop}
          onSubmitText={submit}
          idleHint={hints.idle}
          placeholder={hints.placeholder}
          receiptUrl={activeMode === "expense" ? receiptUrl : null}
          onReceiptChange={
            activeMode === "expense"
              ? (url) => (url ? readReceipt(url) : setReceiptUrl(null))
              : (url) => url && readCategoryImage(url)
          }
          showTextInput={activeMode === "category"}
          uploadLabel={activeMode === "expense" ? "Or upload a receipt image" : "Or upload an image of categories"}
        />

        {receipt && activeMode === "expense" && (
          <ReceiptReviewCard
            key={receipt.receiptUrl}
            result={receipt}
            categories={categories}
            onAdded={receiptAdded}
            onDiscard={() => setReceipt(null)}
          />
        )}

        {categoryImage && activeMode === "category" && (
          <CategoryImageReviewCard
            result={categoryImage}
            onCreated={(created, finished) => {
              categoriesCreated(created);
              if (finished) setCategoryImage(null);
            }}
            onDiscard={() => setCategoryImage(null)}
          />
        )}

        {items.length > 0 && (
          <section className="space-y-3" aria-label="Voice entries">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground">This session</h2>
              <Button variant="ghost" size="sm" onClick={() => setItems([])}>
                <Trash2Icon /> Clear list
              </Button>
            </div>
            {items.map((item) =>
              item.kind === "category" ? (
                <VoiceCategoryCard
                  key={item.id}
                  item={item}
                  busy={undoingId === item.id}
                  onUndo={() => undo(item)}
                  onEdit={() => setEditing(item)}
                  onComplete={() => setCompleting(item)}
                  onDismiss={() => dismiss(item)}
                />
              ) : (
                <VoiceResultCard
                  key={item.id}
                  item={item}
                  busy={undoingId === item.id}
                  onUndo={() => undo(item)}
                  onEdit={() => setEditing(item)}
                  onComplete={() => setCompleting(item)}
                  onDismiss={() => dismiss(item)}
                />
              ),
            )}
          </section>
        )}
      </div>

      <Card className="xl:sticky xl:top-20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <LightbulbIcon className="size-4 text-primary" /> How to speak
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-muted-foreground">{hints.help}</p>
          <ul className="space-y-1.5">
            {VOICE_EXAMPLES[activeMode].map((ex) => (
              <li key={ex} className="rounded-md bg-muted px-2.5 py-1.5 font-medium">
                “{ex}”
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground">
            Amounts like <b>500</b>, <b>2.5k</b>, <b>five hundred</b> or <b>2 hazar</b> work.
            {activeMode === "expense" ? (
              <>
                {" "}
                Say <b>yesterday</b> or <b>kal</b> for a past date.
              </>
            ) : (
              <> The icon and color are picked for you — change them anytime with Edit.</>
            )}
          </p>
          <div className="space-y-2">
            <p className="font-medium">{activeMode === "expense" ? "Your categories" : "Existing categories"}</p>
            {(activeMode === "expense" ? categories : (allCategories ?? [])).length ? (
              <div className="flex flex-wrap gap-1.5">
                {(activeMode === "expense" ? categories : (allCategories ?? [])).map((c) => (
                  <Badge key={c.id} variant="secondary" className="gap-1">
                    <CategoryIcon icon={c.icon} className="size-3" /> {c.name}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">
                {activeMode === "expense" ? "No categories you can add expenses to yet." : "No categories yet."}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {completing?.kind === "expense" && categories.length > 0 && (
        <ExpenseFormDialog
          open
          onOpenChange={(open) => !open && setCompleting(null)}
          categoryId={completing.parsed.category?.id ?? categories[0].id}
          categories={categories}
          withReceipt
          defaults={{
            title: completing.parsed.title,
            amount: completing.parsed.amount,
            date: completing.parsed.date,
            note: `Voice: "${completing.parsed.transcript}"`,
            receiptUrl: completing.receiptUrl,
          }}
          onSaved={(expense) => {
            expenseSaved(completing, expense);
            setCompleting(null);
          }}
        />
      )}

      {completing?.kind === "category" && (
        <CategoryFormDialog
          open
          onOpenChange={(open) => !open && setCompleting(null)}
          defaults={{
            name: completing.parsed.name,
            icon: completing.parsed.icon,
            color: completing.parsed.color,
            budgetLimit: completing.parsed.budget,
            assignedUserIds: completing.parsed.users.map((u) => u.id),
          }}
          onSaved={(category) => {
            categorySaved(completing, category);
            setCompleting(null);
          }}
        />
      )}

      {editing?.kind === "expense" && editing.expense && (
        <ExpenseFormDialog
          open
          onOpenChange={(open) => !open && setEditing(null)}
          categoryId={editing.expense.categoryId}
          expense={editing.expense}
          onSaved={(expense) => {
            expenseSaved(editing, expense);
            setEditing(null);
          }}
        />
      )}

      {editing?.kind === "category" && editing.category && (
        <CategoryFormDialog
          open
          onOpenChange={(open) => !open && setEditing(null)}
          category={editing.category}
          onSaved={(category) => {
            categorySaved(editing, category);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
