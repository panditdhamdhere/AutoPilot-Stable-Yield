import { z } from "zod";

import { mockVaults } from "@/lib/mock-vaults";
import { mockTestnetVaults } from "@/lib/mock-vaults-testnet";
import { isTestnetModeEnabled } from "@/lib/runtime-config";
import type { Vault } from "@/lib/types";

const vaultSchema = z.object({
  id: z.string(),
  name: z.string(),
  protocol: z.string(),
  chain: z.string(),
  chainId: z.number(),
  address: z.string(),
  symbol: z.string(),
  apy: z.number(),
  tvlUsd: z.number(),
  riskLevel: z.enum(["low", "medium", "high"]),
  withdrawalHours: z.number(),
  isTransactional: z.boolean(),
});

const vaultListSchema = z.array(vaultSchema);

const EARN_BASE_URL = process.env.LIFI_EARN_BASE_URL ?? "https://earn.li.fi";
const LIFI_API_KEY = process.env.LIFI_API_KEY;
const STABLE_ASSETS = new Set(["USDC", "USDT", "DAI", "USDE", "USDS", "SUSDE"]);
const MIN_REALISTIC_APY = 0.1;
const MAX_REALISTIC_APY = 35;

interface RawVault {
  id?: string;
  name?: string;
  protocol?: { name?: string };
  protocolName?: string;
  network?: string;
  chain?: { name?: string };
  chainId?: number | string;
  address?: string;
  asset?: { symbol?: string };
  symbol?: string;
  analytics?: {
    apy?: { total?: number | string };
    tvl?: { usd?: number | string };
  };
  apy?: number | string;
  tvlUsd?: number | string;
  tvl?: number | string;
  riskLevel?: Vault["riskLevel"];
  withdrawalHours?: number | string;
  isTransactional?: boolean;
}

function toRiskLevel(apyPct: number): Vault["riskLevel"] {
  if (apyPct >= 10) return "high";
  if (apyPct >= 7) return "medium";
  return "low";
}

function normalizeApyPercent(rawApy: number): number {
  if (!Number.isFinite(rawApy) || rawApy < 0) return 0;
  const asPercent = rawApy <= 1 ? rawApy * 100 : rawApy;
  return Number(Math.min(asPercent, 100).toFixed(2));
}

function normalizeApiVaults(data: unknown): Vault[] {
  const source: unknown[] = Array.isArray(data)
    ? data
    : Array.isArray((data as { data?: unknown[] })?.data)
      ? ((data as { data?: unknown[] }).data ?? [])
      : [];

  return source
    .map((itemRaw) => {
      const item = itemRaw as RawVault;
      const apyPercent = normalizeApyPercent(
        Number(item.analytics?.apy?.total ?? item.apy ?? 0),
      );
      return {
        id: item.id ?? `${item.chainId}-${item.address}`,
        name: item.name ?? `${item.protocol?.name ?? "Vault"} ${item.asset?.symbol ?? ""}`,
        protocol: item.protocol?.name ?? item.protocolName ?? "Unknown",
        chain: item.network ?? item.chain?.name ?? "Unknown",
        chainId: Number(item.chainId ?? 1),
        address: item.address ?? "",
        symbol: item.asset?.symbol ?? item.symbol ?? "USDC",
        apy: apyPercent,
        tvlUsd: Number(item.analytics?.tvl?.usd ?? item.tvlUsd ?? item.tvl ?? 0),
        riskLevel:
          item.riskLevel ??
          toRiskLevel(apyPercent),
        withdrawalHours: Number(item.withdrawalHours ?? 0),
        isTransactional: Boolean(item.isTransactional ?? true),
      };
    })
    .filter((item) => vaultSchema.safeParse(item).success);
}

export async function getVaults(): Promise<Vault[]> {
  if (isTestnetModeEnabled) {
    return mockTestnetVaults;
  }

  try {
    const params = new URLSearchParams({
      sortBy: "apy",
      limit: "25",
    });
    const response = await fetch(`${EARN_BASE_URL}/v1/earn/vaults?${params.toString()}`, {
      next: { revalidate: 180 },
      headers: LIFI_API_KEY ? { "x-lifi-api-key": LIFI_API_KEY } : undefined,
    });
    if (!response.ok) throw new Error("Failed to load Earn vaults");
    const raw = (await response.json()) as unknown;
    const normalized = normalizeApiVaults(raw);
    const transactional = normalized.filter((vault) => vault.isTransactional && vault.address);
    const realisticStableVaults = transactional.filter((vault) => {
      const symbol = vault.symbol.toUpperCase();
      return (
        STABLE_ASSETS.has(symbol) &&
        vault.apy >= MIN_REALISTIC_APY &&
        vault.apy <= MAX_REALISTIC_APY
      );
    });
    const result = vaultListSchema.safeParse(normalized);
    if (!result.success || result.data.length === 0) return mockVaults;
    if (realisticStableVaults.length > 0) return realisticStableVaults;
    if (transactional.length > 0) return transactional;
    return result.data;
  } catch {
    return mockVaults;
  }
}
