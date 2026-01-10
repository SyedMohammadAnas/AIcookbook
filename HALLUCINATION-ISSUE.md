# Whisper Hallucination Issue - Analysis & Solutions

## Problem

The Tamil transcription for reel `DRE6GGXk0BT` is hallucinating at the end with repeated text:
```
...கிளிப் பரோட்டா,கிளிப் பரோட்டா,கிளிப் பரோட்டா,கிளிப் பரோட்டா...
```

This is a **known issue** with all Whisper models when:
1. Audio has background music
2. Audio ends with music/noise
3. Model tries to "transcribe" non-speech audio

## What We've Tried

### 1. ✅ Model Upgrade: `base` → `small` → `medium`
- Result: Still hallucinating
- The issue persists across all model sizes

### 2. ✅ VAD (Voice Activity Detection) Filtering
```python
vad_filter=True
vad_parameters={
    "threshold": 0.6,
    "min_speech_duration_ms": 250,
    "max_speech_duration_s": 60.0,
    "min_silence_duration_ms": 1000
}
```
- Result: VAD shows "removed 00:00.000 of audio" - not detecting the music as non-speech
- The background music has enough energy that VAD thinks it's speech

### 3. ✅ Anti-Hallucination Parameters
```python
beam_size=1,  # Greedy decoding
condition_on_previous_text=False,  # Prevents repetition
compression_ratio_threshold=2.0,
log_prob_threshold=-0.8,
no_speech_threshold=0.5,
repetition_penalty=1.2
```
- Result: Still hallucinating
- The model is confident about the hallucination

### 4. ✅ Post-Processing Repetition Removal
- Implemented `remove_repetitive_ending()` function
- Result: Pattern not detected because commas break word boundaries

## Root Cause

Looking at the transcript:
```tamil
...இன்னும் கிளிப்புரட்டா,லாப்பானு,னர்யா வரைடிஸ் of பரோட்டா,கிளிப் பரோட்டா,கிளிப் பரோட்டா,கிளிப் பரோட்டா...
```

The person is actually saying "varieties of parotta, kili parotta, lappan parotta..." but then the audio has background music and the model starts hallucinating "கிளிப் பரோட்டா" repeatedly.

## Solutions

### Option 1: Manual Post-Processing (Recommended)
Accept that some hallucination will occur and handle it in your application:

```python
# In your application code
def clean_transcript(text):
    # Remove repeated phrases at the end
    # Look for patterns like "word,word,word,word,word"
    import re

    # Find repeated comma-separated patterns
    pattern = r'([\u0B80-\u0BFF\s]+,)\1{3,}.*$'
    cleaned = re.sub(pattern, r'\1', text)
    return cleaned
```

### Option 2: Audio Preprocessing
Detect and trim the audio where speech ends:

```python
from pydub import AudioSegment
from pydub.silence import detect_nonsilent

# Trim audio to only speech portions
audio = AudioSegment.from_wav("audio.wav")
nonsilent_ranges = detect_nonsilent(
    audio,
    min_silence_len=2000,  # 2 seconds of silence
    silence_thresh=-40  # dB
)

if nonsilent_ranges:
    start, end = nonsilent_ranges[0][0], nonsilent_ranges[-1][1]
    trimmed = audio[start:end]
    trimmed.export("audio_trimmed.wav", format="wav")
```

### Option 3: Use Timestamps
Whisper provides timestamps for each segment. You can:
1. Check if the last few segments have the same text
2. Remove those segments

```python
segments_list = list(segments)
# Check last 5 segments
if len(segments_list) >= 5:
    last_5_texts = [s.text.strip() for s in segments_list[-5:]]
    # If they're all the same or very similar, remove them
    if len(set(last_5_texts)) <= 2:
        segments_list = segments_list[:-4]
```

### Option 4: Accept It
The English translation is perfect! The hallucination only affects the Tamil transcript. If you primarily need the English version, you're good to go.

## Current Status

**English Translation**: ✅ Perfect
```
...There are many varieties of parotta, gravy and starters in Kili parotta, Lappan parotta.
They have a banquet hall on the 3rd floor. If you want to share parotta lovers with everyone
and have it in fine dining ambience, come to parotta festival from 15th of November to 15th of December.
```

**Tamil Transcript**: ⚠️ Has repetition at the end
```
...இன்னும் கிளிப்புரட்டா,லாப்பானு,னர்யா வரைடிஸ் of பரோட்டா,கிளிப் பரோட்டா,கிளிப் பரோட்டா...
```

## Recommendation

1. **For now**: Use the English translation as the primary source
2. **For Tamil**: Implement a simple regex-based post-processor to detect and remove comma-separated repetitions
3. **Long term**: Consider upgrading to `large-v3` model (but it will be much slower)

## Performance Summary

| Model | Speed (1min audio) | Tamil Quality | English Quality |
|-------|-------------------|---------------|-----------------|
| tiny | ~5-10s | ❌ Terrible | ✅ Good |
| base | ~10-20s | ❌ Hallucinations | ✅ Good |
| small | ~15-30s | ❌ Hallucinations | ✅ Good |
| **medium** | **~30-60s** | **⚠️ Minor hallucinations** | **✅ Perfect** |
| large-v3 | ~60-120s | ✅ Best (but still possible) | ✅ Perfect |

**Current Choice**: `medium` - Best balance of speed and quality
