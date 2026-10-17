"use client";

import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useContext, useTransition, type ComponentProps, type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";

const Navigation = createContext<((href: string, scroll?: boolean) => void) | null>(null);

export function NavigationProvider({ children, label }: { children: ReactNode; label: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function navigate(href: string, scroll?: boolean) {
    startTransition(() => router.push(href, { scroll }));
  }
  return <Navigation.Provider value={navigate}>
    {pending && <div className="navigation-feedback" role="status" aria-live="polite">
      <div className="navigation-progress" aria-hidden="true" />
      <span><LoaderCircle size={18} aria-hidden="true" />{label}</span>
    </div>}
    {children}
  </Navigation.Provider>;
}

export default function Link({ href, onNavigate, scroll, replace, ...props }:
  Omit<ComponentProps<typeof NextLink>, "href"> & { href: string }) {
  const navigate = useContext(Navigation);
  return <NextLink {...props} href={href} scroll={scroll} replace={replace} onNavigate={(event) => {
    // Preserve custom navigation handlers and replace behavior. Next handles
    // external links, downloads, new tabs, and modified clicks itself.
    if (onNavigate || replace || !navigate) { onNavigate?.(event); return; }
    const target = new URL(href, window.location.href);
    if (target.origin !== window.location.origin ||
      (target.pathname === window.location.pathname && target.search === window.location.search)) return;
    event.preventDefault();
    navigate(href, scroll);
  }} />;
}

export function PageLoading({ label }: { label: string }) {
  return <div className="container page page-loading" role="status" aria-live="polite" aria-busy="true">
    <p><LoaderCircle size={24} aria-hidden="true" />{label}</p>
    <div className="loading-skeleton" aria-hidden="true"><span /><span /><span /></div>
  </div>;
}
