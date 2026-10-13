
import { NextResponse } from "next/server";
import { createDecartClient } from "@decartai/sdk";

export async function POST() {
  try {
    const apiKey = process.env.DECART_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Decart API key is not configured" },
        { status: 500 },
      );
    }

    const client = createDecartClient({ apiKey });

    const token = await client.tokens.create({
      expiresIn: 300,
      metadata: {
        service_tier: 0,
      },
    });

    return NextResponse.json({
      apiKey: token.apiKey,
      token: token.token,
    });
  } catch (error) {
    console.error("Decart token creation failed:", error);

    return NextResponse.json(
      { error: "Unable to initialize live try-on" },
      { status: 500 },
    );
  }
}
