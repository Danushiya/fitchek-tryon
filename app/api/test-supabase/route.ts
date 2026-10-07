import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";

export async function GET() {
  const { error } = await supabase
    .from("generations")
    .select("id")
    .limit(1);

  if (error) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    message: "Supabase connection successful",
  });
}