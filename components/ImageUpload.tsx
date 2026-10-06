"use client";

import { useState } from "react";

type ImageUploadProps = {
  title: string;
  description: string;
  onFileSelect: (file: File) => void;
};

export default function ImageUpload({
  title,
  description,
  onFileSelect,
}: ImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);

  function handleImageChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const imageUrl = URL.createObjectURL(file);

    setPreview(imageUrl);
    onFileSelect(file);
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
    </div>
  );
}