"use client";

import { useEffect, useState } from "react";
import { getGuestId } from "@/lib/guest";
import ImageUpload from "@/components/ImageUpload";

const ACTIVE_GENERATION_KEY = "fitchek_active_generation_id";

export default function Playground() {
  const [personFile, setPersonFile] = useState<File | null>(null);
  const [garmentFile, setGarmentFile] = useState<File | null>(null);

  const [guestId, setGuestId] = useState<string | null>(null);

  const [personPath, setPersonPath] = useState<string | null>(null);
  const [garmentPath, setGarmentPath] = useState<string | null>(null);

  const [generating, setGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<string | null>(
    null,
  );

  const [resultPath, setResultPath] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(
    null,
  );

  const [prompt, setPrompt] = useState(
    "Take the person from image 1 and dress them in the item shown in image 2, keeping the person's pose, facial identity, hair, body proportions, lighting, and background unchanged, only replacing or adding the item with realistic color, fabric, and fit for a seamless, photorealistic try-on.",
  );

  useEffect(() => {
    setGuestId(getGuestId());
  }, []);

  const canGenerate =
    personFile !== null &&
    garmentFile !== null &&
    personPath !== null &&
    garmentPath !== null;

  async function pollGeneration(generationId: string) {
    const maxAttempts = 75;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const response = await fetch(
        `/api/generate/${generationId}`,
        {
          method: "GET",
          cache: "no-store",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to check generation status",
        );
      }

      const status = data.runpod?.status;

      console.log(
        `Generation status (${attempt + 1}/${maxAttempts}):`,
        status,
      );

      if (status === "IN_QUEUE") {
        setGenerationStatus(
          "Your request is waiting in the generation queue...",
        );
      }

      if (status === "IN_PROGRESS") {
        setGenerationStatus(
          "AI is creating your try-on image...",
        );
      }

      if (status === "COMPLETED") {
        setGenerationStatus(
          "Generation completed. Loading your result...",
        );

        const resultPath = data.generation?.result_path;

        if (!resultPath) {
          localStorage.removeItem(ACTIVE_GENERATION_KEY);

          throw new Error(
            "Generation completed but the result image was not saved.",
          );
        }

        const resultResponse = await fetch(
          `/api/generate/${generationId}/result`,
          {
            method: "GET",
            cache: "no-store",
          },
        );

        const resultData = await resultResponse.json();

        if (!resultResponse.ok) {
          throw new Error(
            resultData.error ||
              "Failed to load generated image",
          );
        }

        setResultPath(resultData.imageUrl);

        localStorage.removeItem(ACTIVE_GENERATION_KEY);

        setGenerationStatus(null);

        return;
      }

      if (
        status === "FAILED" ||
        status === "CANCELLED" ||
        status === "TIMED_OUT"
      ) {
        localStorage.removeItem(ACTIVE_GENERATION_KEY);

        throw new Error(
          data.generation?.error ||
            `Generation ${status.toLowerCase()}. Please try again.`,
        );
      }

      await new Promise((resolve) =>
        setTimeout(resolve, 4000),
      );
    }

    localStorage.removeItem(ACTIVE_GENERATION_KEY);

    throw new Error(
      "Generation took too long and timed out. Please try again.",
    );
  }

  useEffect(() => {
    const activeGenerationId = localStorage.getItem(
      ACTIVE_GENERATION_KEY,
    );

    if (!activeGenerationId) {
      return;
    }

    async function resumeGeneration() {
      try {
        setGenerating(true);
        setGenerationError(null);
        setGenerationStatus(
          "Resuming your generation...",
        );
        setResultPath(null);

        await pollGeneration(activeGenerationId);
      } catch (error) {
        console.error(
          "Generation resume error:",
          error,
        );

        setGenerationStatus(null);

        setGenerationError(
          error instanceof Error
            ? error.message
            : "Something went wrong while resuming the generation.",
        );
      } finally {
        setGenerating(false);
      }
    }

    resumeGeneration();
  }, []);

  async function handleGenerate() {
    if (
      !canGenerate ||
      !personPath ||
      !garmentPath ||
      !guestId
    ) {
      return;
    }

    try {
      setGenerating(true);
      setGenerationStatus("Starting generation...");
      setGenerationError(null);
      setResultPath(null);

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          guestId,
          personPath,
          garmentPath,
          prompt,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to start generation",
        );
      }

      const generationId = data.generation?.id;

      if (!generationId) {
        throw new Error(
          "Generation ID was not returned",
        );
      }

      localStorage.setItem(
        ACTIVE_GENERATION_KEY,
        generationId,
      );

      console.log(
        "Generation created:",
        generationId,
      );

      await pollGeneration(generationId);
    } catch (error) {
      console.error(
        "Generation error:",
        error,
      );

      localStorage.removeItem(
        ACTIVE_GENERATION_KEY,
      );

      setGenerationStatus(null);

      setGenerationError(
        error instanceof Error
          ? error.message
          : "Something went wrong while generating the image.",
      );
    } finally {
      setGenerating(false);
    }
  }

  function handleTryAgain() {
    setGenerationError(null);
    setGenerationStatus(null);
    setResultPath(null);

    localStorage.removeItem(
      ACTIVE_GENERATION_KEY,
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-16">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-purple-600">
            AI Virtual Try-On
          </p>

          <h1 className="mt-3 text-4xl font-bold">
            Create your try-on
          </h1>

          <p className="mt-4 text-gray-600">
            Upload a person photo and a garment photo to get
            started.
          </p>
        </div>

        {/* Uploads */}
        <div className="mt-12 grid gap-8 md:grid-cols-2">
          <ImageUpload
            title="Person image"
            description="Choose a clear photo of the person."
            onFileSelect={(file, path) => {
              setPersonFile(file);
              setPersonPath(path);
              setResultPath(null);
              setGenerationError(null);
            }}
          />

          <ImageUpload
            title="Garment image"
            description="Choose a clear photo of the garment."
            onFileSelect={(file, path) => {
              setGarmentFile(file);
              setGarmentPath(path);
              setResultPath(null);
              setGenerationError(null);
            }}
          />
        </div>

        {/* Prompt */}
        <div className="mt-8 rounded-2xl bg-white p-8 shadow-sm">
          <h2 className="text-xl font-semibold">
            Prompt
          </h2>

          <textarea
            value={prompt}
            onChange={(event) =>
              setPrompt(event.target.value)
            }
            disabled={generating}
            className="mt-4 min-h-32 w-full rounded-xl border border-gray-300 p-4 outline-none focus:border-purple-500 disabled:bg-gray-100"
          />
        </div>

        {/* Generate */}
        <div className="mt-8 text-center">
          <button
            type="button"
            disabled={!canGenerate || generating}
            onClick={handleGenerate}
            className={`rounded-full px-8 py-4 font-semibold ${
              canGenerate && !generating
                ? "bg-purple-600 text-white hover:bg-purple-700"
                : "cursor-not-allowed bg-gray-300 text-gray-600"
            }`}
          >
            {generating
              ? "Generating..."
              : "Generate"}
          </button>
        </div>

        {/* Loading */}
        {generating && (
          <div className="mt-8 rounded-2xl bg-white p-8 text-center shadow-sm">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-purple-600" />

            <p className="mt-5 text-lg font-semibold">
              {generationStatus ||
                "Generating your try-on..."}
            </p>

            <p className="mt-2 text-sm text-gray-500">
              This can take a little while. Please keep this
              page open.
            </p>
          </div>
        )}

        {/* Error */}
        {generationError && !generating && (
          <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
            <p className="text-lg font-semibold text-red-700">
              Generation failed
            </p>

            <p className="mt-2 text-sm text-red-600">
              {generationError}
            </p>

            <button
              type="button"
              onClick={handleTryAgain}
              className="mt-5 rounded-full bg-red-600 px-6 py-3 font-semibold text-white hover:bg-red-700"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Result */}
        {resultPath && !generating && (
          <div className="mt-8 rounded-2xl bg-white p-8 shadow-sm">
            <h2 className="text-center text-2xl font-semibold">
              Your Try-On Result
            </h2>

            <div className="mt-6 flex justify-center">
              <img
                src={resultPath}
                alt="AI generated try-on result"
                className="max-h-[700px] w-auto rounded-2xl object-contain shadow-md"
              />
            </div>

            <div className="mt-6 text-center">
              <a
                href={resultPath}
                download="fitchek-tryon-result.webp"
                className="inline-block rounded-full bg-purple-600 px-8 py-3 font-semibold text-white hover:bg-purple-700"
              >
                Download Result
              </a>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
