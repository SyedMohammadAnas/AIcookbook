# Testing Guide

## Prerequisites

1. Docker container running:
```bash
docker ps | grep recipe-extractor-api
```

2. Storage directory exists:
```bash
# Should exist: E:\media-store\reels\
```

---

## Test 1: Get Video Metadata

### Test the metadata endpoint

```bash
curl "http://localhost:3000/api/video?postUrl=https://www.instagram.com/reel/DTQpr8DjlkU/&enhanced=true"
```

### Expected Result
- Status: 200
- Response contains: `shortcode`, `caption`, `medias` array
- `medias[0].url` should be a valid video URL

### Validation
```bash
# Pretty print with jq
curl -s "http://localhost:3000/api/video?postUrl=https://www.instagram.com/reel/DTQpr8DjlkU/&enhanced=true" | jq .

# Extract just the video URL
curl -s "http://localhost:3000/api/video?postUrl=https://www.instagram.com/reel/DTQpr8DjlkU/&enhanced=true" | jq -r '.data.medias[0].url'
```

---

## Test 2: Download Video

### Step 1: Get metadata first
```bash
RESPONSE=$(curl -s "http://localhost:3000/api/video?postUrl=https://www.instagram.com/reel/DTQpr8DjlkU/&enhanced=true")
SHORTCODE=$(echo $RESPONSE | jq -r '.data.shortcode')
MEDIA_URL=$(echo $RESPONSE | jq -r '.data.medias[0].url')

echo "Shortcode: $SHORTCODE"
echo "Media URL: $MEDIA_URL"
```

### Step 2: Download the video
```bash
curl -X POST http://localhost:3000/api/jobs/download \
  -H "Content-Type: application/json" \
  -d "{\"shortcode\": \"$SHORTCODE\", \"mediaUrl\": \"$MEDIA_URL\"}"
```

### Expected Result
- Status: 200
- Response: `{"success": true, "videoPath": "/data/reels/DTQpr8DjlkU/video.mp4"}`

### Validation
```bash
# Check if file exists on host
ls -lh E:\media-store\reels\DTQpr8DjlkU\

# Should see:
# - video.mp4
# - metadata.json

# Check file size (should be > 0)
Get-ChildItem E:\media-store\reels\DTQpr8DjlkU\ | Select-Object Name, Length
```

---

## Test 3: Complete Process (One Call)

### Single endpoint test
```bash
curl -X POST http://localhost:3000/api/jobs/process \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.instagram.com/reel/DTQpr8DjlkU/"
  }'
```

### Expected Result
- Status: 200
- Response contains both metadata and videoPath
- File created at: `E:\media-store\reels\DTQpr8DjlkU\video.mp4`

---

## Test 4: Error Handling

### Test 1: Missing parameters
```bash
curl -X POST http://localhost:3000/api/jobs/download \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected:** Status 400, error message about missing fields

### Test 2: Invalid URL
```bash
curl "http://localhost:3000/api/video?postUrl=invalid-url"
```

**Expected:** Status 400, error about invalid URL

### Test 3: Non-existent reel
```bash
curl "http://localhost:3000/api/video?postUrl=https://www.instagram.com/reel/INVALID123/"
```

**Expected:** Status 400 or 500, error about not found

---

## Test 5: Verify Inside Container

### Check container logs
```bash
docker logs recipe-extractor-api
```

### Access container shell
```bash
docker exec -it recipe-extractor-api /bin/sh
```

### Inside container, verify:
```bash
# Check if /data mount exists
ls -la /data

# Check if reels directory exists
ls -la /data/reels

# Check downloaded files
ls -la /data/reels/DTQpr8DjlkU/

# Check file sizes
du -h /data/reels/DTQpr8DjlkU/*

# Read metadata
cat /data/reels/DTQpr8DjlkU/metadata.json
```

---

## Test 6: Multiple Downloads

### Download multiple reels
```bash
# Array of reel URLs
URLS=(
  "https://www.instagram.com/reel/DTQpr8DjlkU/"
  "https://www.instagram.com/reel/ANOTHER_CODE/"
  "https://www.instagram.com/reel/YET_ANOTHER/"
)

# Process each
for URL in "${URLS[@]}"; do
  echo "Processing: $URL"
  curl -X POST http://localhost:3000/api/jobs/process \
    -H "Content-Type: application/json" \
    -d "{\"url\": \"$URL\"}"
  echo ""
done
```

### Validation
```bash
# Check all downloaded reels
ls -la E:\media-store\reels\

# Count total videos
Get-ChildItem E:\media-store\reels\*\video.mp4 | Measure-Object
```

---

## Performance Testing

### Test download speed
```bash
time curl -X POST http://localhost:3000/api/jobs/process \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.instagram.com/reel/DTQpr8DjlkU/"
  }'
```

### Monitor container resources
```bash
docker stats recipe-extractor-api
```

---

## Cleanup

### Remove test downloads
```bash
# Remove specific reel
Remove-Item -Recurse -Force E:\media-store\reels\DTQpr8DjlkU

# Remove all reels
Remove-Item -Recurse -Force E:\media-store\reels\*
```

### Restart container
```bash
docker restart recipe-extractor-api
```

---

## Troubleshooting

### Issue: Container not accessible
```bash
# Check if container is running
docker ps

# Check container logs
docker logs recipe-extractor-api

# Restart container
docker restart recipe-extractor-api
```

### Issue: Files not appearing on host
```bash
# Verify volume mount
docker inspect recipe-extractor-api | grep -A 10 Mounts

# Check permissions inside container
docker exec -it recipe-extractor-api ls -la /data
```

### Issue: Download fails
```bash
# Check network connectivity from container
docker exec -it recipe-extractor-api ping -c 3 instagram.com

# Check disk space
df -h E:\
```

### Issue: API returns 500 error
```bash
# Check detailed logs
docker logs recipe-extractor-api --tail 100

# Check if Next.js is running
docker exec -it recipe-extractor-api ps aux | grep node
```
