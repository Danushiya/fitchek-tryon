# Fitchek — Mini AI Try-On Web App

Fitchek is a guest-based AI virtual try-on web application that allows users to upload a person image and a garment image and generate an AI-powered try-on result.

The application uses **Next.js** for the frontend and backend API routes, **Supabase** for PostgreSQL database and private image storage, **RunPod** for asynchronous AI inference, and **Vercel** for deployment.

Users do not need to create an account. Each browser is assigned a unique guest UUID, which is used to associate generated try-on results with that guest.

---

## Features

* Guest-based usage without login or signup
* Landing, Playground, and History pages
* Person image upload with preview
* Garment image upload with preview
* Direct image uploads to private Supabase Storage
* Signed upload URLs for secure uploads
* AI virtual try-on generation through RunPod
* Asynchronous RunPod job processing
* Generation status polling
* Generation failure and timeout handling
* Retry support
* Refresh/recovery support for active generations
* Generated result storage in Supabase Storage
* Signed URLs for private result images
* Generation history filtered by guest ID
* History ordered by newest generation first
* Generation detail view with prompt and images
* Responsive UI using Tailwind CSS
* Server-side handling of sensitive API credentials
* Production deployment through Vercel

---

## Tech Stack

| Layer                | Technology                    |
| -------------------- | ----------------------------- |
| Frontend             | Next.js, React, TypeScript    |
| Styling              | Tailwind CSS                  |
| Backend              | Next.js App Router API Routes |
| Database             | Supabase PostgreSQL           |
| File Storage         | Supabase Storage              |
| AI Inference         | RunPod                        |
| Deployment           | Vercel                        |
| Guest Identification | UUID + localStorage           |

---

## Architecture

The application follows a browser → Next.js server → external services architecture.

```text
                    User Browser
                         |
                         v
                 Next.js Frontend
                         |
          +--------------+--------------+
          |                             |
          v                             v
   Supabase Storage              Next.js API Routes
   (image uploads)                       |
                                          |
                              +-----------+-----------+
                              |                       |
                              v                       v
                         Supabase DB               RunPod
                                                    AI Inference
                                                      |
                                                      v
                                               Generated Image
                                                      |
                                                      v
                                               Supabase Storage
                                                      |
                                                      v
                                               Signed Result URL
                                                      |
                                                      v
                                                   Browser
```

Sensitive credentials such as the RunPod API key and Supabase service-role key are only used by server-side code.

The browser never calls RunPod directly.

---

## Application Flow

### 1. Guest Identification

The application does not require authentication.

When a user first accesses the Playground, a UUID is generated and stored in `localStorage`.

```text
Browser
   |
   | No guest ID?
   v
Generate UUID
   |
   v
Store guest ID in localStorage
```

The guest ID is then sent with generation and history requests.

---

### 2. Image Upload

The user selects:

* Person image
* Garment image

The frontend requests a signed upload URL from:

```text
POST /api/upload-url
```

The Next.js API route creates a signed upload URL for the private Supabase Storage bucket.

The browser then uploads the image directly to Supabase Storage.

```text
Browser
   |
   | Request signed upload URL
   v
Next.js API
   |
   | Signed URL
   v
Browser
   |
   | Upload image directly
   v
Supabase Storage
```

This avoids sending large image files through the Next.js/Vercel server.

---

### 3. Start AI Generation

When the user clicks **Generate**, the frontend sends a request to:

```text
POST /api/generate
```

The request contains the guest ID, uploaded image paths, and prompt.

The backend:

1. Creates a generation record in Supabase.
2. Sets the initial status to `queued`.
3. Creates signed URLs for the input images.
4. Sends the generation request to the RunPod endpoint.
5. Receives the RunPod job ID.
6. Stores the RunPod job ID in the generation record.
7. Returns the generation ID to the frontend.

---

### 4. RunPod Job Processing

The application uses the asynchronous RunPod `/run` endpoint.

It does not use `/runsync`.

RunPod returns a job ID immediately, while the AI generation continues asynchronously.

```text
Next.js API
     |
     | POST /run
     v
RunPod
     |
     | job_id
     v
Next.js
     |
     v
Frontend starts polling
```

---

### 5. Generation Status Polling

The frontend periodically calls:

```text
GET /api/generate/{id}
```

The backend uses the stored RunPod job ID to check the RunPod status.

Possible statuses include:

```text
IN_QUEUE
IN_PROGRESS
COMPLETED
FAILED
CANCELLED
TIMED_OUT
```

The frontend continues polling while the job is still processing.

Polling stops when the job completes or fails.

---

### 6. Save Generated Result

When RunPod reports that the job is completed:

1. The backend retrieves the generated image.
2. The image is downloaded by the server.
3. The image is uploaded to the private Supabase Storage bucket.
4. The resulting Storage path is saved in the database.
5. The generation status is updated to `completed`.
6. `completed_at` is recorded.

The result is stored in our own Supabase Storage because the RunPod output URL is temporary.

---

### 7. Display Result

The frontend requests:

```text
GET /api/generate/{id}/result
```

The backend creates a temporary signed URL for the private result image.

The signed URL is returned to the frontend and used to display the generated image.

```text
Frontend
   |
   v
/api/generate/{id}/result
   |
   v
Supabase Storage
   |
   | Signed URL
   v
Frontend
   |
   v
Generated Try-On Image
```

---

### 8. Refresh Recovery

The active generation ID is stored in `localStorage`.

If the user refreshes the browser while generation is still running:

```text
Browser Refresh
      |
      v
Read active generation ID
      |
      v
Resume polling
      |
      v
Continue until completed/failed
```

This prevents the frontend from losing track of an active generation.

---

### 9. History

The History page calls:

```text
GET /api/history?guest_id={guest_id}
```

The backend retrieves generations belonging to that guest and orders them by creation time in descending order.

Each history item can contain:

* Person image
* Garment image
* Generated result
* Prompt
* Status
* Creation date
* Completion date
* Error information

The History page displays the newest generations first.

---

# Project Structure

```text
fitchek-tryon/
│
├── app/
│   ├── page.tsx
│   │
│   ├── playground/
│   │   └── page.tsx
│   │
│   ├── history/
│   │   └── page.tsx
│   │
│   └── api/
│       ├── upload-url/
│       │   └── route.ts
│       │
│       ├── generate/
│       │   ├── route.ts
│       │   │
│       │   └── [id]/
│       │       ├── route.ts
│       │       │
│       │       └── result/
│       │           └── route.ts
│       │
│       └── history/
│           └── route.ts
│
| 
|── components/
│   │   ├── Navbar.tsx
│   │   └── ImageUpload.tsx
│   │
│   └── lib/
│       ├── guest.ts
│       └── supabase/
│           └── server.ts
│
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

---

# Important Files

## `app/page.tsx`

Landing page for the application.

Provides the initial introduction and navigation to the Playground.

---

## `app/playground/page.tsx`

Main try-on interface.

Responsible for:

* Image selection
* Upload handling
* Prompt
* Generate action
* Generation status
* Polling
* Error handling
* Retry
* Refresh recovery
* Result display

---

## `app/history/page.tsx`

Displays the user's previous generations.

Handles:

* History loading
* History cards
* Empty state
* Generation details
* Result preview

---

## `components/Navbar.tsx`

Reusable navigation component used to navigate between:

* Home
* Playground
* History

---

## `components/ImageUpload.tsx`

Reusable image upload component.

Provides:

* File selection
* Image preview
* Upload interaction
* Upload status

---

## `lib/guest.ts`

Creates and retrieves the browser's guest UUID.

The guest ID is stored in `localStorage` and is used to associate generations with the current guest.

---

## `lib/supabase/server.ts`

Creates the server-side Supabase client.

This file is used by the Next.js API routes to access:

* Supabase PostgreSQL
* Supabase Storage

The service-role credential is kept server-side.

---

# Backend API Routes

## `POST /api/upload-url`

Creates a signed upload URL for Supabase Storage.

Used before uploading person and garment images.

---

## `POST /api/generate`

Starts a new try-on generation.

Responsibilities:

* Validate generation request
* Create database record
* Generate signed input URLs
* Start RunPod job
* Store RunPod job ID
* Return generation ID

---

## `GET /api/generate/[id]`

Checks the status of an existing generation.

Responsibilities:

* Retrieve generation information
* Check RunPod job status
* Handle queue/in-progress states
* Handle failures and timeouts
* Download completed output
* Store completed result in Supabase
* Update database status

---

## `GET /api/generate/[id]/result`

Creates a signed URL for a completed result stored in the private Supabase Storage bucket.

---

## `GET /api/history`

Retrieves generation history for a guest.

Results are ordered from newest to oldest.

---

# Environment Variables

Create a local `.env.local` file.

Use `.env.example` as the template.

Example:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

SUPABASE_SERVICE_ROLE_KEY=

RUNPOD_API_KEY=
RUNPOD_ENDPOINT_ID=
```

### Variable descriptions

| Variable                        | Purpose                     | Client exposed?      |
| ------------------------------- | --------------------------- | -------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase project URL        | Yes                  |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key      | Yes                  |
| `SUPABASE_SERVICE_ROLE_KEY`     | Server-side Supabase access | No                   |
| `RUNPOD_API_KEY`                | RunPod API authentication   | No                   |
| `RUNPOD_ENDPOINT_ID`            | RunPod inference endpoint   | Server configuration |

**Never commit `.env.local` or any file containing real secrets.**

Only `.env.example` should contain empty/example values.

---

# Local Setup

## 1. Clone the repository

```bash
git clone <repository-url>
cd fitchek-tryon
```

---

## 2. Install dependencies

```bash
npm install
```

---

## 3. Configure environment variables

Create:

```text
.env.local
```

Add the required values:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
RUNPOD_API_KEY=your_runpod_api_key
RUNPOD_ENDPOINT_ID=your_runpod_endpoint_id
```

Do not commit this file.

---

## 4. Set up Supabase

Create a Supabase project.

Create a private Storage bucket named:

```text
tryon
```

Enable Row Level Security on the `generations` table.

Use the following SQL schema.

---

# Database Schema

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

The application stores generation metadata in this table.

---

# Storage Structure

The private `tryon` bucket uses paths similar to:

```text
inputs/
  {guest_id}/
    person-image
    garment-image

results/
  {generation_id}.webp
```

The exact uploaded filenames/extensions may vary depending on the uploaded files and implementation.

---

# Security

The application follows these security practices:

* No authentication credentials are exposed to the browser.
* RunPod API key is server-side only.
* Supabase service-role key is server-side only.
* `.env.local` is excluded from Git.
* `.env.example` contains no real credentials.
* Supabase Storage bucket is private.
* Signed URLs are used for private files.
* Database access is handled through server-side API routes.
* RLS is enabled on the database.
* The browser does not call RunPod directly.
* No API secrets are stored in frontend code.

---

# Git and Secret Safety

Before pushing changes, verify that environment files are not tracked:

```bash
git ls-files | grep -E '(^|/)\.env'
```

Expected output should only include:

```text
.env.example
```

Check the repository status:

```bash
git status
```

The working tree should not contain `.env.local` or other secret files.

If a secret has ever been committed to Git, removing it from the latest commit is not sufficient. The Git history must be reviewed and the credential should be rotated immediately.

---

# Running the Application

Start the development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

Available pages:

```text
/
```

Landing page.

```text
/playground
```

AI try-on generation.

```text
/history
```

Generation history.

---

# Production Build

To verify the production build locally:

```bash
npm run build
```

Then run:

```bash
npm start
```

---

# Deployment

The application is deployed using Vercel.

Required environment variables must be configured in the Vercel project settings.

Production architecture:

```text
GitHub
   |
   v
Vercel
   |
   v
Next.js
   |
   +------> Supabase
   |
   +------> RunPod
```

---

# Trade-offs and Design Decisions

## Guest ID instead of Authentication

### Advantage

Users can immediately try the application without creating an account.

### Trade-off

There is no permanent user identity across devices or browsers.

Clearing local storage can also result in a new guest ID.

---

## Direct Storage Upload

### Advantage

Large image files do not need to pass through the Vercel server.

### Trade-off

The upload flow is slightly more complex because the frontend first requests a signed upload URL.

---

## RunPod Async `/run` + Polling

### Advantage

Long-running AI jobs do not require a single long-lived HTTP request.

### Trade-off

The frontend must periodically poll for status.

---

## Private Supabase Storage + Signed URLs

### Advantage

Uploaded and generated images are not publicly accessible.

### Trade-off

Signed URLs expire and must be generated again when needed.

---

## Persisting Results in Supabase

### Advantage

The application owns a persistent copy of the generated result rather than relying on a temporary RunPod output URL.

### Trade-off

The application consumes Supabase Storage space for generated results.

---

## No Login

### Advantage

Very low friction for trying the application.

### Trade-off

Guest history is tied to the browser's stored guest ID rather than a user account.

---

# Known Issues / Limitations

* The application currently uses guest-based identification rather than full user authentication.
* Clearing browser `localStorage` creates a new guest ID, so previous history will no longer be associated with that browser session.
* Signed Storage URLs expire and must be regenerated when needed.
* AI generation time depends on RunPod queue and inference performance.
* Generation polling has a maximum timeout to prevent indefinite polling.
* The underlying AI model is provided through the configured RunPod endpoint; the application itself does not run the model locally.
* Generated images consume Supabase Storage capacity.
* Downloading a cross-origin signed Storage URL may not reliably force a browser download in every browser; a server-side download response can be used to enforce `Content-Disposition: attachment`.

---

# Error Handling

The application handles:

* Missing images
* Invalid generation requests
* Upload failures
* RunPod API failures
* RunPod failed jobs
* Cancelled jobs
* Timed-out jobs
* Missing generation results
* Missing Storage results
* Generation recovery after browser refresh

Users can retry failed generations from the Playground.

---

# Testing Checklist

Before deployment, verify:

```text
[ ] Landing page loads
[ ] Playground loads
[ ] History loads
[ ] Person image can be selected
[ ] Garment image can be selected
[ ] Image previews work
[ ] Generate is disabled until required inputs exist
[ ] Images upload to Supabase
[ ] Generation record is created
[ ] RunPod job starts
[ ] Generation status updates
[ ] Completed result is stored
[ ] Result is displayed
[ ] History contains completed generation
[ ] History is newest-first
[ ] Refresh during generation recovers the job
[ ] Failed generation shows an error
[ ] Retry works
[ ] Empty history state works
[ ] Production build succeeds
[ ] No secrets are tracked in Git
[ ] Production environment variables are configured
```

