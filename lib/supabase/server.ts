import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireSupabaseConfig } from "./config";

export async function createSupabaseServerClient() {
  const { url, publishableKey } = requireSupabaseConfig();
  const cookieStore = await cookies();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Server Components cannot write cookies; proxy.ts refreshes sessions.
        }
      },
    },
  });
}

export async function requireAuthenticatedSupabase() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error) throw new Error(`Could not verify the signed-in user: ${error.message}`);
  if (!data.user) throw new Error("Authentication is required.");

  return { supabase, user: data.user };
}
