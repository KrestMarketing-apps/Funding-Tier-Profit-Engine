import { neon } from "@neondatabase/serverless";

/**
 * Read-only access to the closer pay tables the Profit Engine maintains.
 *
 * Agent Tools never computes pay — it only shows ao_closer_pay (rebuilt by the
 * Profit Engine after every sync, import and payment) and the payments
 * recorded in ao_pay_runs. Same Neon database, same DATABASE_URL.
 */
export async function payQuery<T = any>(text: string, params: any[] = []): Promise<T[]> {
  const cs = (process.env.DATABASE_URL || process.env.POSTGRES_URL || "").trim();
  if (!cs) throw new Error("DATABASE_URL is not set for Agent Tools.");
  const sql = neon(cs);
  return (await sql(text, params)) as unknown as T[];
}
