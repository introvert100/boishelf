"use client";
import { useEffect } from "react";
import { CheckCircle2, X } from "lucide-react";
import { useLanguage } from "./store";

export type ToastMessage = { id: number; text: string } | null;
export function SuccessToast({ toast, onDismiss }: { toast: ToastMessage; onDismiss: () => void }) {
  const { t } = useLanguage();
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(onDismiss, 6000);
    return () => window.clearTimeout(timer);
  }, [toast, onDismiss]);
  if (!toast) return null;
  return <div className="success-toast" role="status" aria-live="polite">
    <CheckCircle2 size={20} aria-hidden="true" /><span>{toast.text}</span>
    <button type="button" className="icon-button" aria-label={t("বার্তা বন্ধ করুন", "Dismiss message")} onClick={onDismiss}><X size={16} /></button>
  </div>;
}
