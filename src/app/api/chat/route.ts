import OpenAI from "openai";
import { NextResponse } from "next/server";
import { z } from "zod";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

const requestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1),
      }),
    )
    .min(1)
    .max(12),
  context: z
    .object({
      mode: z.enum(["testnet", "mainnet"]).optional(),
      strategyProfile: z.enum(["safe", "balanced", "aggressive"]).optional(),
      expectedApy: z.number().optional(),
      selectedVault: z
        .object({
          name: z.string(),
          protocol: z.string(),
          chain: z.string(),
          apy: z.number(),
          riskLevel: z.enum(["low", "medium", "high"]),
        })
        .optional(),
      riskScore: z
        .object({
          value: z.number(),
          max: z.number(),
        })
        .optional(),
      rebalanceSuggestion: z
        .object({
          fromProtocol: z.string(),
          toProtocol: z.string(),
          apyDelta: z.number(),
          movePct: z.number(),
        })
        .optional(),
      txStatus: z.string().optional(),
    })
    .optional(),
});

export async function POST(request: Request) {
  if (!OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OpenAI API key is not configured." },
      { status: 400 },
    );
  }

  try {
    const json = (await request.json()) as unknown;
    const parsed = requestSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid chat payload." }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
    const context = parsed.data.context;
    const contextText = context
      ? [
          `Current app context:`,
          `- Mode: ${context.mode ?? "unknown"}`,
          `- Strategy profile: ${context.strategyProfile ?? "unknown"}`,
          `- Expected APY: ${context.expectedApy ?? "n/a"}%`,
          context.selectedVault
            ? `- Selected vault: ${context.selectedVault.name} (${context.selectedVault.protocol} on ${context.selectedVault.chain}, ${context.selectedVault.apy}% APY, ${context.selectedVault.riskLevel} risk)`
            : "- Selected vault: n/a",
          context.riskScore
            ? `- Risk score: ${context.riskScore.value}/${context.riskScore.max}`
            : "- Risk score: n/a",
          context.rebalanceSuggestion
            ? `- Rebalance suggestion: Move ${context.rebalanceSuggestion.movePct}% from ${context.rebalanceSuggestion.fromProtocol} to ${context.rebalanceSuggestion.toProtocol}, APY uplift ${context.rebalanceSuggestion.apyDelta}%`
            : "- Rebalance suggestion: n/a",
          `- Latest tx status: ${context.txStatus ?? "unknown"}`,
        ].join("\n")
      : "No runtime context provided.";

    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content:
            "You are the AutoPilot Stable Yield assistant. Help users understand vault selection, risk score, rebalancing, and deposit flow. Keep answers short and practical. Use the provided runtime context when available.",
        },
        {
          role: "system",
          content: contextText,
        },
        ...parsed.data.messages,
      ],
    });

    const answer =
      completion.choices[0]?.message?.content?.trim() ??
      "I could not generate a response right now.";

    return NextResponse.json({ answer });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to generate response.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
