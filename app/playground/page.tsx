"use client";

import { useEffect, useState } from "react";
import { getGuestId } from "@/lib/guest";
import ImageUpload from "@/components/ImageUpload";

export default function Playground() {
  const [personFile, setPersonFile] = useState<File | null>(null);
  const [garmentFile, setGarmentFile] = useState<File | null>(null);
  const [guestId, setGuestId] = useState<string | null>(null);

  useEffect(() => {
    setGuestId(getGuestId());
  }, []);

  const canGenerate = personFile !== null && garmentFile !== null;

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-16">
      <div className="mx-auto max-w-5xl">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-purple-600">
            AI Virtual Try-On
          </p>

          <h1 className="mt-3 text-4xl font-bold">
            Create your try-on
          </h1>

          <p className="mt-4 text-gray-600">
            Upload a person photo and a garment photo to get started.
          </p>
        </div>

        <div className="mt-12 grid gap-8 md:grid-cols-2">
          <ImageUpload
            title="Person image"
            description="Choose a clear photo of the person."
            onFileSelect={setPersonFile}
          />

          <ImageUpload
            title="Garment image"
            description="Choose a clear photo of the garment."
            onFileSelect={setGarmentFile}
          />
        </div>

        <div className="mt-8 rounded-2xl bg-white p-8 shadow-sm">
          <h2 className="text-xl font-semibold">
            Prompt
          </h2>

          <textarea
            className="mt-4 min-h-32 w-full rounded-xl border border-gray-300 p-4 outline-none focus:border-purple-500"
            defaultValue="Take the person from image 1 and dress them in the item shown in image 2, keeping the person's pose, facial identity, hair, body proportions, lighting, and background unchanged, only replacing or adding the item with realistic color, fabric, and fit for a seamless, photorealistic try-on."
          />
        </div>

        <div className="mt-8 text-center">
          <button
            type="button"
            disabled={!canGenerate}
            className={`rounded-full px-8 py-4 font-semibold ${
              canGenerate
                ? "bg-purple-600 text-white hover:bg-purple-700"
                : "cursor-not-allowed bg-gray-300 text-gray-600"
            }`}
          >
            Generate
          </button>
        </div>
      </div>
    </main>
  );
}