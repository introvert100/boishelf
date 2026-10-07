import { unzipSync } from "fflate";
import { ebookLimitBytes, ebookLimitMb } from "./upload-limits";

export type EpubChapter = { title: string; text: string };

function archivePath(base: string, relative: string) {
  let decoded = relative.split("#")[0];
  try { decoded = decodeURIComponent(decoded); } catch { /* Keep the original path. */ }
  const parts = [...base.split("/").filter(Boolean)];
  for (const segment of decoded.split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") parts.pop();
    else parts.push(segment);
  }
  return parts.join("/");
}

function xml(bytes: Uint8Array) {
  const document = new DOMParser().parseFromString(new TextDecoder().decode(bytes), "application/xml");
  if (document.querySelector("parsererror")) throw new Error("This EPUB has invalid package metadata.");
  return document;
}

export function inspectEpub(bytes: Uint8Array): EpubChapter[] {
  if (!bytes.length || bytes.length > ebookLimitBytes) throw new Error(`Choose an EPUB up to ${ebookLimitMb} MB.`);
  let total = 0;
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, { filter: (entry) => {
      if (!/\.(xhtml|html|htm|opf|xml)$/i.test(entry.name) || entry.originalSize > 2 * 1024 * 1024) return false;
      total += entry.originalSize;
      return total <= 16 * 1024 * 1024;
    } });
  } catch { throw new Error("This EPUB could not be read. Check the file and try again."); }
  const container = files["META-INF/container.xml"];
  if (!container) throw new Error("This EPUB does not include readable book contents.");
  const rootfile = xml(container).getElementsByTagNameNS("*", "rootfile")[0];
  const packagePath = rootfile?.getAttribute("full-path");
  if (!packagePath || !files[packagePath]) throw new Error("This EPUB does not include readable book contents.");
  const packageDoc = xml(files[packagePath]);
  const packageDir = packagePath.split("/").slice(0, -1).join("/");
  const manifest = new Map(Array.from(packageDoc.getElementsByTagNameNS("*", "item"))
    .map((item) => [item.getAttribute("id"), item.getAttribute("href")]));
  const chapters: EpubChapter[] = [];
  for (const item of Array.from(packageDoc.getElementsByTagNameNS("*", "itemref"))) {
    const href = manifest.get(item.getAttribute("idref"));
    if (!href || !/\.(xhtml|html|htm)(?:#|$)/i.test(href)) continue;
    const file = files[archivePath(packageDir, href)];
    if (!file) continue;
    const html = new DOMParser().parseFromString(new TextDecoder().decode(file), "text/html");
    html.querySelectorAll("script,style,noscript,nav,svg,form").forEach((node) => node.remove());
    const title = html.querySelector("h1,h2,h3,title")?.textContent?.trim() || `Chapter ${chapters.length + 1}`;
    const blocks = Array.from(html.body?.querySelectorAll("h1,h2,h3,h4,p,li,blockquote,pre") || []);
    const text = (blocks.length ? blocks.map((block) => block.textContent?.trim() || "").filter(Boolean).join("\n\n")
      : html.body?.textContent || "").trim();
    if (text) chapters.push({ title: title.slice(0, 140), text });
    if (chapters.length >= 100) break;
  }
  if (!chapters.length) throw new Error("No readable chapters were found in this EPUB.");
  return chapters;
}
