# Transcription Service

Audio extraction and transcription service using FFmpeg and faster-whisper.

## Features

- Extract audio from video files using FFmpeg
- Transcribe audio to English using faster-whisper
- Auto-detect language (Hindi, Telugu, Tamil, English)
- Translate to English if source is different language

## API Endpoints

### GET /health
Health check endpoint

**Response:**
```json
{
  "status": "healthy",
  "service": "transcription",
  "version": "1.0.0"
}
```

### POST /extract-audio
Extract audio from video without transcription

**Request:**
```json
{
  "shortcode": "DTQpr8DjlkU"
}
```

**Response:**
```json
{
  "success": true,
  "shortcode": "DTQpr8DjlkU",
  "audioPath": "/data/reels/DTQpr8DjlkU/audio.wav",
  "duration": 45.3,
  "processingTime": 2.5
}
```

### POST /transcribe
Extract audio and transcribe to English

**Request:**
```json
{
  "shortcode": "DTQpr8DjlkU"
}
```

**Response:**
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

## Docker Build

```bash
cd services/transcription
docker build -t recipe-extractor-transcription .
docker run -d -p 5000:5000 -v E:\media-store:/data --name recipe-extractor-transcription recipe-extractor-transcription
```

## Test

```bash
# Health check
curl http://localhost:5000/health

# Extract audio only
curl -X POST http://localhost:5000/extract-audio \
  -H "Content-Type: application/json" \
  -d '{"shortcode": "DTQpr8DjlkU"}'

# Full transcription
curl -X POST http://localhost:5000/transcribe \
  -H "Content-Type: application/json" \
  -d '{"shortcode": "DTQpr8DjlkU"}'
```

## Model Information

- **Model:** faster-whisper small
- **Device:** CPU
- **Compute Type:** int8
- **Languages Supported:** Hindi, Telugu, Tamil, English (auto-detect)
- **Output:** English translation
- **Speed:** ~4x faster than OpenAI Whisper

## Storage

Files are stored in `/data/reels/{shortcode}/`:
- `video.mp4` - Original video (input)
- `audio.wav` - Extracted audio
- `transcript.txt` - Transcribed text
- `metadata.json` - Updated with transcription info
