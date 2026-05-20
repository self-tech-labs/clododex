import { NextResponse } from "next/server";

import BattleConfig from "../../../../data/arena/battle.json";
import { resolveLlmBattleTurn } from "../../../../src/arena/battle/litellm.mjs";

export const runtime = "nodejs";

const bearerToken = (request) => {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
};

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body?.battle) {
    return NextResponse.json({ error: "Missing battle state" }, { status: 400 });
  }

  try {
    const provider = {
      ...body.provider,
      remainingTokens: body.remainingTokens ?? body.battle?.tokenLedger?.remaining
    };
    const result = await resolveLlmBattleTurn({
      battle: body.battle,
      attack: body.attack,
      style: body.style || body.battle?.style || "classic",
      provider,
      apiKey: bearerToken(request),
      battleConfig: BattleConfig,
      fetchImpl: fetch
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Battle resolution failed",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
