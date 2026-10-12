// Wipe SYSTEM data (articles, signals, drafts, scores, runs) — Arjun's data is untouched.
import { config } from "dotenv";
config({ path: ".env.local" });
import { supabaseAdmin, must } from "../src/lib/supabase";
(async () => {
  const db = supabaseAdmin();
  const before = must(await db.rpc("arjun_data_hash"), "hash");
  must(await db.rpc("reset_system_data"), "reset");
  const after = must(await db.rpc("arjun_data_hash"), "hash");
  console.log(`System data reset. Arjun hash ${before} → ${after} ${before === after ? "✓ unchanged" : "✗ CHANGED"}`);
})();
