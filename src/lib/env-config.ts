// Persistent configuration file that won't be overwritten by system env vars
// This file stores credentials that the system might override in .env

export const envConfig = {
  // Supabase Configuration
  NEXT_PUBLIC_SUPABASE_URL: "https://fddwplujylgfosenajnu.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZkZHdwbHVqeWxnZm9zZW5ham51Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1ODMxNDIsImV4cCI6MjA4ODE1OTE0Mn0.A84IWE9K15_H_NLFDfaLyy67iXk342lnwYB-mdAT4HY",
  
  // Database URLs
  DATABASE_URL: "postgresql://postgres.fddwplujylgfosenajnu:Jp9848048293Rg@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true",
  DIRECT_URL: "postgresql://postgres.fddwplujylgfosenajnu:Jp9848048293Rg@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres",
  
  // Mistral API Key
  MISTRAL_API_KEY: "9tWzQBXD0jYxWkfaMGvLs0fXFMXAQ2d0",
  
  // Service Role Key
  SUPABASE_SERVICE_ROLE_KEY: "sb_secret_208x4zUxG2TlZaS3XpgaWA_s4BkRXX8",
};

// Set environment variables at module load time
if (typeof process !== 'undefined') {
  // Only override if not already set correctly
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL === 'undefined') {
    process.env.NEXT_PUBLIC_SUPABASE_URL = envConfig.NEXT_PUBLIC_SUPABASE_URL;
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY === 'undefined') {
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = envConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  }
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith('file:')) {
    process.env.DATABASE_URL = envConfig.DATABASE_URL;
  }
  if (!process.env.DIRECT_URL) {
    process.env.DIRECT_URL = envConfig.DIRECT_URL;
  }
  if (!process.env.MISTRAL_API_KEY) {
    process.env.MISTRAL_API_KEY = envConfig.MISTRAL_API_KEY;
  }
}
