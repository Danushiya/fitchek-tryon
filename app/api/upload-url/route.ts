import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const { guestId, fileName, fileType } = body;

    if (!guestId || !fileName || !fileType) {
      return NextResponse.json(
        {
          error: "guestId, fileName and fileType are required",
        },
        { status: 400 },
      );
    }

    const fileExtension = fileName.split(".").pop() || "jpg";

    const uniqueFileName = `${crypto.randomUUID()}.${fileExtension}`;

    const storagePath = `inputs/${guestId}/${uniqueFileName}`;

    const { data, error } = await supabase.storage
      .from("tryon")
      .createSignedUploadUrl(storagePath);

    if (error) {
      return NextResponse.json(
        {
          error: error.message,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      path: storagePath,
      token: data.token,
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