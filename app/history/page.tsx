"use client";

import { useEffect, useState } from "react";
import { getGuestId } from "@/lib/guest";

type HistoryItem = {
  id: string;
  guestId: string;
  prompt: string;
  status: string;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
  personUrl: string | null;
  garmentUrl: string | null;
  resultUrl: string | null;
};

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadHistory() {
      try {
        setLoading(true);
        setError(null);

        const guestId = getGuestId();

        const response = await fetch(
          `/api/history?guest_id=${encodeURIComponent(guestId)}`,
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to load history");
        }

        setHistory(data.history ?? []);
      } catch (error) {
        console.error("History loading error:", error);

        setError(
          error instanceof Error
            ? error.message
            : "Failed to load history",
        );
      } finally {
        setLoading(false);
      }
    }

    loadHistory();
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen px-6 py-12">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-3xl font-bold">History</h1>

          <p className="mt-4 text-gray-500">
            Loading your previous generations...
          </p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen px-6 py-12">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-3xl font-bold">History</h1>

          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        </div>
      </main>
    );
  }

  if (history.length === 0) {
    return (
      <main className="min-h-screen px-6 py-12">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-3xl font-bold">History</h1>

          <div className="mt-8 rounded-xl border p-8 text-center">
            <p className="text-gray-500">
              You don&apos;t have any generations yet.
            </p>

            <a
              href="/playground"
              className="mt-4 inline-block rounded-lg bg-black px-5 py-2 text-white"
            >
              Go to Playground
            </a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-3xl font-bold">History</h1>

        <p className="mt-2 text-gray-500">
          Your previous AI try-on generations.
        </p>

        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {history.map((item) => (
            <div
              key={item.id}
              className="overflow-hidden rounded-xl border bg-white shadow-sm"
            >
              <div className="grid grid-cols-2 gap-2 p-3">
                <div>
                  <p className="mb-2 text-sm font-medium">
                    Person
                  </p>

                  {item.personUrl ? (
                    <img
                      src={item.personUrl}
                      alt="Person"
                      className="h-48 w-full rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-48 items-center justify-center rounded-lg bg-gray-100 text-sm text-gray-400">
                      No image
                    </div>
                  )}
                </div>

                <div>
                  <p className="mb-2 text-sm font-medium">
                    Garment
                  </p>

                  {item.garmentUrl ? (
                    <img
                      src={item.garmentUrl}
                      alt="Garment"
                      className="h-48 w-full rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-48 items-center justify-center rounded-lg bg-gray-100 text-sm text-gray-400">
                      No image
                    </div>
                  )}
                </div>
              </div>

              <div className="px-3 pb-3">
                <p className="mb-2 text-sm font-medium">
                  Result
                </p>

                {item.resultUrl ? (
                  <img
                    src={item.resultUrl}
                    alt="Generated try-on result"
                    className="h-72 w-full rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex h-72 items-center justify-center rounded-lg bg-gray-100 text-sm text-gray-400">
                    Result not available
                  </div>
                )}
              </div>

              <div className="border-t p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    Status
                  </span>

                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium capitalize">
                    {item.status}
                  </span>
                </div>

                <p className="mt-3 text-sm text-gray-600">
                  {item.prompt}
                </p>

                <p className="mt-3 text-xs text-gray-400">
                  {new Date(item.createdAt).toLocaleString()}
                </p>

                {item.error && (
                  <p className="mt-2 text-sm text-red-600">
                    {item.error}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
