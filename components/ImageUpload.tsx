"use client";

import { useState } from "react";
import { getGuestId } from "@/lib/guest";

type ImageUploadProps = {
  title: string;
  description: string;
  onFileSelect: (file: File, path: string) => void;
};

export default function ImageUpload({
  title,
  description,
  onFileSelect,
}: ImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleImageChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const imageUrl = URL.createObjectURL(file);
    setPreview(imageUrl);

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
        throw new Error(
          data.error || "Failed to create upload URL",
        );
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
        throw new Error("Image upload failed");
      }

      onFileSelect(file, path);

      console.log("Image uploaded successfully:", path);
    } catch (error) {
      console.error("Upload error:", error);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="rounded-2xl bg-white p-8 shadow-sm">
      <h2 className="text-xl font-semibold">{title}</h2>

      <label className="mt-6 block cursor-pointer">
        <div className="flex min-h-64 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-gray-300 transition hover:border-purple-500">
          {preview ? (
            <img
              src={preview}
              alt={`${title} preview`}
              className="h-64 w-full object-contain"
            />
          ) : (
            <div className="text-center">
              <div className="text-4xl">📷</div>

              <p className="mt-3 font-medium">
                Upload image
              </p>

              <p className="mt-1 text-sm text-gray-500">
                {description}
              </p>
            </div>
          )}
        </div>

        <input
          type="file"
          accept="image/*"
          onChange={handleImageChange}
          className="hidden"
        />
      </label>

      {uploading && (
        <p className="mt-3 text-sm text-gray-500">
          Uploading...
        </p>
      )}
    </div>
  );
}