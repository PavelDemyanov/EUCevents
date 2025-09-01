import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import { drizzle as neonDrizzle } from 'drizzle-orm/neon-serverless';
import { Pool as PgPool } from 'pg';
import { drizzle as pgDrizzle } from 'drizzle-orm/node-postgres';
import ws from "ws";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Check if we're using Neon (serverless) or regular PostgreSQL
const isNeonDatabase = process.env.DATABASE_URL.includes('neon.tech') || process.env.DATABASE_URL.includes('pooler.supabase');

let pool: any;
let db: any;

if (isNeonDatabase) {
  // Use Neon serverless configuration
  neonConfig.webSocketConstructor = ws;
  pool = new NeonPool({ connectionString: process.env.DATABASE_URL });
  db = neonDrizzle({ client: pool, schema });
} else {
  // Use regular PostgreSQL configuration - force only DATABASE_URL usage
  // Clear all PG* environment variables to prevent conflicts with DATABASE_URL
  const originalPgVars = {
    PGHOST: process.env.PGHOST,
    PGUSER: process.env.PGUSER, 
    PGDATABASE: process.env.PGDATABASE,
    PGPASSWORD: process.env.PGPASSWORD,
    PGPORT: process.env.PGPORT
  };
  
  // Temporarily clear PG* variables
  delete process.env.PGHOST;
  delete process.env.PGUSER;
  delete process.env.PGDATABASE;
  delete process.env.PGPASSWORD;
  delete process.env.PGPORT;
  
  pool = new PgPool({ 
    connectionString: process.env.DATABASE_URL
  });
  
  // Restore original environment variables (in case other code needs them)
  Object.assign(process.env, originalPgVars);
  
  db = pgDrizzle({ client: pool, schema });
}

export { pool, db };