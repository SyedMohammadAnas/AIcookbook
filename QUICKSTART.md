# Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Prerequisites
- Docker installed and running
- Storage directory exists: `E:\media-store\reels\`

---

## Step 1: Rebuild Container (2 min)

```powershell
cd E:\data-extractor\services\api

# Clean up any existing containers (safe to run even if none exist)
docker stop recipe-extractor-api 2>$null
docker rm recipe-extractor-api 2>$null

# Remove any orphaned containers that might be using port 3000
$containers = docker ps -aq --filter "publish=3000" 2>$null
if ($containers) { docker stop $containers 2>$null; docker rm $containers 2>$null }

# Build and run fresh container
docker build -t recipe-extractor-api .
docker run -d -p 3000:3000 -v E:\media-store:/data --name recipe-extractor-api recipe-extractor-api
```

---

## Step 2: Wait for Startup (30 sec)

```powershell
Start-Sleep -Seconds 10
docker logs recipe-extractor-api --tail 20
```

**Look for:** `✓ Ready in ...ms` or similar startup message

---

## Step 2.5: Verify Setup (10 sec)

```powershell
# Check if container is running
docker ps | findstr recipe-extractor-api

# Check if port 3000 is accessible
curl -s http://localhost:3000 | Select-Object -First 5

# Should see: "Welcome to Next.js!" or similar API response
```

---

## Step 3: Test Download (1 min)

```powershell
curl -X POST http://localhost:3000/api/jobs/process `
  -H "Content-Type: application/json" `
  -d '{"url": "https://www.instagram.com/reel/DTQpr8DjlkU/"}'
```

**Expected Response:**
```json
{
  "success": true,
  "shortcode": "DTQpr8DjlkU",
  "videoPath": "/data/reels/DTQpr8DjlkU/video.mp4",
  "metadata": { ... }
}
```

---

## Step 4: Verify Files (30 sec)

```powershell
Get-ChildItem E:\media-store\reels\DTQpr8DjlkU\
```

**You should see:**
- `video.mp4` (several MB)
- `metadata.json`

---

## ✅ Success!

If you see the files, Stage 1 (video download) is working!

### Next Steps:
1. Read `NEXT-STEPS.md` for transcription service setup
2. Check `docs/api-endpoints.md` for all available APIs
3. See `docs/testing-guide.md` for more test scenarios

---

## 🐛 Troubleshooting

### Container won't start
```powershell
docker logs recipe-extractor-api
```

### Port 3000 already in use
```powershell
# Option 1: Find and stop other process using port 3000
netstat -ano | findstr :3000
# Note the PID and kill it with: taskkill /PID <PID> /F

# Option 2: Use a different port (recommended)
docker run -d -p 3001:3000 -v E:\media-store:/data --name recipe-extractor-api recipe-extractor-api

# Then test with: curl http://localhost:3001/api/jobs/process ...

# Option 3: Force cleanup and restart on same port
docker stop $(docker ps -aq --filter "publish=3000") 2>$null
docker rm $(docker ps -aq --filter "publish=3000") 2>$null
docker run -d -p 3000:3000 -v E:\media-store:/data --name recipe-extractor-api recipe-extractor-api
```

### Files not appearing
```powershell
# Check if mount works
docker exec recipe-extractor-api ls -la /data
docker exec recipe-extractor-api touch /data/test.txt
Get-ChildItem E:\media-store\test.txt
```

### Download fails
```powershell
# Check container network
docker exec recipe-extractor-api ping -c 3 instagram.com

# Try a different reel URL
curl -X POST http://localhost:3000/api/jobs/process `
  -H "Content-Type: application/json" `
  -d '{"url": "DIFFERENT_INSTAGRAM_URL"}'
```

---

## 📚 Documentation

| File | Purpose |
|------|---------|
| `QUICKSTART.md` | This file - get started fast |
| `SUMMARY.md` | Complete overview of what's been done |
| `NEXT-STEPS.md` | Detailed guide for next phase |
| `PROGRESS.md` | Progress tracker with checklist |
| `README.md` | Project architecture and design |
| `docs/` | Detailed technical documentation |

---

## 🎯 Your Status

After completing this quick start:
- ✅ API service running
- ✅ Video download working
- ✅ Files stored correctly

**Next:** Build transcription service (see `NEXT-STEPS.md` Step 2)
