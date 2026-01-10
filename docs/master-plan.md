help me do it by first discussing and taking it step by step and not dump all sort of knowledge or instructions to start right away
even after starting dont wait till we finish each step and confirm we validated and sucessfully finished the current step

so all this will be happening in this current windows laptop which i repurposed to act as my personal server to host some backend and store data and media and I want to use docker to handle such stuffs, so keep that in mind

i want to give the complete context that I am trying to next js application that will
take an instagram reel link related to cooking instructions and recepies and it will store it in our application like we added a new recepie in our cookbook and provides all the instructions and necessary ingredients mentioned in the referred reel in one place

how i planned of making this work is that we convert that reel video into audio and transcribes that into english text (because our application primarily focuses on indian audience so we will be converting only Hindi, Telugu, English, Tamil Audio into English transcription

and then we can use that data and any rest of the instructions in the caption and we will make an api endpoint which will give this both transcribed-data and caption, we will then feed this into an local hosted LLM and it will process it naturally and will give us out a proper json which we will finally take that and use it to display in our new recepie page of our cookbook


so three stages
-instagram reel downloading and convert to audio
-audio + caption sent to our LLM
-proper response being sent back and will be used to show in our application


As you can see that we made the instagram-downloader and its up and runnning
E:\data-extractor\instagram-downloader
and we set that up in our docker too

1. Project Context (Agreed Understanding)

You are building a Next.js 14 backend (running inside Docker on a Windows laptop acting as a personal server) for a cookbook-style application that:

Accepts Instagram Reel URLs (primarily cooking/recipe reels)

Extracts:

Video

Audio

Transcription (English output)

Caption text

Uses a local LLM later to convert this into a structured recipe JSON

Serves this data to a frontend as a “recipe page”

Everything is designed as a multi-stage, local-first pipeline, managed via Docker.

2. High-Level Pipeline Design (Finalized)

The processing pipeline is explicitly stage-based:

Stage 1 — Media Ingestion

Download Instagram Reel video

Convert video → audio

Transcribe audio using local open-source Whisper

Store all artifacts locally

Stage 2 — Intelligence

Combine transcription + caption

Send to locally hosted LLM

Produce clean, structured recipe JSON

Stage 3 — Application Use

Serve processed recipe data via API

Display in cookbook UI

Only Stage 1 is in scope right now.

3. Architectural Decisions (Final, No Reversals)
Decision 1: Container Architecture

Option B chosen and locked

Responsibilities are separated conceptually:

API = orchestration + metadata

Media ingestion = job-based processing

Whisper / LLM = independent workers later

This avoids coupling slow, failure-prone tasks to request/response APIs.

Decision 2: API Responsibility Split

/api/video

Metadata only

Fast, synchronous

Already implemented and working

New internal job endpoint (to be added next)

Handles downloading and saving video files

Will later expand to audio + transcription

Designed to be moved into a worker container without refactor

This keeps the API clean and future-proof.

4. Storage Contract (Implemented and Validated)
Host Machine (Windows)

Base directory:

E:\media-store

Canonical Layout (Locked)
E:\media-store\
  reels\
    {shortcode}\
      video.mp4
      audio.wav
      transcript.txt
      metadata.json


{shortcode} = Instagram reel shortcode (e.g., DTQpr8DjlkU)

One reel = one directory

All intermediate and final artifacts live together

Container View

Host directory mounted as:

/data


Inside container:

/data/reels/{shortcode}/

5. Docker State (Current)

API runs inside a Linux-based Docker container

Container name:

instagram-downloader


Container started via docker run, not docker-compose

Port mapping:

3000:3000


Volume mapping (validated):

E:\media-store  →  /data


Validation performed:

/data exists inside container

Read/write access confirmed

No errors

6. Current API Status

Framework: Next.js 14.2.33

Running inside Docker

Confirmed healthy via logs:

Startup successful

Ready state reached

Existing endpoint:

GET /api/video


Accepts Instagram Reel URL

Returns enhanced metadata

Includes direct medias[0].url (MP4)

Example response already tested and working

7. What Is Explicitly NOT Done Yet (Intentionally)

Video download logic

FFmpeg audio extraction

Whisper transcription

Any LLM integration

docker-compose migration

Worker containers

These are deferred by design, not oversight.

8. Immediate Next Implementation Target (for Cursor)

Add one new internal endpoint (exact naming flexible):

POST /api/jobs/download


Responsibilities:

Input:

shortcode

mediaUrl

Actions:

Create /data/reels/{shortcode}/

Download MP4

Save as video.mp4

Output:

Success / failure

File path confirmation

Validation criterion:

E:\media-store\reels\DTQpr8DjlkU\video.mp4


exists after execution.

9. Key Design Principles (Do Not Violate)

No heavy processing in synchronous public APIs

File system is the source of truth between stages

Each stage produces reusable artifacts

Everything must remain compatible with container separation later

Windows host, Linux containers — always assume Linux tooling inside containers
