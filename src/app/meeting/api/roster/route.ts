export const runtime = "edge";

import { NextResponse } from "next/server";
import {
  fetchSheetCsv,
  parseCsvToTable,
} from "@/lib/meeting/sheets";

function env(name: string, fallback?: string) {
  const v = process.env[name] ?? fallback;
  if (v == null || v === "") throw new Error(`Missing env: ${name}`);
  return v;
}

export async function GET() {
  const sheetId = env("SHEET_ID");
  const gid = env("SHEET_GID");
  const revalidateSeconds =
    Number(process.env.SHEET_REVALIDATE_SECONDS ?? "60") || 60;

  const { csvText, url, notes: fetchNotes } =
    await fetchSheetCsv({ sheetId, gid, revalidateSeconds });
  const { headers, rows, notes: parseNotes } =
    parseCsvToTable(csvText);

  return NextResponse.json(
    {
      headers,
      rows,
      fetchedAtIso: new Date().toISOString(),
      source: { sheetId, gid, url },
      notes: [...fetchNotes, ...parseNotes],
    },
    { status: 200 },
  );
}

