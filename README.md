# Fitchek — Mini AI Try-On Web App

Fitchek is a web app for trying on clothes virtually. It offers two experiences: create a saved try-on image from a person photo and a garment photo, or preview a garment on a live camera feed for a short session.

The app uses a guest ID stored in the browser, so users can try it without signing in. Saved generations are associated with that browser’s guest ID and shown on the History page.

## Features

- Upload a person photo and garment image, or use the built-in sample images.
- Generate a try-on image using an asynchronous RunPod inference job.
- Track generation progress and resume polling after a page refresh.
- View and download completed results; browse previous generations in History.
- Try a garment against a live camera feed with Decart, then replay a short recording.
- Keep uploaded and generated images in a private Supabase Storage bucket, using signed URLs for access.

## How it works

### Saved image generation

1. The browser creates or retrieves a guest UUID from `localStorage`.
2. The user selects a person image and a garment image. They may upload files or choose samples.
3. The browser asks `POST /api/upload-url` for a signed upload token, then uploads each image directly to Supabase Storage.
4. On **Generate**, the browser sends the guest ID, storage paths, and prompt to `POST /api/generate`.
5. The server creates a database record, creates temporary signed URLs for the inputs, and submits the request to RunPod.
6. The browser polls `GET /api/generate/[id]`. When RunPod completes, the server downloads the output, saves it in Supabase Storage, and updates the database record.
7. The browser requests `GET /api/generate/[id]/result` for a temporary signed URL and displays the image.

### Live camera try-on

1. The user chooses a garment and grants camera access.
2. The browser requests `POST /api/realtime-token`. The server uses `DECART_API_KEY` to create a short-lived Decart token.
3. The browser connects the camera stream and garment image to Decart’s `lucy-vton-3.6` realtime model.
4. The component displays the camera and transformed video, records the transformed stream for up to 10 seconds, and offers a looping replay.

Live sessions are separate from saved generations: they do not create a generation record or add a replay to History.

## Tech stack

- Next.js App Router 16, React 19, and TypeScript
- Tailwind CSS 4
- Supabase PostgreSQL and Storage
- RunPod for saved image generation
- Decart SDK for live try-on

## Getting started

### Requirements

- Node.js and npm
- A Supabase project
- A RunPod endpoint configured for the try-on model
- A Decart API key to use live try-on

### Install and configure

```bash
npm install
cp .env.example .env.local
```

Fill in `.env.local` with the credentials for your services:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
RUNPOD_API_KEY=your_runpod_api_key
RUNPOD_ENDPOINT_ID=your_runpod_endpoint_id
DECART_API_KEY=your_decart_api_key
```

`NEXT_PUBLIC_SUPABASE_URL` is also used by the browser for direct Storage uploads. Keep the Supabase service-role key, RunPod key, and Decart key secret; never use a `NEXT_PUBLIC_` prefix for them or commit `.env.local`.

### Set up Supabase

Create a **private** Storage bucket named `tryon`.

Create the `generations` table and index in the Supabase SQL editor:

```sql
create table generations (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null,
  person_path text not null,
  garment_path text not null,
  prompt text not null,
  status text not null default 'queued',
  runpod_job_id text,
  result_path text,
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index on generations (guest_id, created_at desc);
```

The server Supabase client uses the service-role key. Configure database access and Row Level Security policies to suit your deployment; the service-role key bypasses RLS, so it must remain server-side. This app uses a browser-stored guest ID rather than account authentication, so that ID is an organizer for history, not proof of identity.

### Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Other project scripts:

```bash
npm run build  # Build for production
npm start      # Serve the production build
npm run lint   # Run ESLint
```

## Pages

| Path | Description |
| --- | --- |
| `/` | Landing page with a link to start a try-on. |
| `/playground` | Upload or select images, edit the prompt, run saved generation, or use live try-on. |
| `/history` | View saved generations associated with the current browser’s guest ID. |

## API routes

| Method and path | Purpose |
| --- | --- |
| `POST /api/upload-url` | Creates a signed upload token and storage path for an input image. |
| `POST /api/generate` | Creates a generation record and submits a RunPod job. |
| `GET /api/generate/[id]` | Checks RunPod status and persists completed output or failure state. |
| `GET /api/generate/[id]/result` | Returns a one-hour signed URL for a completed result image. |
| `GET /api/history?guest_id=...` | Returns saved generations for a guest, with signed image URLs. |
| `POST /api/realtime-token` | Creates a temporary Decart token for the live camera session. |

## Project structure

```text
app/
  api/
    generate/                 Start a generation
      [id]/                    Poll job status
        result/                Get signed result URL
    history/                   Load guest history
    realtime-token/            Create Decart token
    upload-url/                Create signed image upload token
  history/page.tsx             History UI
  playground/page.tsx          Main try-on UI and generation polling
  page.tsx                      Landing page
components/
  ImageUpload.tsx              Validates and uploads an image
  LiveTryOn.tsx                Camera, Decart connection, and replay
  Navbar.tsx                   Main navigation
  SamplePickerModal.tsx        Reusable sample image picker
lib/
  guest.ts                      Browser guest ID helper
  samples.ts                    Live try-on sample garments
  supabase/server.ts            Server-side Supabase client
public/                         Logo and sample images
```

## Storage and data

Input images are stored under `inputs/{guestId}/{uniqueFileName}`. Completed outputs are stored under `results/{generationId}.webp`. The bucket is private; the app creates signed URLs when a client needs to upload or display an image. Signed URLs expire, while the stored image remains available for a new URL to be issued.

The `generations` table stores the input paths, prompt, status, RunPod job ID, result path, errors, and timestamps. The guest ID is kept in the browser’s `localStorage`; clearing browser storage or using another browser creates a different guest ID and will not show the old guest’s history.

## Notes and limitations

- Saved generation depends on the configured RunPod endpoint and its output shape. RunPod queue and inference times affect how long it takes.
- Live try-on requires camera permission, a supported browser, Decart credentials, and network access. Its recording is an in-browser replay and is not saved to Supabase.
- Input uploads are limited to 10 MB in the standard `ImageUpload` component. The live try-on garment input is handled separately.
- Signed URLs grant temporary access to whoever has the link. Avoid logging or sharing them unnecessarily.
- The app does not provide user accounts, cross-device history, or server-side ownership checks based on authentication.

## Deployment

Deploy as a Next.js application (for example, on Vercel). Set all required environment variables in the deployment environment, create the Supabase table and private bucket, and configure the RunPod endpoint and Decart API key. Do not put server secrets in client-exposed variables.
