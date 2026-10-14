
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
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const previewUrlRef = useRef<string | null>(null);
  const stopMessageRef = useRef("Live try-on ended.");

  const [garmentFile, setGarmentFile] = useState<File | null>(null);
  const [running, setRunning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(10);
  const [status, setStatus] = useState("Choose a garment to begin.");
  const [error, setError] = useState<string | null>(null);

  const [sampleModalOpen, setSampleModalOpen] = useState(false);
  const [selectedGarmentSample, setSelectedGarmentSample] = useState<string | null>(null);
  const [sampleLoading, setSampleLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
  mountedRef.current = true;

  return () => {
    mountedRef.current = false;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const recorder = recorderRef.current;

    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      recorder.stop();
    }

    recorderRef.current = null;
    recordedChunksRef.current = [];

    clientRef.current?.disconnect();
    clientRef.current = null;

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  };
}, []);

  async function finishSession(message: string) {
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

function stopSession(message = "Live try-on ended.") {
  if (timeoutRef.current) {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }

  stopMessageRef.current = message;

  const recorder = recorderRef.current;

  if (recorder && recorder.state !== "inactive") {
    setStatus("Finalizing your recorded try-on...");
    recorder.stop();
    return;
  }

  finishSession(message);
}
  

async function startSession() {
  if (!garmentFile || running || previewUrl) {
    setError(
      previewUrl
        ? "Close the recorded preview before starting another session."
        : "Please select a garment image first.",
    );
    return;
  }

  setError(null);
  setStatus("Requesting camera access...");
  setSecondsLeft(SESSION_DURATION_SECONDS);
  recordedChunksRef.current = [];

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

    // Convert the selected garment image to JPEG for Decart.
    const decartGarment = await convertToJpeg(garmentFile);

    realtimeClient = await client.realtime.connect(cameraStream, {
      model,
      mirror: "auto",
      initialState: {
        image: decartGarment,
      },

      onRemoteStream: (transformedStream) => {
        // Display Decart's transformed video.
        if (resultVideoRef.current) {
          resultVideoRef.current.srcObject = transformedStream;

          void resultVideoRef.current.play().catch(() => {
            // Playback may require browser interaction.
          });
        }

        // Record only Decart's transformed output.
        if (recorderRef.current) {
          return;
        }

        try {
          const mimeTypeCandidates = [
            "video/webm;codecs=vp9",
            "video/webm;codecs=vp8",
            "video/webm",
            "video/mp4",
          ];

          const supportedMimeType = mimeTypeCandidates.find((type) =>
            MediaRecorder.isTypeSupported(type),
          );

          const recorder = supportedMimeType
            ? new MediaRecorder(transformedStream, {
                mimeType: supportedMimeType,
              })
            : new MediaRecorder(transformedStream);

          recordedChunksRef.current = [];
          recorderRef.current = recorder;

          recorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
              recordedChunksRef.current.push(event.data);
            }
          };

          recorder.onerror = () => {
            if (mountedRef.current) {
              setError("Recording failed. Please try again.");
            }
          };

          recorder.onstop = () => {
            const chunks = recordedChunksRef.current;
            recordedChunksRef.current = [];
            recorderRef.current = null;

            if (chunks.length > 0) {
              const blob = new Blob(chunks, {
                type: recorder.mimeType || "video/webm",
              });

              if (blob.size > 0 && mountedRef.current) {
                const url = URL.createObjectURL(blob);

                if (previewUrlRef.current) {
                  URL.revokeObjectURL(previewUrlRef.current);
                }

                previewUrlRef.current = url;
                setPreviewUrl(url);

                finishSession(
                  "Your recorded try-on is ready. Enjoy the looping preview!",
                );
                return;
              }
            }

            finishSession(stopMessageRef.current);
          };

          recorder.start();
        } catch (cause) {
          setError(
            cause instanceof Error
              ? `Could not record the Decart output: ${cause.message}`
              : "Could not record the Decart output.",
          );

          void stopSession("Recording could not start.");
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

    // Enforce the 10-second session limit.
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


  async function endPreview() {
  if (previewUrlRef.current) {
    URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
  }

  setPreviewUrl(null);
  recordedChunksRef.current = [];

  if (resultVideoRef.current) {
    resultVideoRef.current.pause();
    resultVideoRef.current.srcObject = null;
    resultVideoRef.current.removeAttribute("src");
    resultVideoRef.current.load();
  }

  setStatus("Preview closed. Choose a garment to try again.");
}


async function convertToJpeg(file: File): Promise<File> {
  const imageUrl = URL.createObjectURL(file);

  try {
    const image = new Image();
    image.src = imageUrl;
    await image.decode();

    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Could not prepare the garment image.");
    }

    context.drawImage(image, 0, 0);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (result) resolve(result);
          else reject(new Error("Could not convert garment to JPEG."));
        },
        "image/jpeg",
        0.92,
      );
    });

    return new File(
      [blob],
      `${file.name.replace(/\.[^.]+$/, "")}.jpg`,
      { type: "image/jpeg" },
    );
  } finally {
    URL.revokeObjectURL(imageUrl);
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
    const originalFile = new File([blob], filename, {
      type: blob.type || "application/octet-stream",
    });

    const file = await convertToJpeg(originalFile);

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
                  Live Try-On
                </h2>
              </div>

              <p className="mt-3 leading-7 text-slate-600">
                Experience real-time virtual try-on. Get a live
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
                disabled={running || !!previewUrl}
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
        
        {/* Right: Live video and recorded preview */}
        <div className="relative flex min-h-[300px] flex-col items-center justify-center overflow-hidden rounded-2xl border border-indigo-100 bg-slate-50 p-4 sm:min-h-[380px]">
          {running ? (
            <div className="grid w-full grid-cols-2 gap-3">
              <div className="min-w-0">
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

              <div className="min-w-0">
                <p className="mb-2 text-sm font-semibold text-slate-700">
                  Live result
                </p>
                <video
                  ref={resultVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="aspect-[3/4] w-full rounded-xl bg-gray-950 object-cover"
                />
              </div>
            </div>
          ) : previewUrl ? (
            <div className="w-full">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">
                    Your AI Try-On Replay
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Recorded Video output
                  </p>
                </div>

                <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">
                  ✨ Replay
                </span>
              </div>

              <video
                key={previewUrl}
                src={previewUrl}
                autoPlay
                loop
                muted
                playsInline
                className="aspect-[3/4] max-h-[520px] w-full rounded-xl bg-gray-950 object-contain"
              />

              <button
                type="button"
                onClick={endPreview}
                className="mt-4 w-full rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 px-5 py-3 font-semibold text-white shadow-md transition hover:brightness-105"
              >
                ✕ End Preview
              </button>
            </div>
          ) : (
            <div className="p-6 text-center">
              <div className="mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-indigo-100 text-5xl text-blue-500">
                ▣
              </div>
              <p className="font-semibold text-slate-700">
                Your recorded try-on will appear here
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Start a live session to create your 10-second preview.
              </p>
            </div>
          )}
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
