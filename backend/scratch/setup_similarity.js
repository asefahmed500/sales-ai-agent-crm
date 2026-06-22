import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:asef@localhost:5432/salesgenius?schema=public';

const createFunctionSql = `
CREATE OR REPLACE FUNCTION cosine_similarity(a double precision[], b double precision[])
RETURNS double precision AS $$
DECLARE
  dot_product double precision := 0;
  norm_a double precision := 0;
  norm_b double precision := 0;
  i integer;
BEGIN
  IF array_length(a, 1) <> array_length(b, 1) THEN
    RAISE EXCEPTION 'Arrays must be of the same length (a: %, b: %)', array_length(a, 1), array_length(b, 1);
  END IF;
  FOR i IN 1..array_length(a, 1) LOOP
    dot_product := dot_product + a[i] * b[i];
    norm_a := norm_a + a[i] * a[i];
    norm_b := norm_b + b[i] * b[i];
  END LOOP;
  IF norm_a = 0 OR norm_b = 0 THEN
    RETURN 0;
  END IF;
  RETURN dot_product / (sqrt(norm_a) * sqrt(norm_b));
END;
$$ LANGUAGE plpgsql IMMUTABLE;
`;

async function run() {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    console.log('Creating cosine_similarity function in PostgreSQL...');
    await client.query(createFunctionSql);
    console.log('✓ cosine_similarity function created successfully!');
  } catch (err) {
    console.error('✗ Failed to create function:', err.message);
  } finally {
    await client.end();
  }
}

run();
