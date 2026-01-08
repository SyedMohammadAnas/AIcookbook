# Project Structure

## 📁 Complete File Tree

```
data-extractor/
│
├── 📄 README.md                    # Project overview & architecture
├── 📄 QUICKSTART.md                # 5-minute setup guide ⭐ START HERE
├── 📄 SUMMARY.md                   # What we've accomplished
├── 📄 PROGRESS.md                  # Detailed progress tracker
├── 📄 NEXT-STEPS.md                # Step-by-step next actions
├── 📄 PROJECT-STRUCTURE.md         # This file
├── 📄 docker-compose.yml           # Multi-service orchestration
│
├── 📂 docs/                        # Documentation
│   ├── master-plan.md              # Original requirements & design
│   ├── api-endpoints.md            # Complete API documentation
│   ├── testing-guide.md            # Testing commands & validation
│   └── transcription-setup.md      # faster-whisper implementation plan
│
└── 📂 services/                    # All microservices
    │
    ├── 📂 api/                     # ✅ READY - Instagram downloader
    │   ├── Dockerfile
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── next.config.js
    │   └── src/
    │       └── app/
    │           └── api/
    │               ├── video/
    │               │   └── route.ts            # GET - Fetch metadata
    │               └── jobs/
    │                   ├── download/
    │                   │   └── route.ts        # POST - Download video
    │                   └── process/
    │                       └── route.ts        # POST - Complete process
    │
    ├── 📂 transcription/           # ⏳ NEXT - Whisper service
    │   └── (to be created)
    │       ├── Dockerfile
    │       ├── requirements.txt
    │       ├── app.py              # Flask API
    │       ├── transcribe.py       # Whisper logic
    │       └── audio_extractor.py  # FFmpeg wrapper
    │
    └── 📂 llm-processor/           # ⏳ FUTURE - Recipe generation
        └── (to be created)
            ├── Dockerfile
            ├── requirements.txt
            └── app.py              # LLM service
```

---

## 🗄️ Storage Structure

```
E:\media-store\
└── reels\
    └── {shortcode}/                # e.g., DTQpr8DjlkU
        ├── video.mp4               # ✅ Downloaded video (Stage 1)
        ├── audio.wav               # ⏳ Extracted audio (Stage 1)
        ├── transcript.txt          # ⏳ Transcription (Stage 1)
        └── metadata.json           # ✅ All metadata
```

---

## 🐳 Docker Containers

| Container | Port | Status | Purpose |
|-----------|------|--------|---------|
| `recipe-extractor-api` | 3000 | ✅ Running | Instagram downloader API |
| `recipe-extractor-transcription` | 5000 | ⏳ Planned | Whisper transcription |
| `recipe-extractor-llm` | 8000 | ⏳ Planned | Recipe generation |

---

## 🔌 API Endpoints

### Current (Working)
```
GET  /api/video                     # Fetch Instagram metadata
POST /api/jobs/download             # Download video
POST /api/jobs/process              # Complete: metadata + download
```

### Planned (Transcription Service)
```
POST /transcribe                    # Extract audio + transcribe
GET  /health                        # Health check
```

### Planned (LLM Service)
```
POST /generate-recipe               # Generate recipe JSON
GET  /health                        # Health check
```

### Planned (Query Service)
```
GET  /api/recipe/{shortcode}        # Get complete recipe
GET  /api/recipes                   # List all recipes
```

---

## 📊 Pipeline Stages

```
┌─────────────────────────────────────────────────────────────────┐
│                    STAGE 1: MEDIA INGESTION                     │
│                         (70% Complete)                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Input: Instagram Reel URL                                      │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ 1. Fetch Metadata (✅ Done)                            │    │
│  │    GET /api/video                                      │    │
│  │    → shortcode, caption, video URL                     │    │
│  └────────────────────────────────────────────────────────┘    │
│                         ↓                                       │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ 2. Download Video (✅ Done, needs testing)             │    │
│  │    POST /api/jobs/download                             │    │
│  │    → video.mp4 saved                                   │    │
│  └────────────────────────────────────────────────────────┘    │
│                         ↓                                       │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ 3. Extract Audio (⏳ Next)                             │    │
│  │    POST /transcribe (FFmpeg)                           │    │
│  │    → audio.wav saved                                   │    │
│  └────────────────────────────────────────────────────────┘    │
│                         ↓                                       │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ 4. Transcribe (⏳ Next)                                │    │
│  │    faster-whisper                                      │    │
│  │    → transcript.txt (English)                          │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                 │
│  Output: video.mp4, audio.wav, transcript.txt, metadata.json   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    STAGE 2: INTELLIGENCE                        │
│                         (0% Complete)                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Input: transcript.txt + caption                                │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ 1. Combine Data                                        │    │
│  │    transcript + caption → prompt                       │    │
│  └────────────────────────────────────────────────────────┘    │
│                         ↓                                       │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ 2. Send to Local LLM                                   │    │
│  │    POST /generate-recipe                               │    │
│  └────────────────────────────────────────────────────────┘    │
│                         ↓                                       │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ 3. Parse JSON Response                                 │    │
│  │    {                                                   │    │
│  │      "title": "...",                                   │    │
│  │      "ingredients": [...],                             │    │
│  │      "instructions": [...]                             │    │
│  │    }                                                   │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                 │
│  Output: recipe.json                                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                  STAGE 3: APPLICATION USE                       │
│                         (0% Complete)                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ 1. Recipe API                                          │    │
│  │    GET /api/recipe/{shortcode}                         │    │
│  │    → Complete recipe data                              │    │
│  └────────────────────────────────────────────────────────┘    │
│                         ↓                                       │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ 2. Frontend Display                                    │    │
│  │    - Recipe page                                       │    │
│  │    - Ingredient list                                   │    │
│  │    - Step-by-step instructions                         │    │
│  │    - Original video embed                              │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                 │
│  Output: Beautiful cookbook UI                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Quick Navigation

**Just starting?**
→ Read `QUICKSTART.md` (5 minutes)

**Want to understand what's done?**
→ Read `SUMMARY.md`

**Ready to continue building?**
→ Read `NEXT-STEPS.md`

**Need API details?**
→ Read `docs/api-endpoints.md`

**Want to test?**
→ Read `docs/testing-guide.md`

**Planning transcription?**
→ Read `docs/transcription-setup.md`

**Track progress?**
→ Read `PROGRESS.md`

---

## 🔑 Key Files Explained

### Root Level
- **QUICKSTART.md** - Get running in 5 minutes
- **SUMMARY.md** - High-level overview of accomplishments
- **PROGRESS.md** - Detailed checklist with completion status
- **NEXT-STEPS.md** - Actionable steps for next phase
- **README.md** - Project architecture and design philosophy
- **docker-compose.yml** - Multi-container orchestration

### docs/
- **master-plan.md** - Your original requirements (preserved)
- **api-endpoints.md** - Complete API documentation with examples
- **testing-guide.md** - Commands for testing and validation
- **transcription-setup.md** - faster-whisper implementation guide

### services/api/
- **src/app/api/video/route.ts** - Instagram metadata endpoint
- **src/app/api/jobs/download/route.ts** - Video download logic
- **src/app/api/jobs/process/route.ts** - One-call convenience endpoint

---

## 📦 Dependencies

### API Service (Node.js)
- Next.js 14
- TypeScript
- Cheerio (HTML parsing)
- React Query

### Transcription Service (Python) - Planned
- faster-whisper
- FFmpeg
- Flask/FastAPI

### LLM Service (Python) - Planned
- Local LLM (TBD)
- FastAPI

---

## 🎓 Technologies Used

| Technology | Purpose | Status |
|------------|---------|--------|
| Next.js 14 | API framework | ✅ In use |
| TypeScript | Type safety | ✅ In use |
| Docker | Containerization | ✅ In use |
| faster-whisper | Transcription | ⏳ Planned |
| FFmpeg | Audio extraction | ⏳ Planned |
| Local LLM | Recipe generation | ⏳ Planned |

---

## 💾 Data Flow

```
Instagram URL
    ↓
[API Service] → Fetch metadata
    ↓
[API Service] → Download video → video.mp4
    ↓
[Transcription Service] → Extract audio → audio.wav
    ↓
[Transcription Service] → Transcribe → transcript.txt
    ↓
[LLM Service] → Generate recipe → recipe.json
    ↓
[API Service] → Serve to frontend
    ↓
Beautiful Recipe Page
```

---

**All files are organized and ready to go! Start with `QUICKSTART.md` 🚀**
