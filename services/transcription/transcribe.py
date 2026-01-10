from faster_whisper import WhisperModel
import subprocess
import os
import time
import json
import logging

logger = logging.getLogger(__name__)

def remove_repetitive_ending(text, min_repeat=3, max_check_words=50):
    """
    Remove repetitive patterns at the end of transcription (hallucination indicator)

    Args:
        text: Input text
        min_repeat: Minimum number of repetitions to consider as hallucination
        max_check_words: Maximum number of words to check from the end

    Returns:
        Cleaned text with repetitive ending removed
    """
    if not text:
        return text

    words = text.split()
    if len(words) < min_repeat * 2:
        return text

    # Check last N words for repetition patterns
    check_length = min(max_check_words, len(words) // 2)

    for pattern_len in range(1, check_length // min_repeat + 1):
        # Extract potential pattern from end
        pattern = words[-pattern_len:]
        pattern_str = " ".join(pattern)

        # Count how many times this pattern repeats at the end
        repeat_count = 0
        pos = len(words) - pattern_len

        while pos >= 0:
            chunk = words[pos:pos + pattern_len]
            if len(chunk) == pattern_len and " ".join(chunk) == pattern_str:
                repeat_count += 1
                pos -= pattern_len
            else:
                break

        # If pattern repeats enough times, it's likely hallucination
        if repeat_count >= min_repeat:
            # Remove all repetitions, keep only one occurrence
            cutoff = len(words) - (pattern_len * repeat_count)
            cleaned_words = words[:cutoff + pattern_len]
            cleaned_text = " ".join(cleaned_words)

            removed_text = " ".join(words[cutoff + pattern_len:])
            logger.info(f"Removed repetitive ending ({repeat_count}x): '{removed_text[:100]}...'")

            return cleaned_text

    return text

# Two-stage architecture:
# - tiny: Fast language detection + English transcription
# - medium: High accuracy for Hindi/Telugu/Tamil transcription in native script

# Models loaded on-demand
_model_tiny = None
_model_medium = None

def get_tiny_model():
    """Get or load tiny model"""
    global _model_tiny
    if _model_tiny is None:
        logger.info("Loading tiny model...")
        _model_tiny = WhisperModel("tiny", device="cpu", compute_type="int8")
        logger.info("Tiny model loaded")
    return _model_tiny

def get_medium_model():
    """Get or load medium model for Indian languages"""
    global _model_medium
    if _model_medium is None:
        logger.info("Loading medium model for Hindi/Telugu/Tamil...")
        _model_medium = WhisperModel("medium", device="cpu", compute_type="int8")
        logger.info("Medium model loaded")
    return _model_medium

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
    Two-stage transcription pipeline for optimal quality and performance:

    Stage 1 - Language Detection (tiny model):
      - Fast, accurate language identification
      - ~1-2 seconds for detection
      - High confidence scores (>95% typical)

    Stage 2 - Transcription (model selection):
      - English (en): tiny model
        * Fast (~5-10s for 1min video)
        * Perfect English accuracy
      - Hindi/Telugu/Tamil (hi/te/ta): medium model
        * Slower (~30-60s for 1min video)
        * Native script output (Devanagari/Telugu/Tamil Unicode)
        * High quality, no hallucinations, culturally accurate
        * BONUS: Also generates English translation for comparison
      - Other languages: tiny with English translation

    Why this architecture:
      - Tiny/small models hallucinate on Indian languages
      - Medium provides excellent accuracy without hallucinations
      - Separation ensures correctness without wasting resources

    Output Files:
      - audio.wav: Extracted audio
      - transcript.txt: Transcription in native language
      - transcript-en.txt: English translation (for hi/te/ta only)
      - transcription-meta.txt: Human-readable metadata summary

    Args:
        shortcode: Instagram reel shortcode
        video_path: Path to video file

    Returns:
        Result dictionary with all paths, transcript, metadata, and timing info
    """
    base_dir = os.path.dirname(video_path)
    audio_path = os.path.join(base_dir, 'audio.wav')
    transcript_path = os.path.join(base_dir, 'transcript.txt')

    start_time = time.time()

    # Step 1: Extract audio
    logger.info(f"Step 1/2: Extracting audio for {shortcode}")
    duration = extract_audio(video_path, audio_path)

    # Step 2: Detect language using tiny model (fast and accurate)
    logger.info(f"Step 2/3: Detecting language for {shortcode}")
    detection_start = time.time()

    # Get tiny model (loads on first use)
    model_tiny = get_tiny_model()

    # Run tiny model just for detection (don't use transcription output)
    _, detection_info = model_tiny.transcribe(
        audio_path,
        task="transcribe",
        language=None,  # Auto-detect
        beam_size=1,  # Minimal beam for speed
        best_of=1
    )

    detected_lang = detection_info.language
    lang_probability = detection_info.language_probability
    detection_time = time.time() - detection_start

    logger.info(f"Language detected: {detected_lang} (confidence: {lang_probability:.4f}, time: {detection_time:.2f}s)")

    # Step 3: Transcribe with appropriate model
    logger.info(f"Step 3/3: Transcribing audio for {shortcode}")
    transcription_start = time.time()

    # Decision logic: Choose model and task based on detected language
    if detected_lang == "en":
        # English: Use tiny, fast and perfect
        logger.info("Using tiny model for English transcription")
        model_to_use = get_tiny_model()
        task = "transcribe"
        language = "en"
        # Standard parameters for English
        transcribe_params = {
            "task": task,
            "language": language,
            "beam_size": 5,
            "best_of": 5,
            "temperature": 0.0
        }
    elif detected_lang in ["hi", "te", "ta"]:
        # Indian languages: Use medium for native script with anti-hallucination measures
        logger.info(f"Using medium model for {detected_lang} transcription (native script)")
        logger.info("Applying VAD filtering and anti-hallucination parameters")
        model_to_use = get_medium_model()
        task = "transcribe"  # Keep in native language (not translate)
        language = detected_lang
        # Enhanced parameters to prevent hallucination/repetition
        transcribe_params = {
            "task": task,
            "language": language,
            "beam_size": 1,  # Greedy decoding - most aggressive anti-hallucination
            "best_of": 1,
            "temperature": 0.0,
            "vad_filter": True,  # Critical: Voice Activity Detection
            "vad_parameters": {
                "threshold": 0.6,  # Increased threshold for stricter speech detection
                "min_speech_duration_ms": 250,
                "max_speech_duration_s": 60.0,  # Limit max speech segment
                "min_silence_duration_ms": 1000  # Reduced to catch shorter pauses
            },
            "condition_on_previous_text": False,  # Critical: Prevents repetition
            "compression_ratio_threshold": 2.0,  # More aggressive filtering
            "log_prob_threshold": -0.8,  # Stricter quality threshold
            "no_speech_threshold": 0.5,  # Lower threshold to catch silence earlier
            "repetition_penalty": 1.2  # Penalize repetitions
        }
    else:
        # Fallback: Use tiny, translate to English
        logger.info(f"Unknown language {detected_lang}, using tiny with English translation")
        model_to_use = get_tiny_model()
        task = "translate"
        language = None
        transcribe_params = {
            "task": task,
            "language": language,
            "beam_size": 5,
            "best_of": 5,
            "temperature": 0.0
        }

    # Run final transcription with chosen model
    segments, final_info = model_to_use.transcribe(
        audio_path,
        **transcribe_params
    )

    # Combine all segments into one transcript
    transcript_parts = []
    for segment in segments:
        transcript_parts.append(segment.text.strip())

    transcript = " ".join(transcript_parts)

    # Post-processing: Detect and remove repetitive endings (hallucination pattern)
    original_length = len(transcript)
    transcript = remove_repetitive_ending(transcript, min_repeat=2, max_check_words=100)
    if len(transcript) < original_length:
        logger.info(f"Removed {original_length - len(transcript)} characters of repetitive text")

    transcription_time = time.time() - transcription_start

    # Save transcript
    with open(transcript_path, 'w', encoding='utf-8') as f:
        f.write(transcript)

    # For Indian languages, also generate English translation for comparison
    english_transcript = None
    english_transcript_path = None
    translation_time = 0.0

    if detected_lang in ["hi", "te", "ta"]:
        logger.info(f"Generating English translation for {detected_lang} audio")
        logger.info("Applying VAD filtering to translation")
        translation_start = time.time()

        # Use medium model to translate to English with anti-hallucination measures
        translation_segments, translation_info = model_to_use.transcribe(
            audio_path,
            task="translate",  # Translate to English
            language=detected_lang,
            beam_size=1,  # Greedy decoding
            best_of=1,
            temperature=0.0,
            vad_filter=True,
            vad_parameters={
                "threshold": 0.6,
                "min_speech_duration_ms": 250,
                "max_speech_duration_s": 60.0,
                "min_silence_duration_ms": 1000
            },
            condition_on_previous_text=False,  # Prevents repetition in translation
            compression_ratio_threshold=2.0,
            log_prob_threshold=-0.8,
            no_speech_threshold=0.5,
            repetition_penalty=1.2
        )

        # Combine translation segments
        translation_parts = []
        for segment in translation_segments:
            translation_parts.append(segment.text.strip())

        english_transcript = " ".join(translation_parts)

        # Post-processing: Remove repetitive endings
        original_length = len(english_transcript)
        english_transcript = remove_repetitive_ending(english_transcript, min_repeat=2, max_check_words=100)
        if len(english_transcript) < original_length:
            logger.info(f"Removed {original_length - len(english_transcript)} characters of repetitive translation text")

        translation_time = time.time() - translation_start

        # Save English translation
        english_transcript_path = os.path.join(base_dir, 'transcript-en.txt')
        with open(english_transcript_path, 'w', encoding='utf-8') as f:
            f.write(english_transcript)

        logger.info(f"English translation saved (time: {translation_time:.2f}s)")

    processing_time = time.time() - start_time

    # Update metadata.json with transcription info
    metadata_path = os.path.join(base_dir, 'metadata.json')
    model_used = "tiny" if detected_lang == "en" or detected_lang not in ["hi", "te", "ta"] else "medium"

    transcription_metadata = {
        "detectedLanguage": detected_lang,
        "languageProbability": round(lang_probability, 4),
        "finalLanguage": final_info.language,
        "modelUsed": model_used,
        "task": task,
        "duration": final_info.duration,
        "transcribedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "detectionTime": round(detection_time, 2),
        "transcriptionTime": round(transcription_time, 2),
        "totalProcessingTime": round(processing_time, 2)
    }

    if english_transcript:
        transcription_metadata["translationTime"] = round(translation_time, 2)
        transcription_metadata["hasEnglishTranslation"] = True

    if os.path.exists(metadata_path):
        with open(metadata_path, 'r', encoding='utf-8') as f:
            metadata = json.load(f)

        metadata['transcription'] = transcription_metadata

        with open(metadata_path, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)

    # Create transcription-meta.txt for quick reference
    meta_txt_path = os.path.join(base_dir, 'transcription-meta.txt')
    with open(meta_txt_path, 'w', encoding='utf-8') as f:
        f.write("=" * 60 + "\n")
        f.write("TRANSCRIPTION METADATA\n")
        f.write("=" * 60 + "\n\n")
        f.write(f"Shortcode: {shortcode}\n")
        f.write(f"Transcribed At: {time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime())}\n\n")
        f.write("-" * 60 + "\n")
        f.write("LANGUAGE DETECTION\n")
        f.write("-" * 60 + "\n")
        f.write(f"Detected Language: {detected_lang}\n")
        f.write(f"Confidence: {lang_probability:.2%}\n")
        f.write(f"Detection Time: {detection_time:.2f}s\n\n")
        f.write("-" * 60 + "\n")
        f.write("TRANSCRIPTION\n")
        f.write("-" * 60 + "\n")
        f.write(f"Model Used: {model_used}\n")
        f.write(f"Task: {task}\n")
        f.write(f"Audio Duration: {final_info.duration:.2f}s\n")
        f.write(f"Transcription Time: {transcription_time:.2f}s\n")
        if english_transcript:
            f.write(f"Translation Time: {translation_time:.2f}s\n")
        f.write(f"Total Processing Time: {processing_time:.2f}s\n\n")
        f.write("-" * 60 + "\n")
        f.write("OUTPUT FILES\n")
        f.write("-" * 60 + "\n")
        f.write(f"Audio: audio.wav\n")
        f.write(f"Transcript ({detected_lang}): transcript.txt\n")
        if english_transcript:
            f.write(f"Translation (en): transcript-en.txt\n")
        f.write("=" * 60 + "\n")

    logger.info(f"Transcription complete for {shortcode}")
    logger.info(f"  Detected: {detected_lang} ({lang_probability:.4f})")
    logger.info(f"  Model: {model_used}")
    logger.info(f"  Task: {task}")
    if english_transcript:
        logger.info(f"  Translation: Generated (time: {translation_time:.2f}s)")
    logger.info(f"  Total time: {processing_time:.2f}s)")

    result = {
        "success": True,
        "shortcode": shortcode,
        "audioPath": audio_path,
        "transcriptPath": transcript_path,
        "transcript": transcript,
        "detectedLanguage": detected_lang,
        "languageProbability": round(lang_probability, 4),
        "modelUsed": model_used,
        "task": task,
        "duration": round(final_info.duration, 2),
        "detectionTime": round(detection_time, 2),
        "transcriptionTime": round(transcription_time, 2),
        "totalProcessingTime": round(processing_time, 2),
        "metaPath": meta_txt_path
    }

    # Add English translation info if available
    if english_transcript:
        result["englishTranscriptPath"] = english_transcript_path
        result["englishTranscript"] = english_transcript
        result["translationTime"] = round(translation_time, 2)

    return result
