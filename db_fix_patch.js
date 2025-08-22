#!/usr/bin/env node

// Patch script to fix db.ts in local installations
const fs = require('fs');
const path = require('path');

const dbFilePath = path.join(process.cwd(), 'server', 'db.ts');

if (!fs.existsSync(dbFilePath)) {
    console.log('❌ server/db.ts not found');
    process.exit(1);
}

const newDbContent = `import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
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
  // Use regular PostgreSQL configuration  
  pool = new PgPool({ connectionString: process.env.DATABASE_URL });
  db = pgDrizzle({ client: pool, schema });
}

export { pool, db };
`;

fs.writeFileSync(dbFilePath, newDbContent, 'utf8');
console.log('✅ Fixed server/db.ts for local installation');