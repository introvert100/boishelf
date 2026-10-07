export function pdfFrameSources(supabaseUrl?: string) {
  const origins = new Set(["https://challenges.cloudflare.com"]);
  if (supabaseUrl) {
    const project = new URL(supabaseUrl);
    origins.add(project.origin);
    if (project.hostname.endsWith(".supabase.co") && !project.hostname.endsWith(".storage.supabase.co")) {
      project.hostname = project.hostname.replace(/\.supabase\.co$/, ".storage.supabase.co");
      origins.add(project.origin);
    }
  }
  return Array.from(origins).join(" ");
}
