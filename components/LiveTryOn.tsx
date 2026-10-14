
"use client";

import { useEffect, useRef, useState } from "react";
import {
  createDecartClient,
  models,
  type RealTimeClient,
} from "@decartai/sdk";
import SamplePickerModal from "@/components/SamplePickerModal";
import { GARMENT_SAMPLES } from "@/lib/samples";

const SESSION_DURATION_SECONDS = 10;

export default function LiveTryOn() {
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const resultVideoRef = useRef<HTMLVideoElement>(null);
  const clientRef = useRef<RealTimeClient | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const mountedRef = useRef(false);

  const [garmentFile, setGarmentFile] = useState<File | null>(null);
  const [running, setRunning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(10);
  const [status, setStatus] = useState("Choose a garment to begin.");
  const [error, setError] = useState<string | null>(null);

  const [sampleModalOpen, setSampleModalOpen] = useState(false);
  const [selectedGarmentSample, setSelectedGarmentSample] =
    useState<string | null>(null);
  const [sampleLoading, setSampleLoading] = useState(false);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      clientRef.current?.disconnect();
      clientRef.current = null;

      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  async function stopSession(message = "Live try-on ended.") {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    clientRef.current?.disconnect();
    clientRef.current = null;

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (cameraVideoRef.current) {
      cameraVideoRef.current.srcObject = null;
    }

    if (resultVideoRef.current) {
      resultVideoRef.current.srcObject = null;
    }

    if (mountedRef.current) {
      setRunning(false);
      setSecondsLeft(0);
      setStatus(message);
    }
  }

  async function startSession() {
    if (!garmentFile || running) {
      setError("Please select a garment image first.");
      return;
    }

    setError(null);
    setStatus("Requesting camera access...");
    setSecondsLeft(SESSION_DURATION_SECONDS);

    let cameraStream: MediaStream | null = null;
    let realtimeClient: RealTimeClient | null = null;

    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      streamRef.current = cameraStream;

      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = cameraStream;
        await cameraVideoRef.current.play();
      }

      setStatus("Connecting to Decart...");

      const client = createDecartClient({
        apiKeyProvider: async () => {
          const response = await fetch("/api/realtime-token", {
            method: "POST",
            cache: "no-store",
          });

          const data = await response.json();

          if (!response.ok || !data.apiKey) {
            throw new Error(
              data.error || "Could not authorize the Decart session.",
            );
          }

          return data.apiKey as string;
        },
      });

      const model = models.realtime("lucy-vton-3.6");

      realtimeClient = await client.realtime.connect(cameraStream, {
        model,
        mirror: "auto",
        initialState: {
          image: garmentFile,
        },
        onRemoteStream: (transformedStream) => {
          if (resultVideoRef.current) {
            resultVideoRef.current.srcObject = transformedStream;
            void resultVideoRef.current.play().catch(() => {
              // Playback can require a browser interaction.
            });
          }
        },
        onConnectionChange: (connectionState) => {
          if (mountedRef.current) {
            setStatus(`Decart connection: ${connectionState}`);
          }
        },
      });

      clientRef.current = realtimeClient;

      if (!mountedRef.current) {
        realtimeClient.disconnect();
        cameraStream.getTracks().forEach((track) => track.stop());
        return;
      }

      setRunning(true);
      setStatus("Live try-on is running.");

      // Enforce a hard 10-second limit, even if the UI is not updated.
      timeoutRef.current = setTimeout(() => {
        void stopSession("10-second preview complete.");
      }, SESSION_DURATION_SECONDS * 1000);

      const startedAt = Date.now();

      const countdown = () => {
        if (!mountedRef.current || !clientRef.current) {
          return;
        }

        const remaining = Math.max(
          0,
          SESSION_DURATION_SECONDS -
            Math.floor((Date.now() - startedAt) / 1000),
        );

        setSecondsLeft(remaining);

        if (remaining > 0) {
          window.setTimeout(countdown, 250);
        }
      };

      countdown();
    } catch (cause) {
      realtimeClient?.disconnect();
      cameraStream?.getTracks().forEach((track) => track.stop());

      streamRef.current = null;
      clientRef.current = null;

      if (mountedRef.current) {
        setRunning(false);
        setError(
          cause instanceof Error
            ? cause.message
            : "Unable to start live try-on.",
        );
        setStatus("Live try-on could not start.");
      }
    }
  }


async function handleLiveTryOnSample() {
  if (!selectedGarmentSample || sampleLoading || running) return;

  setSampleLoading(true);
  setError(null);

  try {
    const response = await fetch(selectedGarmentSample);

    if (!response.ok) {
      throw new Error("Could not load the selected garment sample.");
    }

    const blob = await response.blob();
    const filename = selectedGarmentSample.split("/").pop() || "garment.jpg";
    const file = new File([blob], filename, {
      type: blob.type || "image/jpeg",
    });

    setGarmentFile(file);
    setSampleModalOpen(false);
    setStatus("Garment sample selected. Ready to start live try-on.");
  } catch (cause) {
    setError(
      cause instanceof Error
        ? cause.message
        : "Could not load the garment sample.",
    );
  } finally {
    setSampleLoading(false);
  }
}

  return (
    <section className="mt-6 rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm sm:p-7">
      <div className="grid gap-7 lg:grid-cols-[1.15fr_1fr] lg:items-center">
        {/* Left: Information and controls */}
        <div className="space-y-6">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-violet-100 text-2xl text-violet-600">
              <span aria-hidden="true">▣</span>
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-2xl font-bold text-gray-900">
                  Decart Live Try-On
                </h2>
              </div>

              <p className="mt-3 leading-7 text-slate-600">
                Experience real-time virtual try-on with Decart. Get a live
                video feed of yourself wearing the selected outfit. Limited
                to <strong className="text-slate-900">10 seconds</strong> per
                session.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-violet-50 p-3">
              <p className="font-semibold text-slate-800">⚡ Real-time</p>
              <p className="mt-1 text-sm text-slate-500">AI processing</p>
            </div>

            <div className="rounded-xl bg-violet-50 p-3">
              <p className="font-semibold text-slate-800">◷ 10 second</p>
              <p className="mt-1 text-sm text-slate-500">Session limit</p>
            </div>

            <div className="rounded-xl bg-violet-50 p-3">
              <p className="font-semibold text-slate-800">✧ High quality</p>
              <p className="mt-1 text-sm text-slate-500">Output</p>
            </div>
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label
                htmlFor="live-tryon-garment"
                className="text-sm font-semibold text-gray-700"
              >
                Choose garment image
              </label>

              <button
                type="button"
                onClick={() => setSampleModalOpen(true)}
                disabled={running}
                className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-50"
              >
                <span aria-hidden="true">⤨</span>
                Try samples
              </button>
            </div>

            <input
              id="live-tryon-garment"
              type="file"
              accept="image/*"
              disabled={running}
              onChange={(event) => {
                setGarmentFile(event.target.files?.[0] ?? null);
                setError(null);
              }}
              className="mt-2 block w-full rounded-xl border border-gray-200 p-3 text-sm file:mr-4 file:rounded-full file:border-0 file:bg-purple-50 file:px-4 file:py-2 file:font-semibold file:text-purple-700"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={startSession}
              disabled={!garmentFile || running}
              className="flex flex-1 items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 px-5 py-4 font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span aria-hidden="true">▣</span>
              {running ? `${secondsLeft}s remaining` : "Start Live Try-On"}
            </button>

            {running && (
              <button
                type="button"
                onClick={() => void stopSession("Live try-on stopped.")}
                className="rounded-xl border border-gray-300 px-5 py-4 font-semibold text-gray-700 hover:bg-gray-50"
              >
                Stop
              </button>
            )}
          </div>

          <p className="text-sm text-slate-500" aria-live="polite">
            {status}
          </p>

          {error && (
            <p
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </p>
          )}
        </div>

        {/* Right: Live video preview */}
        <div className="relative flex min-h-[300px] flex-col items-center justify-center overflow-hidden rounded-2xl border border-indigo-100 bg-slate-50 p-4 sm:min-h-[380px]">
          <div
            className={`grid w-full gap-3 ${
              running ? "grid-cols-2" : "grid-cols-1"
            }`}
          >
            {running && (
              <div>
                <p className="mb-2 text-sm font-semibold text-slate-700">
                  Camera
                </p>
                <video
                  ref={cameraVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="aspect-[3/4] w-full rounded-xl bg-gray-950 object-cover"
                />
              </div>
            )}

            <div className="min-w-0">
              {running && (
                <p className="mb-2 text-sm font-semibold text-slate-700">
                  Live result
                </p>
              )}

              <video
                ref={resultVideoRef}
                autoPlay
                muted
                playsInline
                className={`${
                  running ? "aspect-[3/4]" : "aspect-video"
                } w-full rounded-xl bg-gray-950 object-cover`}
              />

              {!running && (
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                  <div className="mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-indigo-100 text-5xl text-blue-500">
                    ▣
                  </div>
                  <p className="font-semibold text-slate-700">
                    Your live try-on video will appear here
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    Click “Start Live Try-On” to begin
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <SamplePickerModal
        open={sampleModalOpen}
        title="Choose a garment sample"
        samples={GARMENT_SAMPLES}
        selectedSample={selectedGarmentSample}
        onSelect={setSelectedGarmentSample}
        onClose={() => setSampleModalOpen(false)}
        onProceed={() => void handleLiveTryOnSample()}
        loading={sampleLoading}
      />
    </section>
  );
}
