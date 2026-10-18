"use client";

import { createBrowserClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const configured = Boolean(url && publishableKey && !url.includes("your-project") && !publishableKey.includes("your-"));

// Return no client until real local environment values are supplied.
export const supabase = configured ? createBrowserClient(url!, publishableKey!) : null;
