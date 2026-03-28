/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://pwpgjpjpxkxvebrdqfol.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3cGdqcGpweGt4dmVicmRxZm9sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NDgyMzksImV4cCI6MjA4OTQyNDIzOX0.442-ItXDOZtx2XvbdYWUDMa5BRSut14XQ-drRFLw3II';

export const supabase = createClient(supabaseUrl, supabaseKey);
