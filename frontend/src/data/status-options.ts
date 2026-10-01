import type { CategoryStatus } from "@/types";

export const CATEGORY_STATUS_OPTIONS: { value: CategoryStatus; label: string; description: string }[] = [
  { value: "active", label: "Active", description: "Assigned users can add expenses" },
  { value: "inactive", label: "Inactive", description: "Visible, but no new expenses from users" },
];

export const CHART_RANGE_OPTIONS = [
  { value: 3, label: "Last 3 Months" },
  { value: 6, label: "Last 6 Months" },
  { value: 12, label: "Last 12 Months" },
] as const;
