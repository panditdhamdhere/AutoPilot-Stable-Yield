import { NextResponse } from "next/server";

import { getVaults } from "@/lib/lifi";

export async function GET() {
  const vaults = await getVaults();
  return NextResponse.json({ data: vaults, total: vaults.length });
}
