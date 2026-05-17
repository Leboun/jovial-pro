declare module "@supabase/supabase-js" {
  interface SupabaseAuthClient {
    getUser(jwt?: string): Promise<{
      data: { user: { id: string } | null };
      error: unknown | null;
    }>;
  }
}
