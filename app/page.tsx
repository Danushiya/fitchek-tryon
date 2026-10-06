import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-white text-gray-900">
      {/* Hero */}
      <section className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.3em] text-purple-600">
          AI Virtual Try-On
        </p>

        <h1 className="max-w-4xl text-5xl font-bold tracking-tight sm:text-6xl">
          See how clothes look on you with AI.
        </h1>

        <p className="mt-6 max-w-2xl text-lg text-gray-600">
          Upload a photo of yourself and a garment photo. Our AI will create
          a realistic try-on image for you.
        </p>

        <Link
          href="/playground"
          className="mt-8 rounded-full bg-black px-8 py-4 font-semibold text-white transition hover:bg-gray-800"
        >
          Generate Try-On
        </Link>
      </section>

      {/* How It Works */}
      <section className="bg-gray-50 px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-purple-600">
              Simple Process
            </p>

            <h2 className="mt-3 text-3xl font-bold sm:text-4xl">
              How it works
            </h2>
          </div>

          <div className="mt-12 grid gap-8 md:grid-cols-3">
            <div className="rounded-2xl bg-white p-8 shadow-sm">
              <div className="text-4xl">📸</div>

              <h3 className="mt-5 text-xl font-semibold">
                1. Upload yourself
              </h3>

              <p className="mt-3 text-gray-600">
                Upload a clear photo of the person you want to use for the
                virtual try-on.
              </p>
            </div>

            <div className="rounded-2xl bg-white p-8 shadow-sm">
              <div className="text-4xl">👕</div>

              <h3 className="mt-5 text-xl font-semibold">
                2. Upload a garment
              </h3>

              <p className="mt-3 text-gray-600">
                Choose a photo of the clothing item you want to try.
              </p>
            </div>

            <div className="rounded-2xl bg-white p-8 shadow-sm">
              <div className="text-4xl">✨</div>

              <h3 className="mt-5 text-xl font-semibold">
                3. Get your result
              </h3>

              <p className="mt-3 text-gray-600">
                Our AI generates a realistic image of you wearing the garment.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-6 py-24 text-center">
        <h2 className="text-3xl font-bold sm:text-4xl">
          Ready to try something new?
        </h2>

        <p className="mx-auto mt-4 max-w-xl text-gray-600">
          Create your first AI-powered virtual try-on.
        </p>

        <Link
          href="/playground"
          className="mt-8 inline-block rounded-full bg-black px-8 py-4 font-semibold text-white transition hover:bg-gray-800"
        >
          Start Try-On
        </Link>
      </section>
    </main>
  );
}

