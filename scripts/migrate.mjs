// Aplica as migrações do Drizzle (usado na subida do container).
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não definida');
const client = postgres(process.env.DATABASE_URL, { max: 1 });
await migrate(drizzle(client), { migrationsFolder: './db/migrations' });
await client.end();
console.log('Migrações aplicadas');
