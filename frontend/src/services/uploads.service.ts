import { apiClient } from "./api-client";

export const uploadsService = {
  receipt: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return apiClient.upload<{ url: string }>("/uploads/receipts", form);
  },
};
