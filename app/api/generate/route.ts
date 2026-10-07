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

    // 1. Create the generation record
    const { data: generation, error: insertError } = await supabase
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

    if (insertError || !generation) {
      return NextResponse.json(
        {
          error:
            insertError?.message || "Failed to create generation",
        },
        { status: 500 },
      );
    }

    // 2. Create signed URL for the person image
    const { data: personUrlData, error: personUrlError } =
      await supabase.storage
        .from("tryon")
        .createSignedUrl(personPath, 30 * 60);

    if (personUrlError || !personUrlData?.signedUrl) {
      return NextResponse.json(
        {
          error:
            personUrlError?.message ||
            "Failed to create person image URL",
        },
        { status: 500 },
      );
    }

    // 3. Create signed URL for the garment image
    const { data: garmentUrlData, error: garmentUrlError } =
      await supabase.storage
        .from("tryon")
        .createSignedUrl(garmentPath, 30 * 60);

    if (garmentUrlError || !garmentUrlData?.signedUrl) {
      return NextResponse.json(
        {
          error:
            garmentUrlError?.message ||
            "Failed to create garment image URL",
        },
        { status: 500 },
      );
    }

    // 4. Get RunPod configuration
    const runpodApiKey = process.env.RUNPOD_API_KEY;
    const runpodEndpointId = process.env.RUNPOD_ENDPOINT_ID;

    if (!runpodApiKey || !runpodEndpointId) {
      return NextResponse.json(
        {
          error: "RunPod environment variables are not configured",
        },
        { status: 500 },
      );
    }

    // 5. Start the RunPod job
    const runpodResponse = await fetch(
      `https://api.runpod.ai/v2/${runpodEndpointId}/run`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${runpodApiKey}`,
        },
        body: JSON.stringify({
          input: {
            request_id: `tryon-${generation.id}`,
            model_img: personUrlData.signedUrl,
            cloth_img: garmentUrlData.signedUrl,
            output_format: "webp",
            prompt,
            premium_user: true,
          },
        }),
      },
    );

    const runpodData = await runpodResponse.json();

    if (!runpodResponse.ok || !runpodData.id) {
      await supabase
        .from("generations")
        .update({
          status: "failed",
          error:
            runpodData?.error ||
            "Failed to start RunPod job",
        })
        .eq("id", generation.id);

      return NextResponse.json(
        {
          error:
            runpodData?.error ||
            "Failed to start RunPod job",
        },
        { status: 500 },
      );
    }

    // 6. Save the RunPod job ID
    const { data: updatedGeneration, error: updateError } =
      await supabase
        .from("generations")
        .update({
          runpod_job_id: runpodData.id,
          status: "processing",
        })
        .eq("id", generation.id)
        .select("id, status, runpod_job_id, created_at")
        .single();

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      generation: updatedGeneration,
      runpod: {
        id: runpodData.id,
        status: runpodData.status,
      },
    });
  } catch (error) {
    console.error("Generation error:", error);

    return NextResponse.json(
      {
        error: "Invalid request",
      },
      { status: 400 },
    );
  }
}