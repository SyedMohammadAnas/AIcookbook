from faster_whisper import WhisperModel
import subprocess
import os
import time
import json
import logging

logger = logging.getLogger(__name__)

# Load model once at startup (small model for balance of speed and accuracy)
logger.info("Loading Whisper model (small)...")
model = WhisperModel("small", device="cpu", compute_type="int8")
logger.info("Whisper model loaded successfully")

def extract_audio(video_path, audio_path):
    """
    Extract audio from video using FFmpeg

    Args:
        video_path: Path to input video file
        audio_path: Path to output audio file (WAV)

    Returns:
        Duration of audio in seconds
    """
    logger.info(f"Extracting audio: {video_path} -> {audio_path}")

    cmd = [
        'ffmpeg',
        '-i', video_path,
        '-vn',  # No video
        '-acodec', 'pcm_s16le',  # PCM 16-bit
        '-ar', '16000',  # 16kHz sample rate (whisper optimal)
        '-ac', '1',  # Mono
        audio_path,
        '-y'  # Overwrite existing file
    ]

    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True
    )

    if result.returncode != 0:
        logger.error(f"FFmpeg error: {result.stderr}")
        raise Exception(f"Failed to extract audio: {result.stderr}")

    # Get audio duration
    duration_cmd = [
        'ffprobe',
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        audio_path
    ]

    duration_result = subprocess.run(
        duration_cmd,
        capture_output=True,
        text=True
    )

    try:
        duration = float(duration_result.stdout.strip())
    except:
        duration = 0.0

    logger.info(f"Audio extracted successfully (duration: {duration:.2f}s)")
    return duration

def extract_audio_only(shortcode, video_path):
    """
    Extract audio only without transcription

    Args:
        shortcode: Instagram reel shortcode
        video_path: Path to video file

    Returns:
        Result dictionary with audio path and duration
    """
    base_dir = os.path.dirname(video_path)
    audio_path = os.path.join(base_dir, 'audio.wav')

    start_time = time.time()

    # Extract audio
    duration = extract_audio(video_path, audio_path)

    processing_time = time.time() - start_time

    return {
        "success": True,
        "shortcode": shortcode,
        "audioPath": audio_path,
        "duration": duration,
        "processingTime": round(processing_time, 2)
    }

def transcribe_video(shortcode, video_path):
    """
    Complete transcription pipeline: extract audio + transcribe

    Args:
        shortcode: Instagram reel shortcode
        video_path: Path to video file

    Returns:
        Result dictionary with all paths, transcript, and metadata
    """
    base_dir = os.path.dirname(video_path)
    audio_path = os.path.join(base_dir, 'audio.wav')
    transcript_path = os.path.join(base_dir, 'transcript.txt')

    start_time = time.time()

    # Step 1: Extract audio
    logger.info(f"Step 1/2: Extracting audio for {shortcode}")
    duration = extract_audio(video_path, audio_path)

    # Step 2: Transcribe
    logger.info(f"Step 2/2: Transcribing audio for {shortcode}")
    segments, info = model.transcribe(
        audio_path,
        task="translate",  # Translate to English (Hindi/Telugu/Tamil -> English)
        language=None,  # Auto-detect language
        beam_size=5,
        best_of=5,
        temperature=0.0
    )

    # Combine all segments into one transcript
    transcript_parts = []
    for segment in segments:
        transcript_parts.append(segment.text.strip())

    transcript = " ".join(transcript_parts)

    # Step 3: Save transcript
    with open(transcript_path, 'w', encoding='utf-8') as f:
        f.write(transcript)

    processing_time = time.time() - start_time

    # Step 4: Update metadata.json with transcription info
    metadata_path = os.path.join(base_dir, 'metadata.json')
    if os.path.exists(metadata_path):
        with open(metadata_path, 'r', encoding='utf-8') as f:
            metadata = json.load(f)

        metadata['transcription'] = {
            "detectedLanguage": info.language,
            "languageProbability": info.language_probability,
            "duration": info.duration,
            "transcribedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "processingTime": round(processing_time, 2)
        }

        with open(metadata_path, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)

    logger.info(f"Transcription complete for {shortcode} (language: {info.language}, time: {processing_time:.2f}s)")

    return {
        "success": True,
        "shortcode": shortcode,
        "audioPath": audio_path,
        "transcriptPath": transcript_path,
        "transcript": transcript,
        "detectedLanguage": info.language,
        "languageProbability": round(info.language_probability, 4),
        "duration": round(info.duration, 2),
        "processingTime": round(processing_time, 2)
    }
