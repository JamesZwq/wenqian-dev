import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";
import { env } from "@/lib/env";

export function getDb() {
  return drizzle(env().DB, { schema });
}

export type Db = ReturnType<typeof getDb>;
