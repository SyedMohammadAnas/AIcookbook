# Transcription Service Quick Start

## 🎯 Goal
Build and test the transcription service that:
1. Extracts audio from video using FFmpeg
2. Transcribes audio to English using faster-whisper
3. Supports Hindi, Telugu, Tamil, English (auto-detect)

---

## 📋 Prerequisites

Before starting, ensure:
- ✅ API service is running
- ✅ You have at least one downloaded video (from previous quickstart)
- ✅ Docker is running

**Verify you have a video:**
```powershell
Get-ChildItem E:\media-store\reels\DTQpr8DjlkU\video.mp4
```

---

## 🚀 Step 1: Build Transcription Service (3-5 min)

### Option A: Using Docker Compose (Recommended)

```powershell
cd E:\data-extractor

# Stop existing containers
docker-compose down

# Build and start all services
docker-compose up -d

# Wait for startup (Whisper model download takes time on first run)
Start-Sleep -Seconds 30

# Check logs
docker-compose logs transcription
```

**Look for:** `"Loading Whisper model (small)..."` and `"Whisper model loaded successfully"`

### Option B: Standalone Docker Build

```powershell
cd E:\data-extractor\services\transcription

# Build image
docker build -t recipe-extractor-transcription .

# Run container
docker run -d -p 5000:5000 -v E:\media-store:/data --name recipe-extractor-transcription recipe-extractor-transcription

# Check logs
docker logs recipe-extractor-transcription -f
```

---

## 🧪 Step 2: Test Health Check (30 sec)

```powershell
curl http://localhost:5000/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "service": "transcription",
  "version": "1.0.0"
}
```

---

## 🎵 Step 3: Test Audio Extraction (1 min)

```powershell
curl -X POST http://localhost:5000/extract-audio `
  -H "Content-Type: application/json" `
  -d '{"shortcode": "DTQpr8DjlkU"}'
```

**Expected Response:**
```json
{
  "success": true,
  "shortcode": "DTQpr8DjlkU",
  "audioPath": "/data/reels/DTQpr8DjlkU/audio.wav",
  "duration": 45.3,
  "processingTime": 2.5
}
```

**Verify Audio File:**
```powershell
Get-ChildItem E:\media-store\reels\DTQpr8DjlkU\audio.wav
```

You should see `audio.wav` file (several hundred KB to few MB).

---

## 📝 Step 4: Test Transcription (1-2 min)

```powershell
curl -X POST http://localhost:5000/transcribe `
  -H "Content-Type: application/json" `
  -d '{"shortcode": "DTQpr8DjlkU"}'
```

**Expected Response:**
```json
{
  "success": true,
  "shortcode": "DTQpr8DjlkU",
  "audioPath": "/data/reels/DTQpr8DjlkU/audio.wav",
  "transcriptPath": "/data/reels/DTQpr8DjlkU/transcript.txt",
  "transcript": "First, heat oil in a pan. Add cumin seeds...",
  "detectedLanguage": "hi",
  "languageProbability": 0.9876,
  "duration": 45.3,
  "processingTime": 12.5
}
```

**Verify Transcript File:**
```powershell
Get-ChildItem E:\media-store\reels\DTQpr8DjlkU\transcript.txt
Get-Content E:\media-store\reels\DTQpr8DjlkU\transcript.txt
```

You should see the transcribed text in English!

---

## ✅ Step 5: Verify Complete Storage (30 sec)

```powershell
Get-ChildItem E:\media-store\reels\DTQpr8DjlkU\
```

**You should now see ALL files:**
```
video.mp4          # Original video (11 MB)
audio.wav          # Extracted audio (1-2 MB)
transcript.txt     # Transcription (few KB)
metadata.json      # Updated with transcription info
```

**Check metadata update:**
```powershell
Get-Content E:\media-store\reels\DTQpr8DjlkU\metadata.json | ConvertFrom-Json | ConvertTo-Json
```

Should include new `transcription` section with detected language, duration, etc.

---

## 🎯 Complete End-to-End Test

Test the entire pipeline with a new reel:

```powershell
# Step 1: Download video
curl -X POST http://localhost:3000/api/jobs/process `
  -H "Content-Type: application/json" `
  -d '{"url": "https://www.instagram.com/reel/NEW_REEL_URL/"}'

# Wait a moment
Start-Sleep -Seconds 2

# Step 2: Transcribe
curl -X POST http://localhost:5000/transcribe `
  -H "Content-Type: application/json" `
  -d '{"shortcode": "NEW_SHORTCODE"}'

# Step 3: Verify all files
Get-ChildItem E:\media-store\reels\NEW_SHORTCODE\
Get-Content E:\media-store\reels\NEW_SHORTCODE\transcript.txt
```

---

## 📊 Performance Notes

**First run is slower** because:
- Whisper model downloads (~150MB)
- Model loads into memory

**Subsequent runs are faster:**
- Audio extraction: ~2-5 seconds
- Transcription (small model): ~10-20 seconds for 1-minute video
- Total: ~15-25 seconds per video

**Model sizes and trade-offs:**
- `tiny`: Fastest, lowest accuracy
- `small`: **Current (recommended)** - Good balance
- `medium`: Better accuracy, slower
- `large`: Best accuracy, much slower

---

## 🐛 Troubleshooting

### Transcription service won't start

```powershell
# Check logs
docker logs recipe-extractor-transcription

# Common issues:
# 1. Port 5000 in use
netstat -ano | findstr :5000

# 2. Model download failed (network issue)
# Solution: Restart container, it will retry
docker restart recipe-extractor-transcription
```

### Audio extraction fails

```powershell
# Verify FFmpeg is installed in container
docker exec recipe-extractor-transcription ffmpeg -version

# Check video file exists
docker exec recipe-extractor-transcription ls -la /data/reels/DTQpr8DjlkU/video.mp4
```

### Transcription returns empty text

**Possible causes:**
1. Video has no audio
2. Audio is too quiet
3. Language not supported (only Hindi, Telugu, Tamil, English)

**Solution:** Try with a different video, preferably a cooking reel with clear voice instructions.

### "Video not found" error

```powershell
# Verify video was downloaded
Get-ChildItem E:\media-store\reels\DTQpr8DjlkU\video.mp4

# If missing, download it first
curl -X POST http://localhost:3000/api/jobs/process `
  -H "Content-Type: application/json" `
  -d '{"url": "https://www.instagram.com/reel/DTQpr8DjlkU/"}'
```

---

## 🎉 Success Criteria

**Stage 1 is 100% complete when:**
- ✅ API service running (port 3000)
- ✅ Transcription service running (port 5000)
- ✅ Video downloads successfully
- ✅ Audio extracts successfully
- ✅ Transcription works and produces English text
- ✅ All 4 files exist: video.mp4, audio.wav, transcript.txt, metadata.json

---

## 📚 Next Steps

After completing this quickstart:

1. **Test with multiple reels** - Try Hindi, Telugu, Tamil cooking videos
2. **Read Stage 2 docs** - LLM processor setup (coming next)
3. **Optimize if needed** - Try different Whisper model sizes

**Stage 2 Preview:**
- Combine transcript + Instagram caption
- Send to local LLM
- Generate structured recipe JSON

See `NEXT-STEPS.md` for Stage 2 planning.

---

## 🔍 Container Status Check

```powershell
# View all running containers
docker ps

# Should see both:
# - recipe-extractor-api (port 3000)
# - recipe-extractor-transcription (port 5000)

# Check logs
docker logs recipe-extractor-api --tail 20
docker logs recipe-extractor-transcription --tail 20

# Check resource usage
docker stats --no-stream
```

---

**Ready to transcribe cooking videos! 🎬→🎵→📝**
