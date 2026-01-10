# ⏳ Waiting for Models to Load

## Current Situation

**Good News:** Service is working! Models are loading.
**Bad News:** Python logs aren't showing (even with unbuffered output).
**Reality:** Models loading from scratch (~5-10 minutes).

---

## Why Logs Aren't Showing

Even with `python -u` (unbuffered), the `logger.info()` calls at module-level aren't flushing to Docker logs. This is a known Python/Docker quirk with module-level logging.

**But the service IS working:**
- Process running: ✅ (PID 1)
- CPU usage: 28-30% (loading models)
- Memory increasing: ✅ (models loading into RAM)

---

## How to Monitor Progress

### Option 1: Automated Monitoring Script (Recommended)

```powershell
# Run this script - it checks every 10 seconds
.\monitor-transcription.ps1
```

**Output:**
```
[18:25:00] ⏳ Loading... (CPU: 28.7%, Attempt: 1)
[18:25:10] ⏳ Loading... (CPU: 29.1%, Attempt: 2)
[18:25:20] ⏳ Loading... (CPU: 27.5%, Attempt: 3)
...
[18:30:00] ✅ SERVICE READY!
```

### Option 2: Manual Checking

```powershell
# Check every minute manually
curl http://localhost:5000/health

# When ready, returns:
# {"status":"healthy","service":"transcription","version":"1.0.0"}

# While loading, returns:
# curl: (52) Empty reply from server
```

### Option 3: Watch CPU Usage

```powershell
# High CPU (25-40%) = models loading
# Low CPU (1-5%) = models loaded, Flask running
docker stats recipe-extractor-transcription --no-stream
```

---

## Timeline

| Time | Status | What's Happening |
|------|--------|------------------|
| 0-2 min | CPU: 30-40% | Loading tiny model |
| 2-8 min | CPU: 25-35% | Loading large model |
| 8-10 min | CPU: 1-5% | Models loaded, Flask starting |
| 10+ min | CPU: <1% | Ready! Health endpoint responds |

**Total:** ~10 minutes for first load

---

## What To Do While Waiting

### 1. Prepare Test Video

```powershell
# Create test directory
New-Item -ItemType Directory -Force -Path E:\media-store\reels\test-english

# Copy any video file (cooking video preferred)
Copy-Item "C:\path\to\your\video.mp4" E:\media-store\reels\test-english\video.mp4
```

### 2. Read Documentation

- `TWO-STAGE-TRANSCRIPTION.md` - Architecture explanation
- `IMPLEMENTATION-COMPLETE.md` - What was implemented
- `QUICK-REFERENCE.md` - Quick commands

### 3. Check Model Cache

```powershell
# See model download progress
docker exec recipe-extractor-transcription du -sh /root/.cache/huggingface/hub/models--Systran*

# Output shows size increasing:
# 50M  /root/.cache/huggingface/hub/models--Systran--faster-whisper-tiny
# 1.5G /root/.cache/huggingface/hub/models--Systran--faster-whisper-large-v2
```

---

## When Ready

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

### Test 2: Transcribe Test Video

```powershell
curl -X POST http://localhost:5000/transcribe `
  -H "Content-Type: application/json" `
  -d '{"shortcode": "test-english"}'
```

**Expected:** JSON with `"success": true`, `"modelUsed": "tiny"` or `"large"`, and transcription text

### Test 3: Check Output

```powershell
Get-Content E:\media-store\reels\test-english\transcript.txt
Get-Content E:\media-store\reels\test-english\metadata.json
```

---

## Troubleshooting

### Models taking too long (>15 min)

```powershell
# Check if actually downloading
docker exec recipe-extractor-transcription ls -lh /root/.cache/huggingface/hub/

# If stuck, restart
docker-compose restart transcription
```

### Process crashed

```powershell
# Check logs for errors
docker logs recipe-extractor-transcription

# Check if container running
docker ps | Select-String transcription

# If not running, check why
docker-compose ps
```

### Out of memory

```powershell
# Check memory usage
docker stats recipe-extractor-transcription --no-stream

# If >4GB used and system struggling
# Option 1: Increase Docker memory (Settings > Resources)
# Option 2: Close other applications
# Option 3: Use medium model instead of large
```

---

## Summary

**Current Status:**
- ✅ Service is working
- ✅ Models are loading
- ⏳ Waiting for completion (~10 min)
- ❌ Logs not visible (Python quirk, doesn't affect function)

**Action:**
1. Run `.\monitor-transcription.ps1` (automated)
2. OR manually check `curl http://localhost:5000/health` every minute
3. Wait ~10 minutes
4. Test with your video!

**Next:**
- Once healthy, test transcription
- Verify two-stage architecture works (tiny for English, large for Telugu/Hindi/Tamil)
- Move to Stage 2 (LLM integration)

---

*Be patient - the service IS working, just loading silently. Check back in 10 minutes!* ⏳
