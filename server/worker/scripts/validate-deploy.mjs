/* Prevent accidentally overwriting the live Cloudflare Worker with the
 * placeholder dashboard settings committed to GitHub.
 */
import fs from 'node:fs';
const toml=fs.readFileSync(new URL('../wrangler.toml',import.meta.url),'utf8');
const invalid=[
 /SUPABASE_URL\s*=\s*"https:\/\/YOUR-PROJECT\.supabase\.co"/,
 /SUPABASE_ANON_KEY\s*=\s*"YOUR-ANON-KEY"/,
 /ALLOWED_EMAILS\s*=\s*"player1@example\.com,player2@example\.com"/
];
if(invalid.some(x=>x.test(toml))){
 console.error('Deployment blocked: wrangler.toml contains placeholder Supabase/auth values. Preserve existing Cloudflare production vars and secrets before deploying.');
 process.exit(1);
}
console.log('Deployment configuration has no known placeholders (secrets and actual live access still require verification).');
