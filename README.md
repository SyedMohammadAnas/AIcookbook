# Recipe Extractor from Instagram Reels

A multi-stage pipeline for extracting cooking recipes from Instagram Reels, converting audio to text, and generating structured recipe data using local LLMs.

## Project Structure

```
data-extractor/
├── services/
│   ├── api/              # Next.js API service (Instagram downloader)
│   ├── transcription/    # Whisper transcription service (planned)
│   └── llm-processor/    # Local LLM processing service (planned)
├── docs/                 # Documentation and planning
└── README.md
```

## Storage Structure

All media and artifacts are stored on the host machine:

```
E:\media-store\
└── reels\
    └── {shortcode}\
        ├── video.mp4      # Downloaded video
        ├── audio.wav      # Extracted audio (planned)
        ├── transcript.txt # Transcription (planned)
        └── metadata.json  # Reel metadata
```

## Services

### 1. API Service (Current - Running)

**Location:** `services/api/`

**Status:** ✅ Running in Docker

**Container:** `instagram-downloader`

**Port:** 3000

**Endpoints:**
- `GET /api/video` - Get Instagram Reel metadata (working)
- `POST /api/jobs/download` - Download and save video (next to implement)

**Docker:**
```bash
# Container is running with:
# - Port mapping: 3000:3000
# - Volume: E:\media-store → /data
```

### 2. Transcription Service (Planned)

**Location:** `services/transcription/`

**Technology:** faster-whisper (https://github.com/SYSTRAN/faster-whisper)

**Purpose:**
- Convert video audio to WAV format using FFmpeg
- Transcribe audio to English text
- Support: Hindi, Telugu, English, Tamil → English

### 3. LLM Processor Service (Planned)

**Location:** `services/llm-processor/`

**Purpose:**
- Combine transcription + Instagram caption
- Process with local LLM
- Generate structured recipe JSON

## Pipeline Stages

### Stage 1: Media Ingestion (In Progress)
1. Download Instagram Reel video ✅
2. Convert video → audio (planned)
3. Transcribe audio using Whisper (planned)
4. Store all artifacts locally (partial)

### Stage 2: Intelligence (Planned)
1. Combine transcription + caption
2. Send to local LLM
3. Produce structured recipe JSON

### Stage 3: Application Use (Planned)
1. Serve processed recipe data via API
2. Display in cookbook UI

## Current Progress

- ✅ Next.js API service running in Docker
- ✅ Instagram metadata extraction working
- ✅ Storage mount configured (E:\media-store → /data)
- ✅ Project structure organized
- 🔄 Video download endpoint (next step)
- ⏳ Audio extraction with FFmpeg
- ⏳ Whisper transcription integration
- ⏳ LLM processing

## Next Steps

1. Implement `POST /api/jobs/download` endpoint
2. Add FFmpeg for audio extraction
3. Integrate faster-whisper for transcription
4. Set up local LLM service
5. Create docker-compose for multi-container orchestration

## Design Principles

- No heavy processing in synchronous public APIs
- File system is the source of truth between stages
- Each stage produces reusable artifacts
- Container separation for scalability
- Windows host, Linux containers
