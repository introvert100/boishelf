export function signedResumableEndpoint(projectUrl: string) {
  const origin = new URL(projectUrl);
  if (origin.hostname.endsWith(".supabase.co") && !origin.hostname.endsWith(".storage.supabase.co"))
    origin.hostname = origin.hostname.replace(/\.supabase\.co$/, ".storage.supabase.co");
  return `${origin.origin}/storage/v1/upload/resumable/sign`;
}

export function signedUploadHeaders(publishableKey: string, token: string) {
  return { apikey: publishableKey, "x-signature": token };
}
