import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    // 1. Get guest_id from the URL
    const { searchParams } = new URL(request.url);
    const guestId = searchParams.get("guest_id");

    if (!guestId) {
      return NextResponse.json(
        {
          error: "guest_id is required",
        },
        { status: 400 },
      );
    }

    // 2. Get generations belonging to this guest
    const { data: generations, error: generationsError } =
      await supabase
        .from("generations")
        .select(
          "id, guest_id, person_path, garment_path, prompt, status, result_path, error, created_at, completed_at",
        )
        .eq("guest_id", guestId)
        .order("created_at", {
          ascending: false,
        });

    if (generationsError) {
      return NextResponse.json(
        {
          error: generationsError.message,
        },
        { status: 500 },
      );
    }

    // 3. Create signed URLs for the images
    const history = await Promise.all(
      (generations ?? []).map(async (generation) => {
        // Person image URL
        const { data: personData } =
          await supabase.storage
            .from("tryon")
            .createSignedUrl(
              generation.person_path,
              60 * 60,
            );

        // Garment image URL
        const { data: garmentData } =
          await supabase.storage
            .from("tryon")
            .createSignedUrl(
              generation.garment_path,
              60 * 60,
            );

        // Result image URL
        let resultUrl: string | null = null;

        if (generation.result_path) {
          const { data: resultData } =
            await supabase.storage
              .from("tryon")
              .createSignedUrl(
                generation.result_path,
                60 * 60,
              );

          resultUrl = resultData?.signedUrl ?? null;
        }

        return {
          id: generation.id,
          guestId: generation.guest_id,
          prompt: generation.prompt,
          status: generation.status,
          error: generation.error,
          createdAt: generation.created_at,
          completedAt: generation.completed_at,

          personUrl: personData?.signedUrl ?? null,
          garmentUrl: garmentData?.signedUrl ?? null,
          resultUrl,
        };
      }),
    );

    // 4. Return the history
    return NextResponse.json({
      success: true,
      history,
    });
  } catch (error) {
    console.error("History error:", error);

    return NextResponse.json(
      {
        error: "Failed to load generation history",
      },
      { status: 500 },
    );
  }
}
