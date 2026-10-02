import "server-only";
import { cache } from "react";
import { sessionClient } from "./supabase";
import { isGmailUser } from "./security";
import { ownerEmail } from "./config";
import { AppError } from "./http";
export const currentUser = cache(async () => {
  const client = await sessionClient();
  if (!client) return null;
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !isGmailUser(user)) return null;
  return user;
});
export async function requireUser() {
  const user = await currentUser();
  if (!user)
    throw new AppError(401, "Please sign in with a verified Gmail account.");
  return user;
}
export function isOwner(email?: string) {
  return !!ownerEmail() && email?.toLowerCase() === ownerEmail();
}
export async function requireOwner() {
  const user = await requireUser();
  if (!isOwner(user.email))
    throw new AppError(403, "This area is only available to the store owner.");
  return user;
}
export async function viewer() {
  const user = await currentUser();
  return user
    ? {
        email: user.email!,
        name: user.user_metadata?.name || user.email!.split("@")[0],
        admin: isOwner(user.email),
      }
    : null;
}
