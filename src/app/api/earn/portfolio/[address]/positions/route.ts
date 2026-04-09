import { NextResponse } from "next/server";
import { z } from "zod";

import { isTestnetModeEnabled } from "@/lib/runtime-config";
import type { PortfolioPosition } from "@/lib/types";

const EARN_BASE_URL = process.env.LIFI_EARN_BASE_URL ?? "https://earn.li.fi";
const LIFI_API_KEY = process.env.LIFI_API_KEY;

const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/);

interface RawPortfolioPosition {
  chainId?: number | string;
  protocolName?: string;
  asset?: {
    address?: string;
    name?: string;
    symbol?: string;
    decimals?: number | string;
  };
  balanceUsd?: number | string;
  balanceNative?: string;
}

function normalizePosition(raw: RawPortfolioPosition): PortfolioPosition | null {
  if (!raw.asset?.address || !raw.asset.symbol) return null;
  return {
    chainId: Number(raw.chainId ?? 1),
    protocolName: raw.protocolName ?? "unknown",
    asset: {
      address: raw.asset.address,
      name: raw.asset.name ?? raw.asset.symbol,
      symbol: raw.asset.symbol,
      decimals: Number(raw.asset.decimals ?? 18),
    },
    balanceUsd: Number(raw.balanceUsd ?? 0),
    balanceNative: raw.balanceNative ?? "0",
  };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ address: string }> },
) {
  const { address } = await context.params;
  const validatedAddress = addressSchema.safeParse(address);
  if (!validatedAddress.success) {
    return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
  }

  if (isTestnetModeEnabled) {
    return NextResponse.json({
      positions: [],
      totalUsd: 0,
      note: "Portfolio API is mainnet-focused; testnet mode returns empty positions.",
    });
  }

  try {
    const response = await fetch(
      `${EARN_BASE_URL}/v1/earn/portfolio/${validatedAddress.data}/positions`,
      {
        headers: LIFI_API_KEY ? { "x-lifi-api-key": LIFI_API_KEY } : undefined,
        cache: "no-store",
      },
    );

    if (!response.ok) {
      const details = await response.text();
      return NextResponse.json(
        { error: "Failed to fetch portfolio positions", details },
        { status: response.status },
      );
    }

    const payload = (await response.json()) as { positions?: RawPortfolioPosition[] };
    const positions = (payload.positions ?? [])
      .map((position) => normalizePosition(position))
      .filter((position): position is PortfolioPosition => Boolean(position));

    return NextResponse.json({
      positions,
      totalUsd: Number(positions.reduce((sum, position) => sum + position.balanceUsd, 0).toFixed(2)),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unexpected server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
