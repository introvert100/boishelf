"use client";
import { PageLoading } from "@/components/navigation";
import { useLanguage } from "@/components/store";

export default function Loading() {
  const { t } = useLanguage();
  return <PageLoading label={t("পাতা লোড হচ্ছে…", "Loading page…")} />;
}
