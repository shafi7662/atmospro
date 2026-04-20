import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pwpgjpjpxkxvebrdqfol.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3cGdqcGpweGt4dmVicmRxZm9sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NDgyMzksImV4cCI6MjA4OTQyNDIzOX0.442-ItXDOZtx2XvbdYWUDMa5BRSut14XQ-drRFLw3II';

const supabase = createClient(supabaseUrl, supabaseKey);

const defaultProducts = [
  { name: 'AtmosPro Lite', price: 10, apy: 1.2, duration_days: 1, level: 1, description: 'Entry-level atmospheric monitoring node. Reliable and efficient for basic data processing.', image_url: 'https://images.unsplash.com/photo-1534088568595-a066f710b81f?q=80&w=400&auto=format&fit=crop' },
  { name: 'AtmosPro Core', price: 50, apy: 1.5, duration_days: 1, level: 2, description: 'Enhanced core processor for atmospheric data analysis with optimized yield.', image_url: 'https://images.unsplash.com/photo-1513002749550-c59d786b8e6c?q=80&w=400&auto=format&fit=crop' },
  { name: 'AtmosPro Stratos', price: 100, apy: 1.8, duration_days: 1, level: 3, description: 'High-altitude processing unit designed for stratospheric data validation.', image_url: 'https://images.unsplash.com/photo-1464802686167-b939a6910659?q=80&w=400&auto=format&fit=crop' },
  { name: 'AtmosPro Nimbus', price: 250, apy: 2.1, duration_days: 1, level: 4, description: 'Cloud-integrated computing node with high-speed atmospheric throughput.', image_url: 'https://images.unsplash.com/photo-1504608524841-42fe6f032b4b?q=80&w=400&auto=format&fit=crop' },
  { name: 'AtmosPro Cirrus', price: 500, apy: 2.5, duration_days: 1, level: 5, description: 'Elite atmospheric node providing superior processing power and stability.', image_url: 'https://images.unsplash.com/photo-1496450681664-3df8a8444a49?q=80&w=400&auto=format&fit=crop' },
  { name: 'AtmosPro Aurora', price: 1000, apy: 3.0, duration_days: 1, level: 6, description: 'Premium node inspired by the aurora, offering vibrant performance and rewards.', image_url: 'https://images.unsplash.com/photo-1537210249814-b9a10a161ae4?q=80&w=400&auto=format&fit=crop' },
  { name: 'AtmosPro Zenith', price: 2500, apy: 3.5, duration_days: 1, level: 7, description: 'Peak performance atmospheric station for large-scale data operations.', image_url: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?q=80&w=400&auto=format&fit=crop' },
  { name: 'AtmosPro Nebula', price: 5000, apy: 4.2, duration_days: 1, level: 8, description: 'Deep-space atmospheric processor for unmatched network contributions.', image_url: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?q=80&w=400&auto=format&fit=crop' },
  { name: 'AtmosPro Galaxy', price: 10000, apy: 5.0, duration_days: 1, level: 9, description: 'Massive atmospheric server array with galactic-scale processing capacity.', image_url: 'https://images.unsplash.com/photo-1465101162946-4377e57745c3?q=80&w=400&auto=format&fit=crop' },
  { name: 'AtmosPro Universal', price: 25000, apy: 6.5, duration_days: 1, level: 10, description: 'The ultimate atmospheric entity, transcending all hardware limits.', image_url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=400&auto=format&fit=crop' }
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

  console.log(`Successfully seeded ${defaultProducts.length} products.`);
}

seed();
