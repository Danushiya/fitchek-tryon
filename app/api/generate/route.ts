import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      guestId,
      personPath,
      garmentPath,
      prompt,
    } = body;

    if (!guestId || !personPath || !garmentPath || !prompt) {
      return NextResponse.json(
        {
          error:
            "guestId, personPath, garmentPath and prompt are required",
        },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("generations")
      .insert({
        guest_id: guestId,
        person_path: personPath,
        garment_path: garmentPath,
        prompt,
        status: "queued",
      })
      .select("id, status, created_at")
      .single();

    if (error) {
      return NextResponse.json(
        {
          error: error.message,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      generation: data,
    });
  } catch {
    return NextResponse.json(
      {
        error: "Invalid request",
      },
      { status: 400 },
    );
  }
}