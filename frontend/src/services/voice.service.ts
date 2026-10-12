import type {
  CategoryImageResult,
  ReceiptReadResult,
  VoiceCategoryResult,
  VoiceCommandResult,
  VoiceExpenseResult,
  VoiceParseResult,
} from "@/types";
import { apiClient } from "./api-client";

export const voiceService = {
  parse: (transcript: string) => apiClient.post<VoiceParseResult>("/voice/parse", { transcript }),
  createExpense: (transcript: string, receiptUrl: string | null = null) =>
    apiClient.post<VoiceExpenseResult>("/voice/expense", { transcript, receiptUrl }),
  readReceipt: (receiptUrl: string) =>
    apiClient.post<ReceiptReadResult>("/voice/receipt", { receiptUrl }),
  readCategoryImage: (receiptUrl: string) =>
    apiClient.post<CategoryImageResult>("/voice/category-image", { receiptUrl }),
  createCategory: (transcript: string) => apiClient.post<VoiceCategoryResult>("/voice/category", { transcript }),
  command: (transcript: string, mode?: "expense" | "category") =>
    apiClient.post<VoiceCommandResult>("/voice/command", { transcript, mode }),
};
