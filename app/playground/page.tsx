"use client";

import { useEffect, useState } from "react";
import { getGuestId } from "@/lib/guest";
import ImageUpload from "@/components/ImageUpload";
import LiveTryOn from "@/components/LiveTryOn";
import SamplePickerModal from "@/components/SamplePickerModal";

const ACTIVE_GENERATION_KEY = "fitchek_active_generation_id";

const PERSON_SAMPLES = [
  "/women7.jpg",
  "/women2.jpg",
  "/women3.jpg",
  "/women8.jpg",
  "/women5.jpg",
  "/women10.jpg",
];

const GARMENT_SAMPLES = [
  "/garment10.jpg",
  "/garment2.avif",
  "/garment3.webp",
  "/garment4.jpg",
  "/garment5.jpg",
  "/garment6.jpg",
];

export default function Playground() {
  const [personFile, setPersonFile] = useState<File | null>(null);
  const [garmentFile, setGarmentFile] = useState<File | null>(null);

  const [guestId, setGuestId] = useState<string | null>(null);
  const [personPath, setPersonPath] = useState<string | null>(null);
  const [garmentPath, setGarmentPath] = useState<string | null>(null);

  const [generating, setGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<string | null>(null);
  const [resultPath, setResultPath] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);

  const [selectedPersonSample, setSelectedPersonSample] =
    useState<string | null>(null);
  const [selectedGarmentSample, setSelectedGarmentSample] =
    useState<string | null>(null);
  const [sampleLoading, setSampleLoading] = useState(false);
  const [sampleError, setSampleError] = useState<string | null>(null);
  const [sampleModal, setSampleModal] = useState<
    "person" | "garment" | null
  >(null);
  
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

  async function uploadSample(
    imageUrl: string,
  ): Promise<{ file: File; path: string }> {
    const response = await fetch(imageUrl);

    if (!response.ok) {
      throw new Error(`Could not load sample image: ${imageUrl}`);
    }

    const blob = await response.blob();
    const fileName = imageUrl.split("/").pop() || "sample.jpg";

    const fallbackType = fileName.endsWith(".avif")
      ? "image/avif"
      : fileName.endsWith(".webp")
        ? "image/webp"
        : "image/jpeg";

    const file = new File([blob], fileName, {
      type: blob.type || fallbackType,
    });

    const currentGuestId = getGuestId();

    const signedResponse = await fetch("/api/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        guestId: currentGuestId,
        fileName: file.name,
        fileType: file.type,
      }),
    });

    const signedData = await signedResponse.json();

    if (!signedResponse.ok) {
      throw new Error(signedData.error || "Could not prepare sample upload.");
    }

    const uploadResponse = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/upload/sign/tryon/${signedData.path}?token=${signedData.token}`,
      {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      },
    );

    if (!uploadResponse.ok) {
      throw new Error("Sample image upload to Supabase failed.");
    }

    return { file, path: signedData.path };
  }

  async function handleLoadPersonSample() {
    if (!selectedPersonSample || sampleLoading || generating) {
      setSampleError("Please select a person sample first.");
      return;
    }

    setSampleLoading(true);
    setSampleError(null);
    setGenerationError(null);
    setResultPath(null);

    try {
      const person = await uploadSample(selectedPersonSample);

      setPersonFile(person.file);
      setPersonPath(person.path);
      setGenerationStatus(null);
    } catch (error) {
      setSampleError(
        error instanceof Error
          ? error.message
          : "Could not upload the person sample.",
      );
    } finally {
      setSampleLoading(false);
    }
  }

  async function handleLoadGarmentSample() {
    if (!selectedGarmentSample || sampleLoading || generating) {
      setSampleError("Please select a garment sample first.");
      return;
    }

    setSampleLoading(true);
    setSampleError(null);
    setGenerationError(null);
    setResultPath(null);

    try {
      const garment = await uploadSample(selectedGarmentSample);

      setGarmentFile(garment.file);
      setGarmentPath(garment.path);
      setGenerationStatus(null);
    } catch (error) {
      setSampleError(
        error instanceof Error
          ? error.message
          : "Could not upload the garment sample.",
      );
    } finally {
      setSampleLoading(false);
    }
  }

  async function pollGeneration(generationId: string) {
    const maxAttempts = 75;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const response = await fetch(`/api/generate/${generationId}`, {
        method: "GET",
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to check generation status");
      }

      const status = data.runpod?.status;

      if (status === "IN_QUEUE") {
        setGenerationStatus("Your request is waiting in the generation queue...");
      }

      if (status === "IN_PROGRESS") {
        setGenerationStatus("AI is creating your try-on image...");
      }

      if (status === "COMPLETED") {
        setGenerationStatus("Generation completed. Loading your result...");

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
            resultData.error || "Failed to load generated image",
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

      await new Promise((resolve) => setTimeout(resolve, 4000));
    }

    localStorage.removeItem(ACTIVE_GENERATION_KEY);
    throw new Error("Generation took too long and timed out. Please try again.");
  }

  useEffect(() => {
    const activeGenerationId = localStorage.getItem(ACTIVE_GENERATION_KEY);

    if (!activeGenerationId) return;

    async function resumeGeneration() {
      try {
        setGenerating(true);
        setGenerationError(null);
        setGenerationStatus("Resuming your generation...");
        setResultPath(null);

        await pollGeneration(activeGenerationId!);
      } catch (error) {
        console.error("Generation resume error:", error);
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

    void resumeGeneration();
  }, []);

  async function handleGenerate() {
    if (!canGenerate || !personPath || !garmentPath || !guestId) return;

    try {
      setGenerating(true);
      setGenerationStatus("Starting generation...");
      setGenerationError(null);
      setResultPath(null);

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestId,
          personPath,
          garmentPath,
          prompt,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to start generation");
      }

      const generationId = data.generation?.id;

      if (!generationId) {
        throw new Error("Generation ID was not returned");
      }

      localStorage.setItem(ACTIVE_GENERATION_KEY, generationId);
      await pollGeneration(generationId);
    } catch (error) {
      console.error("Generation error:", error);
      localStorage.removeItem(ACTIVE_GENERATION_KEY);
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
    localStorage.removeItem(ACTIVE_GENERATION_KEY);
  }

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-16">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <header className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-purple-600">
            AI Virtual Try-On
          </p>
          <h1 className="mt-3 text-4xl font-bold text-gray-900">
            Create your try-on
          </h1>
          <p className="mt-4 text-gray-600">
            Upload your photos or choose samples to get started.
          </p>
        </header>

        {/* Image uploads */}
        <div className="mt-12 grid gap-8 md:grid-cols-2">
          <ImageUpload
            title="Person image"
            description="Choose a clear photo of the person."
            onFileSelect={(file, path) => {
              setPersonFile(file);
              setPersonPath(path);
              setSelectedPersonSample(null);
              setResultPath(null);
              setGenerationError(null);
              setSampleError(null);
            }}
            onTrySamples={() => {
              setSampleError(null);
              setSampleModal("person");
            }}
          />

          <ImageUpload
            title="Garment image"
            description="Choose a clear photo of the garment."
            onFileSelect={(file, path) => {
              setGarmentFile(file);
              setGarmentPath(path);
              setSelectedGarmentSample(null);
              setResultPath(null);
              setGenerationError(null);
              setSampleError(null);
            }}
            onTrySamples={() => {
              setSampleError(null);
              setSampleModal("garment");
            }}
          />
        </div>

        {sampleError && (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            {sampleError}
          </p>
        )}

        {/* Prompt */}
        <section className="mt-8 rounded-2xl bg-white p-8 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">Prompt</h2>
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            disabled={generating}
            className="mt-4 min-h-32 w-full rounded-xl border border-gray-300 p-4 outline-none focus:border-purple-500 disabled:bg-gray-100"
          />
        </section>

        {/* Generate */}
        <div className="mt-8 text-center">
          <button
            type="button"
            disabled={!canGenerate || generating || sampleLoading}
            onClick={handleGenerate}
            className={`rounded-full px-8 py-4 font-semibold transition ${
              canGenerate && !generating && !sampleLoading
                ? "bg-purple-600 text-white hover:bg-purple-700"
                : "cursor-not-allowed bg-gray-300 text-gray-600"
            }`}
          >
            {generating ? "Generating..." : "Generate Try-On"}
          </button>
        </div>

        {/* Loading */}
        {generating && (
          <div className="mt-8 rounded-2xl bg-white p-8 text-center shadow-sm">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-purple-600" />
            <p className="mt-5 text-lg font-semibold">
              {generationStatus || "Generating your try-on..."}
            </p>
            <p className="mt-2 text-sm text-gray-500">
              This can take a little while. Please keep this page open.
            </p>
          </div>
        )}

        {/* Generation error */}
        {generationError && !generating && (
          <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
            <p className="text-lg font-semibold text-red-700">
              Generation failed
            </p>
            <p className="mt-2 text-sm text-red-600">{generationError}</p>
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
          <section className="mt-8 rounded-2xl bg-white p-8 shadow-sm">
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
          </section>
        )}
      </div>

      {/* Decart live try-on */}
      <div className="mx-auto mt-16 max-w-6xl">
        <LiveTryOn />
      </div>

      <SamplePickerModal
        open={sampleModal === "person"}
        title="Choose a person sample"
        samples={PERSON_SAMPLES}
        selectedSample={selectedPersonSample}
        onSelect={setSelectedPersonSample}
        onClose={() => setSampleModal(null)}
        onProceed={() => {
          if (!selectedPersonSample || sampleLoading || generating) return;

          setSampleModal(null);
          void handleLoadPersonSample();
        }}
        loading={sampleLoading}
      />

      <SamplePickerModal
        open={sampleModal === "garment"}
        title="Choose a garment sample"
        samples={GARMENT_SAMPLES}
        selectedSample={selectedGarmentSample}
        onSelect={setSelectedGarmentSample}
        onClose={() => setSampleModal(null)}
        onProceed={() => {
          if (!selectedGarmentSample || sampleLoading || generating) return;

          setSampleModal(null);
          void handleLoadGarmentSample();
        }}
        loading={sampleLoading}
      />

    </main>
  );
}
