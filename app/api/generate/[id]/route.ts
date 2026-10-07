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

    // 1. Get the generation from Supabase
    const { data: generation, error: generationError } =
      await supabase
        .from("generations")
        .select(
          "id, status, runpod_job_id, result_path, error, created_at, completed_at",
        )
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

    // 2. If there is no RunPod job yet, return the current record
    if (!generation.runpod_job_id) {
      return NextResponse.json({
        success: true,
        generation,
      });
    }

    // 3. Get RunPod configuration
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

    // 4. Ask RunPod for the current job status
    const runpodResponse = await fetch(
      `https://api.runpod.ai/v2/${runpodEndpointId}/status/${generation.runpod_job_id}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${runpodApiKey}`,
        },
        cache: "no-store",
      },
    );

    const runpodData = await runpodResponse.json();

    if (!runpodResponse.ok) {
      return NextResponse.json(
        {
          error:
            runpodData?.error ||
            "Failed to get RunPod job status",
        },
        { status: 500 },
      );
    }

    const runpodStatus = runpodData.status;

    // 5. Job is still waiting or processing
    if (
      runpodStatus === "IN_QUEUE" ||
      runpodStatus === "IN_PROGRESS"
    ) {
      return NextResponse.json({
        success: true,
        generation: {
          ...generation,
          status: "processing",
        },
        runpod: {
          id: runpodData.id,
          status: runpodStatus,
        },
      });
    }

    // 6. Job completed
    if (runpodStatus === "COMPLETED") {
      // If the result was already saved, return the completed record.
      if (generation.result_path) {
        return NextResponse.json({
          success: true,
          generation: {
            ...generation,
            status: "completed",
          },
          runpod: {
            id: runpodData.id,
            status: runpodStatus,
          },
        });
      }

      // 7. Get the generated image URL from RunPod output
      const output = runpodData.output;

      let imageUrl: string | null = null;

      if (Array.isArray(output)) {
        for (const item of output) {
          if (
            item &&
            typeof item === "object" &&
            typeof item.image === "string"
          ) {
            imageUrl = item.image;
            break;
          }
        }
      } else if (
        output &&
        typeof output === "object" &&
        typeof output.image === "string"
      ) {
        imageUrl = output.image;
      }

      if (!imageUrl) {
        await supabase
          .from("generations")
          .update({
            status: "failed",
            error: "RunPod completed but no output image was found",
          })
          .eq("id", id);

        return NextResponse.json(
          {
            error:
              "RunPod completed but no output image was found",
          },
          { status: 500 },
        );
      }

      // 8. Download the generated image
      const imageResponse = await fetch(imageUrl);

      if (!imageResponse.ok) {
        await supabase
          .from("generations")
          .update({
            status: "failed",
            error: "Failed to download generated image",
          })
          .eq("id", id);

        return NextResponse.json(
          {
            error: "Failed to download generated image",
          },
          { status: 500 },
        );
      }

      const imageBuffer = Buffer.from(
        await imageResponse.arrayBuffer(),
      );

      // 9. Save the generated image permanently in Supabase Storage
      const resultPath = `results/${generation.id}.webp`;

      const { error: uploadError } = await supabase.storage
        .from("tryon")
        .upload(resultPath, imageBuffer, {
          contentType: "image/webp",
          upsert: true,
        });

      if (uploadError) {
        await supabase
          .from("generations")
          .update({
            status: "failed",
            error: uploadError.message,
          })
          .eq("id", id);

        return NextResponse.json(
          {
            error: uploadError.message,
          },
          { status: 500 },
        );
      }

      // 10. Update the generation record
      const { data: updatedGeneration, error: updateError } =
        await supabase
          .from("generations")
          .update({
            status: "completed",
            result_path: resultPath,
            completed_at: new Date().toISOString(),
            error: null,
          })
          .eq("id", id)
          .select(
            "id, status, runpod_job_id, result_path, error, created_at, completed_at",
          )
          .single();

      if (updateError) {
        return NextResponse.json(
          {
            error: updateError.message,
          },
          { status: 500 },
        );
      }

      // 11. Return the completed generation
      return NextResponse.json({
        success: true,
        generation: updatedGeneration,
        runpod: {
          id: runpodData.id,
          status: runpodStatus,
        },
      });
    }

    // 12. Job failed, cancelled, or timed out
    if (
      runpodStatus === "FAILED" ||
      runpodStatus === "CANCELLED" ||
      runpodStatus === "TIMED_OUT"
    ) {
      const errorMessage =
        runpodData?.error ||
        `RunPod job ${runpodStatus.toLowerCase()}`;

      const { data: updatedGeneration, error: updateError } =
        await supabase
          .from("generations")
          .update({
            status: "failed",
            error: errorMessage,
          })
          .eq("id", id)
          .select(
            "id, status, runpod_job_id, result_path, error, created_at, completed_at",
          )
          .single();

      if (updateError) {
        return NextResponse.json(
          {
            error: updateError.message,
          },
          { status: 500 },
        );
      }

      return NextResponse.json({
        success: true,
        generation: updatedGeneration,
        runpod: {
          id: runpodData.id,
          status: runpodStatus,
        },
      });
    }

    // 13. Handle any unexpected RunPod status
    return NextResponse.json({
      success: true,
      generation,
      runpod: {
        id: runpodData.id,
        status: runpodStatus,
      },
    });
  } catch (error) {
    console.error("Generation status error:", error);

    return NextResponse.json(
      {
        error: "Failed to check generation status",
      },
      { status: 500 },
    );
  }
}
