import { NextResponse } from "next/server";
import { z } from "zod";

import { isTestnetModeEnabled } from "@/lib/runtime-config";

const LI_QUEST_BASE_URL = process.env.LIFI_COMPOSER_BASE_URL ?? "https://li.quest";
const LIFI_API_KEY = process.env.LIFI_API_KEY;
const LIFI_INTEGRATOR = process.env.LIFI_INTEGRATOR ?? "defi-mullet-autopilot";

const quoteInputSchema = z.object({
  fromChain: z.number().int().positive(),
  toChain: z.number().int().positive(),
  fromToken: z.string().min(1),
  toToken: z.string().min(1),
  fromAmount: z.string().min(1),
  fromAddress: z.string().min(1),
  toAddress: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    if (isTestnetModeEnabled) {
      return NextResponse.json(
        {
          error:
            "Composer vault deposits are disabled in testnet demo mode. Send a demo transaction from the UI instead.",
        },
        { status: 400 },
      );
    }

    const json = (await request.json()) as unknown;
    const parsed = quoteInputSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid quote payload" }, { status: 400 });
    }

    const params = new URLSearchParams({
      fromChain: String(parsed.data.fromChain),
      toChain: String(parsed.data.toChain),
      fromToken: parsed.data.fromToken,
      toToken: parsed.data.toToken,
      fromAmount: parsed.data.fromAmount,
      fromAddress: parsed.data.fromAddress,
      toAddress: parsed.data.toAddress,
      integrator: LIFI_INTEGRATOR,
      allowDestinationCall: "true",
    });

    const response = await fetch(`${LI_QUEST_BASE_URL}/v1/quote?${params.toString()}`, {
      headers: LIFI_API_KEY ? { "x-lifi-api-key": LIFI_API_KEY } : undefined,
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: "Failed to fetch quote", details: errorText },
        { status: response.status },
      );
    }

    const quote = (await response.json()) as unknown;
    return NextResponse.json(quote);
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
