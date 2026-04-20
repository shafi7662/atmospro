import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pwpgjpjpxkxvebrdqfol.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3cGdqcGpweGt4dmVicmRxZm9sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NDgyMzksImV4cCI6MjA4OTQyNDIzOX0.442-ItXDOZtx2XvbdYWUDMa5BRSut14XQ-drRFLw3II';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('products').select('*').limit(1);
  if (error) {
    console.error('Error fetching products:', error);
  } else {
    console.log('Existing columns:', data && data[0] ? Object.keys(data[0]) : 'No data');
  }
}

check();
