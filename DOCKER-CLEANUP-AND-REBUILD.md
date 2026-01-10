# Docker Cleanup and Rebuild Guide

## 🧹 What We're Cleaning Up

1. **NVIDIA/CUDA images** - Not needed (CPU-only)
2. **Old/duplicate API images** - Already removed
3. **GPU setup scripts** - Removed
4. **Transcription service** - Needs rebuild with two-stage architecture

---

## ✅ Already Cleaned

- ✅ Removed `nvidia/cuda:12.1.0-base-ubuntu22.04` image
- ✅ Removed `instagram-downloader:latest` (duplicate)
- ✅ Removed `recipe-extractor-api:latest` (duplicate)
- ✅ Deleted `nvidia_setup.sh`
- ✅ Deleted `nvidia_setup_ubuntu22.sh`

---

## 🔄 Rebuild Transcription Service

### Step 1: Stop Current Services

```powershell
cd E:\data-extractor
docker-compose down
```

### Step 2: Rebuild Transcription Service

```powershell
# Rebuild with new two-stage architecture
docker-compose build transcription

# Or rebuild all services
docker-compose build
```

**Note:** First build will download `large-v2` model (~3GB). This takes 5-10 minutes.

### Step 3: Start Services

```powershell
docker-compose up -d
```

### Step 4: Monitor Startup

```powershell
# Watch transcription service logs
docker-compose logs -f transcription
```

**Look for:**
```
Loading Whisper models...
Loading tiny model for language detection and English...
Tiny model loaded
Loading large model for Indian languages (Hindi/Telugu/Tamil)...
Large model loaded
All Whisper models loaded successfully
```

**Startup time:** 2-3 minutes (model loading)

---

## 🧪 Test Two-Stage Architecture

### Test 1: Health Check

```powershell
curl http://localhost:5000/health
```

**Expected:**
```json
{
  "status": "healthy",
  "service": "transcription",
  "version": "1.0.0"
}
```

### Test 2: English Video (Should Use Tiny)

```powershell
# Use an English cooking video
curl -X POST http://localhost:5000/transcribe `
  -H "Content-Type: application/json" `
  -d '{"shortcode": "ENGLISH_SHORTCODE"}'
```

**Expected in response:**
```json
{
  "detectedLanguage": "en",
  "modelUsed": "tiny",
  "task": "transcribe",
  "transcript": "English text here..."
}
```

### Test 3: Telugu/Hindi/Tamil Video (Should Use Large)

```powershell
# Use a Telugu/Hindi/Tamil cooking video
curl -X POST http://localhost:5000/transcribe `
  -H "Content-Type: application/json" `
  -d '{"shortcode": "TELUGU_SHORTCODE"}'
```

**Expected in response:**
```json
{
  "detectedLanguage": "te",  // or "hi" or "ta"
  "modelUsed": "large",
  "task": "transcribe",
  "transcript": "తెలుగు లిపి..."  // Native script
}
```

### Test 4: Verify Transcript File

```powershell
# Check transcript content
Get-Content E:\media-store\reels\SHORTCODE\transcript.txt

# Check metadata
Get-Content E:\media-store\reels\SHORTCODE\metadata.json | ConvertFrom-Json | Select-Object -ExpandProperty transcription
```

---

## 📊 Current Docker State

### Running Containers

```powershell
docker ps
```

**Should show:**
```
recipe-extractor-api            (port 3000)
recipe-extractor-transcription  (port 5000)
hbbs                            (RustDesk)
hbbr                            (RustDesk)
```

### Images

```powershell
docker images
```

**Should show:**
```
data-extractor-api:latest              ~226MB
data-extractor-transcription:latest    ~1.8GB (includes large model)
rustdesk/rustdesk-server:latest        ~18MB
```

**Note:** Transcription image is large because it includes both tiny and large-v2 Whisper models.

---

## 🗑️ Additional Cleanup (Optional)

### Remove Unused Images

```powershell
# Remove dangling images
docker image prune -f

# Remove all unused images
docker image prune -a -f
```

### Remove Unused Volumes

```powershell
docker volume prune -f
```

### Remove Unused Networks

```powershell
docker network prune -f
```

### Complete Cleanup (Nuclear Option)

```powershell
# WARNING: This removes EVERYTHING except running containers
docker system prune -a -f
```

---

## 🐛 Troubleshooting

### Transcription service won't start

```powershell
# Check logs
docker-compose logs transcription

# Common issue: Model download
# Solution: Wait 5-10 minutes for large model download
```

### "Out of memory" error

**Cause:** Large model requires ~4-6GB RAM

**Solutions:**
1. Close other applications
2. Increase Docker memory limit (Docker Desktop → Settings → Resources)
3. Use `medium` model instead of `large` (edit `transcribe.py`)

### Port conflicts

```powershell
# Check what's using ports
netstat -ano | findstr :3000
netstat -ano | findstr :5000

# Stop all and restart
docker-compose down
docker-compose up -d
```

### Models not loading

```powershell
# Check if models are cached
docker exec recipe-extractor-transcription ls -la ~/.cache/huggingface/hub/

# If empty, models will download on first transcription
# This is normal and takes 5-10 minutes
```

---

## 📈 Performance Expectations

### Model Loading (First Startup)
- Tiny model: ~50MB, loads in ~5 seconds
- Large model: ~3GB, downloads in ~5-10 minutes (first time only)
- Subsequent startups: ~30 seconds (models cached)

### Transcription Performance (CPU)
| Language | Model | Time (1min video) |
|----------|-------|-------------------|
| English | tiny | ~5-10 seconds |
| Hindi | large | ~30-60 seconds |
| Telugu | large | ~30-60 seconds |
| Tamil | large | ~30-60 seconds |

**Total pipeline time:** Detection (1s) + Transcription (5-60s) = 6-61 seconds

---

## ✅ Success Criteria

After rebuild, you should have:
- ✅ Two models loaded (tiny + large)
- ✅ English videos use tiny (fast)
- ✅ Hindi/Telugu/Tamil videos use large (native script)
- ✅ Metadata includes `modelUsed` and `task`
- ✅ Transcript files contain correct script
- ✅ No GPU/CUDA dependencies
- ✅ Clean Docker images (no NVIDIA stuff)

---

## 🎯 Next Steps

1. **Rebuild transcription service** (see Step 1-4 above)
2. **Test with real videos** (English + Telugu/Hindi)
3. **Verify native script output**
4. **Monitor performance**
5. **Move to Stage 2** (LLM integration)

---

**Ready to rebuild? Start with Step 1! 🚀**
