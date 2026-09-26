const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const supabaseEnv = () => {
  if (!supabaseUrl) throw new Error("Thiếu biến môi trường NEXT_PUBLIC_SUPABASE_URL");
  if (!supabasePublishableKey) {
    throw new Error("Thiếu biến môi trường NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  }

  return {
    url: supabaseUrl,
    publishableKey: supabasePublishableKey,
  };
};

export const siteUrl = () =>
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export const hasSupabaseEnv = () =>
  Boolean(supabaseUrl && supabasePublishableKey);
