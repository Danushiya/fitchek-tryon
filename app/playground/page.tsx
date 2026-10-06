export default function Playground() {
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
          {/* Person */}
          <div className="rounded-2xl bg-white p-8 shadow-sm">
            <h2 className="text-xl font-semibold">
              Person image
            </h2>

            <div className="mt-6 flex min-h-64 items-center justify-center rounded-xl border-2 border-dashed border-gray-300">
              <p className="text-gray-500">
                Person image upload will come here
              </p>
            </div>
          </div>

          {/* Garment */}
          <div className="rounded-2xl bg-white p-8 shadow-sm">
            <h2 className="text-xl font-semibold">
              Garment image
            </h2>

            <div className="mt-6 flex min-h-64 items-center justify-center rounded-xl border-2 border-dashed border-gray-300">
              <p className="text-gray-500">
                Garment image upload will come here
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-2xl bg-white p-8 shadow-sm">
          <h2 className="text-xl font-semibold">
            Prompt
          </h2>

          <textarea
            className="mt-4 min-h-32 w-full rounded-xl border border-gray-300 p-4 outline-none focus:border-purple-500"
            defaultValue="Take the person from image 1 and dress them in the item shown in image 2, keeping the person&apos;s pose, facial identity, hair, body proportions, lighting, and background unchanged, only replacing or adding the item with realistic color, fabric, and fit for a seamless, photorealistic try-on."
          />
        </div>

        <div className="mt-8 text-center">
          <button
            type="button"
            disabled
            className="rounded-full bg-gray-300 px-8 py-4 font-semibold text-gray-600"
          >
            Generate
          </button>
        </div>
      </div>
    </main>
  );
}
