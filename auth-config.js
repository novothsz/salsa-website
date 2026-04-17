window.SALSA_AUTH_CONFIG = {
  // Set to true after filling Supabase values below.
  enabled: false,

  // Example: https://your-project-ref.supabase.co
  supabaseUrl: '',

  // Supabase public anon key (safe to expose in frontend, unlike service role key).
  supabaseAnonKey: '',

  // Approval lookup table and columns.
  // The authenticated user should be able to read only their own row via RLS.
  profileTable: 'profiles',
  userIdColumn: 'user_id',
  approvalColumn: 'approved',

  // Optional column. Keep empty if not used.
  rejectedColumn: ''
};
