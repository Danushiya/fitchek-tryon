
"use client";

type SamplePickerModalProps = {
  open: boolean;
  title: string;
  samples: string[];
  selectedSample: string | null;
  onSelect: (sample: string) => void;
  onClose: () => void;
  onProceed: () => void;
  loading?: boolean;
};

export default function SamplePickerModal({
  open,
  title,
  samples,
  selectedSample,
  onSelect,
  onClose,
  onProceed,
  loading = false,
}: SamplePickerModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sample-modal-title"
        className="w-full max-w-4xl rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl sm:p-8"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-between gap-4">
          <h2
            id="sample-modal-title"
            className="text-xl font-bold text-gray-900 sm:text-2xl"
          >
            {title}
          </h2>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close sample picker"
            disabled={loading}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gray-100 text-2xl hover:bg-gray-200 disabled:opacity-50"
          >
            ×
          </button>
        </div>

        <div className="grid max-h-[55vh] grid-cols-2 gap-4 overflow-y-auto sm:grid-cols-3 sm:gap-5">
          {samples.map((sample) => {
            const selected = selectedSample === sample;

            return (
              <button
                key={sample}
                type="button"
                disabled={loading}
                onClick={() => onSelect(sample)}
                aria-pressed={selected}
                aria-label={`Select ${sample.split("/").pop()}`}
                className={`relative flex aspect-[4/5] items-center justify-center overflow-hidden rounded-2xl border-2 bg-gray-50 p-2 transition ${
                  selected
                    ? "border-blue-600 ring-4 ring-blue-100"
                    : "border-transparent hover:border-gray-300"
                }`}
              >
                <img
                  src={sample}
                  alt={`Sample ${sample.split("/").pop()}`}
                  className="h-full w-full rounded-xl object-contain"
                />

                {selected && (
                  <span className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-lg font-bold text-white shadow-md">
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onProceed}
          disabled={!selectedSample || loading}
          className="mt-6 w-full rounded-full bg-blue-600 px-6 py-5 text-lg font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {loading ? "Uploading sample..." : "Proceed"}
        </button>
      </div>
    </div>
  );
}
