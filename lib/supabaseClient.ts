import { createClient } from '@supabase/supabase-js';

// Estos valores los obtienes en tu proyecto de Supabase:
//  Project Settings > API
const supabaseUrl = 'https://vfnylgkhtbqpgxkgldnj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmbnlsZ2todGJxcGd4a2dsZG5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAxNzEzMDAsImV4cCI6MjA1NTc0NzMwMH0.WiEFxY5cbFXq2z_DBuloaihXceRGO7zi9t97bP5Mk4U';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
