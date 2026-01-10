# API Endpoints Documentation

## Base URL
`http://localhost:3000`

---

## 1. Get Video Metadata

Fetches Instagram Reel metadata without downloading.

### Endpoint
```
GET /api/video
```

### Query Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| postUrl | string | Yes | Instagram Reel URL |
| enhanced | boolean | No | Return enhanced metadata (default: false) |

### Example Request
```bash
curl "http://localhost:3000/api/video?postUrl=https://www.instagram.com/reel/DTQpr8DjlkU/&enhanced=true"
```

### Example Response
```json
{
  "success": true,
  "message": "success",
  "data": {
    "shortcode": "DTQpr8DjlkU",
    "caption": "Recipe instructions here...",
    "medias": [
      {
        "url": "https://...",
        "type": "video",
        "dimensions": {
          "width": 1080,
          "height": 1920
        }
      }
    ],
    "owner": {
      "username": "chef_account",
      "fullName": "Chef Name"
    },
    "timestamp": "2024-01-09T00:00:00.000Z"
  },
  "timestamp": "2024-01-09T12:00:00.000Z"
}
```

---

## 2. Download Video

Downloads Instagram Reel video and saves to storage.

### Endpoint
```
POST /api/jobs/download
```

### Request Body
```json
{
  "shortcode": "DTQpr8DjlkU",
  "mediaUrl": "https://..."
}
```

### Example Request
```bash
curl -X POST http://localhost:3000/api/jobs/download \
  -H "Content-Type: application/json" \
  -d '{
    "shortcode": "DTQpr8DjlkU",
    "mediaUrl": "https://scontent.cdninstagram.com/..."
  }'
```

### Example Response
```json
{
  "success": true,
  "shortcode": "DTQpr8DjlkU",
  "videoPath": "/data/reels/DTQpr8DjlkU/video.mp4",
  "message": "Video downloaded successfully"
}
```

### Storage Structure
After successful download:
```
/data/reels/DTQpr8DjlkU/
├── video.mp4
└── metadata.json
```

---

## 3. Process Complete (Convenience Endpoint)

Fetches metadata AND downloads video in one call.

### Endpoint
```
POST /api/jobs/process
```

### Request Body
```json
{
  "url": "https://www.instagram.com/reel/DTQpr8DjlkU/"
}
```

### Example Request
```bash
curl -X POST http://localhost:3000/api/jobs/process \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.instagram.com/reel/DTQpr8DjlkU/"
  }'
```

### Example Response
```json
{
  "success": true,
  "shortcode": "DTQpr8DjlkU",
  "videoPath": "/data/reels/DTQpr8DjlkU/video.mp4",
  "metadata": {
    "shortcode": "DTQpr8DjlkU",
    "caption": "Recipe instructions...",
    "medias": [...],
    "owner": {...}
  }
}
```

---

## Error Responses

All endpoints return consistent error format:

```json
{
  "success": false,
  "error": "Error message description"
}
```

### Common HTTP Status Codes
- `200` - Success
- `400` - Bad Request (missing/invalid parameters)
- `500` - Internal Server Error
- `501` - Not Implemented (if API is disabled)

---

## Workflow Examples

### Workflow 1: Two-Step Process (Recommended)
```bash
# Step 1: Get metadata
RESPONSE=$(curl "http://localhost:3000/api/video?postUrl=https://www.instagram.com/reel/DTQpr8DjlkU/&enhanced=true")

# Extract shortcode and mediaUrl from response
SHORTCODE=$(echo $RESPONSE | jq -r '.data.shortcode')
MEDIA_URL=$(echo $RESPONSE | jq -r '.data.medias[0].url')

# Step 2: Download video
curl -X POST http://localhost:3000/api/jobs/download \
  -H "Content-Type: application/json" \
  -d "{\"shortcode\": \"$SHORTCODE\", \"mediaUrl\": \"$MEDIA_URL\"}"
```

### Workflow 2: One-Step Process (Convenience)
```bash
# Process everything in one call
curl -X POST http://localhost:3000/api/jobs/process \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.instagram.com/reel/DTQpr8DjlkU/"
  }'
```

---

## Future Endpoints (Planned)

### 4. Extract Audio (Transcription Service)
```
POST /api/jobs/extract-audio
```

### 5. Transcribe Audio (Transcription Service)
```
POST /api/jobs/transcribe
```

### 6. Generate Recipe (LLM Service)
```
POST /api/jobs/generate-recipe
```

### 7. Get Recipe (Query Service)
```
GET /api/recipe/{shortcode}
```
