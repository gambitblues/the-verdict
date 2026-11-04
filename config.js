/* THE VERDICT — public settings for login and the AI server.
 * Everything here is safe to publish: the Supabase anon key is public by design (row level security protects the
 * data), and the OpenAI key lives only in the Cloudflare Worker. Fill these in before testing the login build. */
window.VERDICT_CONFIG={
 supabaseUrl:'',        // https://<project>.supabase.co  (Supabase → Project Settings → API)
 supabaseAnonKey:'',    // anon public key
 apiBase:'',            // https://the-verdict-api.<account>.workers.dev
 p4SharedWorld:false,     // enable only in isolated P4 QA with migrated backend
 p4SharedDocket:false,    // server case reservation/acceptance preview; QA only
 p4FreeOrders:false,    // AI-interpreted open text orders; independent QA only
 p4CourtActions:false,   // sealed witness and evidence-order actions; QA only
 p4SharedVerdicts:false, // evidence-backed server verdict; QA only
 ai:true                // AI wording for witness answers, articles and judgments (falls back to the game's own text)
};
