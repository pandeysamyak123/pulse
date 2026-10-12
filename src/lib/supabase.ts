import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let admin: SupabaseClient | null = null;
let reader: SupabaseClient | null = null;

/** Service-role client. Server-only: pipeline + passcode-protected write routes. */
export function supabaseAdmin(): SupabaseClient {
  if (typeof window !== "undefined") throw new Error("supabaseAdmin() is server-only");
  if (!admin) {
    admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );
  }
  return admin;
}

/** Anon client: read-only by RLS policy. Safe for server components and the browser. */
export function supabaseReader(): SupabaseClient {
  if (!reader) {
    reader = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } },
    );
  }
  return reader;
}

/** Throw on a Supabase error, return data otherwise. */
export function must<T>(res: { data: T; error: { message: string } | null }, ctx = ""): T {
  if (res.error) throw new Error(`${ctx ? ctx + ": " : ""}${res.error.message}`);
  return res.data;
}
