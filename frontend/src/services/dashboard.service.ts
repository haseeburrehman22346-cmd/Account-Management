import type { DashboardOverview } from "@/types";
import { apiClient } from "./api-client";

export const dashboardService = {
  overview: (months: number) => apiClient.get<DashboardOverview>("/dashboard/overview", { months }),
};
