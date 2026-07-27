import 'dotenv/config';
import { createClient } from '@libsql/client';

const client = createClient({
  url: process.env.DATABASE_URL!,
  authToken: process.env.DATABASE_AUTH_TOKEN!,
});

async function testConnection() {
  try {
    console.log('Testing connection to:', process.env.DATABASE_URL);
    console.log('Token provided:', process.env.DATABASE_AUTH_TOKEN ? 'yes' : 'no');

    const result = await client.execute('SELECT 1 as test');
    console.log('✅ Connection successful!', result);
  } catch (error) {
    console.error('❌ Connection failed:', error);
  }
}

testConnection();
