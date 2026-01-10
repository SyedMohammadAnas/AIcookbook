# 🚀 Quick Reference - Two-Stage Transcription

## ⚡ Quick Commands

### Check Status
```powershell
# Container status
docker ps

# Transcription logs (watch models loading)
docker logs recipe-extractor-transcription -f

# Health check (will work once models load)
curl http://localhost:5000/health
```

### Test Workflow
```powershell
# 1. Download video
curl -X POST http://localhost:3000/api/jobs/process `
  -H "Content-Type: application/json" `
  -d '{"url": "INSTAGRAM_URL"}'

# 2. Transcribe
curl -X POST http://localhost:5000/transcribe `
  -H "Content-Type: application/json" `
  -d '{"shortcode": "SHORTCODE"}'

# 3. Check result
Get-Content E:\media-store\reels\SHORTCODE\transcript.txt
```

---

## 🎯 Model Selection Logic

| Language | Model | Output | Speed |
|----------|-------|--------|-------|
| English | tiny | English text | Fast (6-12s) |
| Hindi | base | हिंदी (Devanagari) | Medium (20-40s) |
| Telugu | base | తెలుగు (Telugu script) | Medium (20-40s) |
| Tamil | base | தமிழ் (Tamil script) | Medium (20-40s) |
| Other | tiny | English (translated) | Fast (6-12s) |

---

## 📊 Expected Response

### English Video
```json
{
  "success": true,
  "detectedLanguage": "en",
  "modelUsed": "tiny",
  "task": "transcribe",
  "transcript": "First, heat oil...",
  "detectionTime": 1.5,
  "transcriptionTime": 8.2,
  "totalProcessingTime": 12.3
}
```

### Telugu Video
```json
{
  "success": true,
  "detectedLanguage": "te",
  "modelUsed": "large",
  "task": "transcribe",
  "transcript": "మొదట పాన్‌లో నూనె...",
  "detectionTime": 1.8,
  "transcriptionTime": 45.6,
  "totalProcessingTime": 50.2
}
```

---

## 🐛 Troubleshooting

### Container shows "unhealthy"
**Cause:** Models still downloading (first startup)
**Solution:** Wait 5-10 minutes, check logs

### Health endpoint returns error
**Cause:** Models not loaded yet
**Solution:** `docker logs recipe-extractor-transcription -f`

### Transcription returns English for Telugu
**Cause:** Old container or model not loaded
**Solution:** `docker-compose down && docker-compose up -d`

### Out of memory
**Cause:** Large model needs 4-6GB RAM
**Solution:** Close other apps or increase Docker memory

---

## 📁 File Locations

### Code
- `services/transcription/transcribe.py` - Main logic
- `services/transcription/app.py` - Flask API
- `docker-compose.yml` - Service config

### Documentation
- `TWO-STAGE-TRANSCRIPTION.md` - Architecture
- `IMPLEMENTATION-COMPLETE.md` - Status
- `FINAL-SUMMARY.md` - Complete summary
- `QUICK-REFERENCE.md` - This file

### Storage
- `E:\media-store\reels\{shortcode}\` - All files
  - `video.mp4` - Downloaded video
  - `audio.wav` - Extracted audio
  - `transcript.txt` - Transcription
  - `metadata.json` - All metadata

---

## ⏱️ Startup Time

**First startup (models download):**
- tiny: ~1 minute
- large: ~5-10 minutes
- **Total: ~10 minutes**

**Subsequent startups (models cached):**
- Both models: ~30 seconds

---

## 🎯 One Sentence

**Tiny decides the language and handles English. Large speaks Indian languages correctly.**

---

*Quick reference for daily use. See full docs for details.*
