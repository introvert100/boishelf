import { notFound } from "next/navigation";
import { getBundle } from "@/lib/bundles";
import { viewer } from "@/lib/auth";
import { readiness } from "@/lib/readiness";
import { BundleDetail } from "@/components/commerce";
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const bundle = await getBundle((await params).slug);
  return { title: bundle?.title_en || "Bundle not found" };
}
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const bundle = await getBundle((await params).slug);
  if (!bundle) notFound();
  const available = bundle.kind === "ebook" ? (await readiness()).ready : true;
  return <BundleDetail bundle={bundle} viewer={await viewer()} ebookReady={available} />;
}
