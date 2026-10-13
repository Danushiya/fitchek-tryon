
"use client";

import { useEffect, useRef, useState } from "react";
import {
  createDecartClient,
  models,
  type RealTimeClient,
} from "@decartai/sdk";

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

  return (
    <section className="mt-12 rounded-3xl border border-purple-100 bg-white p-6 shadow-sm md:p-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-purple-600">
            Decart Live Studio
          </p>
          <h2 className="mt-2 text-2xl font-bold text-gray-900">
            Live virtual try-on
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Preview your selected garment on camera for up to 10 seconds.
          </p>
        </div>

        {running && (
          <span className="inline-flex items-center rounded-full bg-purple-50 px-4 py-2 text-sm font-semibold text-purple-700">
            {secondsLeft}s remaining
          </span>
        )}
      </div>

      <label className="mt-6 block text-sm font-semibold text-gray-700">
        Choose garment image
        <input
          type="file"
          accept="image/*"
          disabled={running}
          onChange={(event) => {
            setGarmentFile(event.target.files?.[0] ?? null);
            setError(null);
          }}
          className="mt-2 block w-full rounded-xl border border-gray-200 p-3 text-sm file:mr-4 file:rounded-full file:border-0 file:bg-purple-50 file:px-4 file:py-2 file:font-semibold file:text-purple-700"
        />
      </label>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <div>
          <p className="mb-2 text-sm font-semibold text-gray-700">
            Camera
          </p>
          <video
            ref={cameraVideoRef}
            autoPlay
            muted
            playsInline
            className="aspect-[3/4] w-full rounded-2xl bg-gray-950 object-cover"
          />
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-gray-700">
            Live try-on
          </p>
          <video
            ref={resultVideoRef}
            autoPlay
            muted
            playsInline
            className="aspect-[3/4] w-full rounded-2xl bg-gray-950 object-cover"
          />
        </div>
      </div>

      <p className="mt-4 text-sm text-gray-600" aria-live="polite">
        {status}
      </p>

      {error && (
        <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={startSession}
          disabled={!garmentFile || running}
          className="rounded-full bg-purple-600 px-6 py-3 font-semibold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          Start 10-second try-on
        </button>

        {running && (
          <button
            type="button"
            onClick={() => void stopSession("Live try-on stopped.")}
            className="rounded-full border border-gray-300 px-6 py-3 font-semibold text-gray-700 hover:bg-gray-50"
          >
            Stop now
          </button>
        )}
      </div>
    </section>
  );
}
