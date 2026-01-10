# Transcription Features

## Overview

The transcription service now includes enhanced features for Hindi, Telugu, and Tamil audio processing.

## New Features

### 1. **High-Quality Model with Anti-Hallucination**
- **Using `medium` model** for Hindi/Telugu/Tamil (upgraded from base/small)
- **VAD (Voice Activity Detection) filtering** - Detects and processes only speech segments
- **Anti-hallucination parameters**:
  - `condition_on_previous_text=False` - Prevents repetition loops
  - `compression_ratio_threshold=2.4` - Filters repetitive segments
  - `log_prob_threshold=-1.0` - Quality filtering
  - `no_speech_threshold=0.6` - Silence detection
- Eliminates hallucinations and gibberish output (no more repeated characters!)
- Excellent accuracy with native scripts (Devanagari, Telugu, Tamil)
- Processing time: ~30-60 seconds per minute of audio

### 2. **English Translation**
For Hindi, Telugu, and Tamil audio, the service now automatically generates:
- **Native script transcription** (`transcript.txt`)
- **English translation** (`transcript-en.txt`) for comparison and safety

### 3. **Transcription Metadata File**
A new human-readable summary file: `transcription-meta.txt`

**Example content:**
```
============================================================
TRANSCRIPTION METADATA
============================================================

Shortcode: DSxFiSHDPr7
Transcribed At: 2026-01-10 05:29:16 UTC

------------------------------------------------------------
LANGUAGE DETECTION
------------------------------------------------------------
Detected Language: hi
Confidence: 72.19%
Detection Time: 1.31s

------------------------------------------------------------
TRANSCRIPTION
------------------------------------------------------------
Model Used: medium
Task: transcribe
Audio Duration: 172.73s
Transcription Time: 14.50s
Translation Time: 12.20s
Total Processing Time: 28.01s

------------------------------------------------------------
OUTPUT FILES
------------------------------------------------------------
Audio: audio.wav
Transcript (hi): transcript.txt
Translation (en): transcript-en.txt
============================================================
```

## Output Files Structure

For a Hindi/Telugu/Tamil reel with shortcode `ABC123`:

```
/data/reels/ABC123/
├── video.mp4                  # Original video
├── metadata.json              # Full metadata (JSON)
├── audio.wav                  # Extracted audio
├── transcript.txt             # Native script transcription
├── transcript-en.txt          # English translation (NEW!)
└── transcription-meta.txt     # Human-readable summary (NEW!)
```

For English reels:
```
/data/reels/XYZ789/
├── video.mp4
├── metadata.json
├── audio.wav
├── transcript.txt             # English transcription
└── transcription-meta.txt     # Metadata summary
```

## API Response

The `/transcribe` endpoint now returns additional fields:

```json
{
  "success": true,
  "shortcode": "DSxFiSHDPr7",
  "audioPath": "/data/reels/DSxFiSHDPr7/audio.wav",
  "transcriptPath": "/data/reels/DSxFiSHDPr7/transcript.txt",
  "transcript": "नमस्ते...",
  "englishTranscriptPath": "/data/reels/DSxFiSHDPr7/transcript-en.txt",
  "englishTranscript": "Hello...",
  "metaPath": "/data/reels/DSxFiSHDPr7/transcription-meta.txt",
  "detectedLanguage": "hi",
  "languageProbability": 0.7219,
  "modelUsed": "small",
  "task": "transcribe",
  "duration": 172.73,
  "detectionTime": 1.31,
  "transcriptionTime": 14.50,
  "translationTime": 12.20,
  "totalProcessingTime": 28.01
}
```

## Model Selection Logic

| Language | Model | Output | Translation |
|----------|-------|--------|-------------|
| English (en) | tiny | English text | No |
| Hindi (hi) | medium | Devanagari script | Yes (English) |
| Telugu (te) | medium | Telugu script | Yes (English) |
| Tamil (ta) | medium | Tamil script | Yes (English) |
| Other | tiny | English (translated) | N/A |

## Performance Expectations

### Hindi/Telugu/Tamil (with translation):
- Language detection: ~1-2 seconds
- Native transcription: ~30-60 seconds per minute
- English translation: ~25-50 seconds per minute
- **Total: ~60-120 seconds per minute of audio**

### English:
- Language detection: ~1-2 seconds
- Transcription: ~5-10 seconds per minute
- **Total: ~6-12 seconds per minute of audio**

## Usage

### Test the new features:

```bash
# Transcribe a Hindi reel
curl -X POST http://localhost:5000/transcribe \
  -H "Content-Type: application/json" \
  -d '{"shortcode": "DSxFiSHDPr7"}'

# Check the output files
ls -la E:\media-store\reels\DSxFiSHDPr7\

# View the metadata summary
cat E:\media-store\reels\DSxFiSHDPr7\transcription-meta.txt

# Compare native vs English
cat E:\media-store\reels\DSxFiSHDPr7\transcript.txt
cat E:\media-store\reels\DSxFiSHDPr7\transcript-en.txt
```

## Restart Required

After updating the code, restart the transcription service:

```bash
docker-compose restart transcription
```

Or rebuild completely:

```bash
docker-compose down
docker-compose up -d --build
```

The `medium` model will be downloaded on first use (~1.5GB), then cached for future transcriptions.
