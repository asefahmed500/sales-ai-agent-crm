import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/salesgenius?schema=public';

async function run() {
  console.log('Connecting to database:', connectionString);
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    console.log('Enabling vector extension...');
    await client.query('CREATE EXTENSION IF NOT EXISTS vector;');
    console.log('✓ Vector extension enabled successfully!');
  } catch (err) {
    console.error('✗ Failed to enable vector extension:', err.message);
  } finally {
    await client.end();
  }
}

run();
