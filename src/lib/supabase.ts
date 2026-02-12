import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://gbdcwxrnemirswlecwwh.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdiZGN3eHJuZW1pcnN3bGVjd3doIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3NjQwOTMsImV4cCI6MjA4NjM0MDA5M30._8mCZEhuI4Cm4wHmfc4wzSDmcd3Gtu0n7Niu_QT_yOg';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
