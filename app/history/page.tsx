import Link from "next/link";

export default function History() {
  return (
    <main className="min-h-screen bg-gray-50 px-6 py-16">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-purple-600">
            Your Generations
          </p>

          <h1 className="mt-3 text-4xl font-bold">
            History
          </h1>

          <p className="mt-4 text-gray-600">
            Your previous AI try-on generations will appear here.
          </p>
        </div>

        <div className="mt-16 rounded-2xl bg-white p-12 text-center shadow-sm">
          <div className="text-5xl">✨</div>

          <h2 className="mt-6 text-2xl font-semibold">
            No generations yet
          </h2>

          <p className="mx-auto mt-3 max-w-md text-gray-600">
            Create your first virtual try-on and it will appear here.
          </p>

          <Link
            href="/playground"
            className="mt-8 inline-block rounded-full bg-black px-8 py-4 font-semibold text-white transition hover:bg-gray-800"
          >
            Create Try-On
          </Link>
        </div>
      </div>
    </main>
  );
}
