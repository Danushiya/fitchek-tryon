
"use client";

import { useRef, useState } from "react";
import { getGuestId } from "@/lib/guest";

type ImageUploadProps = {
  title: string;
  description: string;
  onFileSelect: (file: File, path: string) => void;
  onTrySamples: () => void;
  samplePreview?: string | null;
};

export default function ImageUpload({
  title,
  description,
  onFileSelect,
  onTrySamples,
  samplePreview,
}: ImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleImageChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file.");
      event.target.value = "";
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("Image size must be 10 MB or less.");
      event.target.value = "";
      return;
    }

    const imageUrl = URL.createObjectURL(file);
    setPreview(imageUrl);
    setError(null);

    try {
      setUploading(true);

      const guestId = getGuestId();

      const response = await fetch("/api/upload-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          guestId,
          fileName: file.name,
          fileType: file.type,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create upload URL");
      }

      const { path, token } = data;

      const uploadResponse = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/upload/sign/tryon/${path}?token=${token}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": file.type,
          },
          body: file,
        },
      );

      if (!uploadResponse.ok) {
        throw new Error("Image upload failed. Please try again.");
      }

      onFileSelect(file, path);
    } catch (error) {
      console.error("Upload error:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Something went wrong while uploading.",
      );
      setPreview(null);
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow duration-200 hover:shadow-md sm:p-6">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 text-indigo-600">
          {title.toLowerCase().includes("person") ? (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="m21 15-5-5L5 21" />
            </svg>
          ) : (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path d="m16 4 5 4-3 4-2-2v10H8V10l-2 2-3-4 5-4a6 6 0 0 0 8 0Z" />
            </svg>
          )}
        </div>

        <div className="min-w-0">
          <h2 className="font-semibold text-slate-900">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        onChange={handleImageChange}
        className="hidden"
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        aria-label={`Upload ${title}`}
        className="group flex min-h-48 w-full flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-indigo-200 bg-gradient-to-br from-slate-50 to-indigo-50/40 p-4 text-center transition duration-200 hover:border-violet-400 hover:bg-violet-50/50 disabled:cursor-wait disabled:opacity-70 sm:min-h-52"
      >
        {preview || samplePreview ? (
          <img
            src={preview || samplePreview || ""}
            alt={`${title} preview`}
            className="max-h-56 w-full rounded-lg object-contain"
          />
        ) : (
          <>
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-white text-indigo-500 shadow-sm ring-1 ring-indigo-100 transition group-hover:scale-105">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="h-7 w-7"
                aria-hidden="true"
              >
                <rect x="3" y="3" width="18" height="18" rx="3" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="m21 15-5-5L5 21" />
              </svg>
            </div>

            <p className="font-medium text-slate-700">
              Click to upload your image
            </p>
            <p className="mt-1 text-sm text-slate-500">
              or drag and drop is coming next
            </p>
            <p className="mt-3 text-xs text-slate-400">
              JPG, PNG, WebP or AVIF · Max 10 MB
            </p>
          </>
        )}
      </button>

      <button
        type="button"
        onClick={onTrySamples}
        className="mt-4 w-full rounded-2xl border border-gray-300 bg-white px-5 py-4 font-semibold text-gray-900 transition hover:border-blue-500 hover:bg-blue-50"
      >
        ⤨ Try samples
      </button>

      {preview && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="mt-3 text-sm font-medium text-indigo-600 transition hover:text-violet-700 disabled:opacity-50"
        >
          Change image
        </button>
      )}

      {uploading && (
        <div className="mt-3 flex items-center gap-2 text-sm text-indigo-600">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
          Uploading image securely...
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}
    </section>
  );
}
