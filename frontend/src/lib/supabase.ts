import { createClient } from '@supabase/supabase-js';

/**
 * Browser-side Supabase client, using the publishable (anon) key only —
 * safe to expose to the client, since Row Level Security policies on the
 * Supabase project (not this key) are what gate access.
 *
 * The app's normal data flow still goes through the NestJS backend
 * (see src/lib/api.ts); this client is for features that talk to Supabase
 * directly, such as Supabase Auth.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.warn(
    'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are not set; Supabase client calls from the frontend will fail.',
  );
}

export const supabase = createClient(
  supabaseUrl ?? '',
  supabaseAnonKey ?? '',
);
