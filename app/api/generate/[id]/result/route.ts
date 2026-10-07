import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  request: Request,
  context: RouteContext,
) {
  try {
    const { id } = await context.params;

    // 1. Get the generation record
    const { data: generation, error: generationError } =
      await supabase
        .from("generations")
        .select("id, status, result_path")
        .eq("id", id)
        .single();

    if (generationError || !generation) {
      return NextResponse.json(
        {
          error: "Generation not found",
        },
        { status: 404 },
      );
    }

    // 2. Make sure the generation is completed
    if (generation.status !== "completed") {
      return NextResponse.json(
        {
          error: "Generation is not completed yet",
        },
        { status: 400 },
      );
    }

    // 3. Make sure a result exists
    if (!generation.result_path) {
      return NextResponse.json(
        {
          error: "Result image not found",
        },
        { status: 404 },
      );
    }

    // 4. Create a temporary signed URL
    const { data, error } = await supabase.storage
      .from("tryon")
      .createSignedUrl(generation.result_path, 60 * 60);

    if (error || !data?.signedUrl) {
      return NextResponse.json(
        {
          error:
            error?.message ||
            "Failed to create result image URL",
        },
        { status: 500 },
      );
    }

    // 5. Return the signed URL
    return NextResponse.json({
      success: true,
      generationId: generation.id,
      imageUrl: data.signedUrl,
    });
  } catch (error) {
    console.error("Result URL error:", error);

    return NextResponse.json(
      {
        error: "Failed to get result image",
      },
      { status: 500 },
    );
  }
}

