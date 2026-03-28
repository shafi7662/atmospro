import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pwpgjpjpxkxvebrdqfol.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3cGdqcGpweGt4dmVicmRxZm9sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NDgyMzksImV4cCI6MjA4OTQyNDIzOX0.442-ItXDOZtx2XvbdYWUDMa5BRSut14XQ-drRFLw3II';

const supabase = createClient(supabaseUrl, supabaseKey);

const defaultProducts = [
  { name: 'Blue Plasma Core', price: 50, level: 1, image_url: 'https://picsum.photos/seed/plasma-blue/400' },
  { name: 'Pink Galaxy Reactor', price: 100, level: 2, image_url: 'https://picsum.photos/seed/galaxy-pink/400' },
  { name: 'Gold Fire Vault', price: 250, level: 3, image_url: 'https://picsum.photos/seed/fire-gold/400' },
  { name: 'Green Ice Chamber', price: 500, level: 4, image_url: 'https://picsum.photos/seed/ice-green/400' },
  { name: 'Purple Electric Cube', price: 1000, level: 5, image_url: 'https://picsum.photos/seed/electric-purple/400' },
  { name: 'White Plasma Reactor', price: 2000, level: 6, image_url: 'https://picsum.photos/seed/plasma-white/400' },
  { name: 'Blue Galaxy Vault', price: 3500, level: 7, image_url: 'https://picsum.photos/seed/galaxy-blue/400' },
  { name: 'Pink Fire Chamber', price: 5000, level: 8, image_url: 'https://picsum.photos/seed/fire-pink/400' },
  { name: 'Gold Ice Cube', price: 7500, level: 9, image_url: 'https://picsum.photos/seed/ice-gold/400' },
  { name: 'Green Electric Reactor', price: 10000, level: 10, image_url: 'https://picsum.photos/seed/electric-green/400' },
  { name: 'Purple Plasma Vault', price: 15000, level: 12, image_url: 'https://picsum.photos/seed/plasma-purple/400' },
  { name: 'White Galaxy Chamber', price: 20000, level: 15, image_url: 'https://picsum.photos/seed/galaxy-white/400' },
  { name: 'Blue Fire Cube', price: 25000, level: 18, image_url: 'https://picsum.photos/seed/fire-blue/400' },
  { name: 'Pink Ice Reactor', price: 30000, level: 22, image_url: 'https://picsum.photos/seed/ice-pink/400' },
  { name: 'Gold Electric Vault', price: 40000, level: 26, image_url: 'https://picsum.photos/seed/electric-gold/400' },
  { name: 'Green Plasma Chamber', price: 50000, level: 30, image_url: 'https://picsum.photos/seed/plasma-green/400' },
  { name: 'Purple Galaxy Cube', price: 60000, level: 35, image_url: 'https://picsum.photos/seed/galaxy-purple/400' },
  { name: 'White Fire Reactor', price: 75000, level: 42, image_url: 'https://picsum.photos/seed/fire-white/400' },
  { name: 'Blue Ice Vault', price: 90000, level: 50, image_url: 'https://picsum.photos/seed/ice-blue/400' },
  { name: 'Pink Electric Chamber', price: 100000, level: 60, image_url: 'https://picsum.photos/seed/electric-pink/400' }
];

async function seed() {
  console.log('Seeding products...');
  // Clear existing
  const { error: deleteError } = await supabase.from('products').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (deleteError) {
    console.error('Error deleting products:', deleteError);
    return;
  }

  const { error: insertError } = await supabase.from('products').insert(defaultProducts);
  if (insertError) {
    console.error('Error inserting products:', insertError);
    return;
  }

  console.log('Successfully seeded 20 products.');
}

seed();
