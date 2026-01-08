# Next Steps - What to Do Now

## 🎯 Current Status

You've successfully:
1. ✅ Organized project structure
2. ✅ Created video download endpoints
3. ✅ Written comprehensive documentation
4. ✅ Set up docker-compose template

**Your API container is currently running with the OLD code.**

---

## 🚀 Step 1: Rebuild and Test New Endpoints (15 minutes)

### 1.1 Stop Current Container
```powershell
docker stop recipe-extractor-api
docker rm recipe-extractor-api
```

### 1.2 Rebuild with New Code
```powershell
cd E:\data-extractor\services\api
docker build -t recipe-extractor-api .
```

### 1.3 Start New Container
```powershell
docker run -d -p 3000:3000 -v E:\media-store:/data --name recipe-extractor-api recipe-extractor-api
```

### 1.4 Verify Container is Running
```powershell
docker ps | Select-String "recipe-extractor-api"
docker logs recipe-extractor-api
```

### 1.5 Test the New Endpoints

**Test 1: Process Complete (easiest)**
```powershell
curl -X POST http://localhost:3000/api/jobs/process `
  -H "Content-Type: application/json" `
  -d '{"url": "https://www.instagram.com/reel/DTQpr8DjlkU/"}'
```

**Expected:** JSON response with `success: true` and `videoPath`

**Test 2: Check if File Was Created**
```powershell
Get-ChildItem E:\media-store\reels\
Get-ChildItem E:\media-store\reels\DTQpr8DjlkU\
```

**Expected:** You should see `video.mp4` and `metadata.json`

**Test 3: Check File Size**
```powershell
Get-ChildItem E:\media-store\reels\DTQpr8DjlkU\ | Select-Object Name, Length
```

**Expected:** video.mp4 should be several MB in size

---

## 🔧 Step 2: If Tests Pass - Move to Transcription (2-3 hours)

### 2.1 Create Transcription Service Structure
```powershell
cd E:\data-extractor\services\transcription
```

### 2.2 Files to Create

**requirements.txt**
```txt
faster-whisper==1.0.0
flask==3.0.0
```

**Dockerfile**
```dockerfile
FROM python:3.11-slim

# Install FFmpeg
RUN apt-get update && apt-get install -y \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 5000

CMD ["python", "app.py"]
```

**app.py** (Flask API)
```python
from flask import Flask, request, jsonify
from transcribe import transcribe_video
import os

app = Flask(__name__)

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "healthy"})

@app.route('/transcribe', methods=['POST'])
def transcribe():
    data = request.json
    shortcode = data.get('shortcode')

    if not shortcode:
        return jsonify({"error": "Missing shortcode"}), 400

    video_path = f"/data/reels/{shortcode}/video.mp4"

    if not os.path.exists(video_path):
        return jsonify({"error": "Video not found"}), 404

    result = transcribe_video(shortcode, video_path)
    return jsonify(result)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
```

**transcribe.py** (Whisper logic)
```python
from faster_whisper import WhisperModel
import subprocess
import os

# Load model once at startup
model = WhisperModel("small", device="cpu", compute_type="int8")

def extract_audio(video_path, audio_path):
    """Extract audio from video using FFmpeg"""
    cmd = [
        'ffmpeg',
        '-i', video_path,
        '-vn',  # No video
        '-acodec', 'pcm_s16le',  # PCM 16-bit
        '-ar', '16000',  # 16kHz sample rate
        '-ac', '1',  # Mono
        audio_path,
        '-y'  # Overwrite
    ]
    subprocess.run(cmd, check=True)

def transcribe_video(shortcode, video_path):
    """Complete transcription pipeline"""
    base_dir = os.path.dirname(video_path)
    audio_path = os.path.join(base_dir, 'audio.wav')
    transcript_path = os.path.join(base_dir, 'transcript.txt')

    # Step 1: Extract audio
    extract_audio(video_path, audio_path)

    # Step 2: Transcribe
    segments, info = model.transcribe(
        audio_path,
        task="translate",  # Translate to English
        language=None  # Auto-detect
    )

    # Step 3: Combine segments
    transcript = " ".join([segment.text for segment in segments])

    # Step 4: Save transcript
    with open(transcript_path, 'w', encoding='utf-8') as f:
        f.write(transcript)

    return {
        "success": True,
        "shortcode": shortcode,
        "audioPath": audio_path,
        "transcriptPath": transcript_path,
        "transcript": transcript,
        "detectedLanguage": info.language,
        "duration": info.duration
    }
```

### 2.3 Build and Test Transcription Service
```powershell
cd E:\data-extractor\services\transcription
docker build -t recipe-extractor-transcription .
docker run -d -p 5000:5000 -v E:\media-store:/data --name recipe-extractor-transcription recipe-extractor-transcription

# Test it
curl -X POST http://localhost:5000/transcribe `
  -H "Content-Type: application/json" `
  -d '{"shortcode": "DTQpr8DjlkU"}'
```

---

## 📋 Step 3: Update docker-compose (When Both Services Work)

```powershell
cd E:\data-extractor

# Stop individual containers
docker stop recipe-extractor-api recipe-extractor-transcription
docker rm recipe-extractor-api recipe-extractor-transcription

# Start with docker-compose
docker-compose up -d

# Check status
docker-compose ps
docker-compose logs
```

---

## 🐛 Troubleshooting

### Container Won't Start
```powershell
# Check logs
docker logs recipe-extractor-api

# Check if port is in use
netstat -ano | findstr :3000

# Rebuild from scratch
docker build --no-cache -t recipe-extractor-api .
```

### Download Fails
```powershell
# Check container network
docker exec recipe-extractor-api ping -c 3 instagram.com

# Check disk space
Get-PSDrive E
```

### Files Not Appearing
```powershell
# Verify mount inside container
docker exec recipe-extractor-api ls -la /data
docker exec recipe-extractor-api ls -la /data/reels

# Check permissions
docker exec recipe-extractor-api touch /data/test.txt
Get-ChildItem E:\media-store\test.txt
```

---

## 📚 Documentation Reference

- **API Endpoints:** `docs/api-endpoints.md`
- **Testing Guide:** `docs/testing-guide.md`
- **Transcription Setup:** `docs/transcription-setup.md`
- **Progress Tracker:** `PROGRESS.md`
- **Project Overview:** `README.md`

---

## ✅ Success Criteria

**Stage 1 Complete When:**
- [ ] Video downloads successfully
- [ ] Files appear in `E:\media-store\reels\{shortcode}\`
- [ ] Audio extracted to WAV
- [ ] Transcript generated in English
- [ ] All artifacts stored correctly

**Then you can move to Stage 2:** LLM processing for recipe generation

---

## 💡 Tips

1. **Test incrementally** - Don't build everything at once
2. **Check logs often** - `docker logs <container-name>`
3. **Verify file creation** - Check `E:\media-store\reels\` after each step
4. **Use curl or Postman** - Test APIs before building frontend
5. **Keep containers running** - Use `-d` flag for detached mode

---

## 🎯 Your Immediate Action

**RIGHT NOW:** Run the rebuild commands in Step 1 and test the download endpoint!

```powershell
# Quick test script
docker stop recipe-extractor-api
docker rm recipe-extractor-api
cd E:\data-extractor\services\api
docker build -t recipe-extractor-api .
docker run -d -p 3000:3000 -v E:\media-store:/data --name recipe-extractor-api recipe-extractor-api
docker logs recipe-extractor-api

# Wait 10 seconds for startup, then test
Start-Sleep -Seconds 10
curl -X POST http://localhost:3000/api/jobs/process -H "Content-Type: application/json" -d '{"url": "https://www.instagram.com/reel/DTQpr8DjlkU/"}'
```
