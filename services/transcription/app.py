from flask import Flask, request, jsonify
from flask_cors import CORS
from transcribe import transcribe_video, extract_audio_only
import os
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "service": "transcription",
        "version": "1.0.0"
    })

@app.route('/extract-audio', methods=['POST'])
def extract_audio():
    """
    Extract audio from video file

    Request body:
    {
        "shortcode": "DTQpr8DjlkU"
    }

    Response:
    {
        "success": true,
        "shortcode": "DTQpr8DjlkU",
        "audioPath": "/data/reels/DTQpr8DjlkU/audio.wav",
        "duration": 45.3
    }
    """
    try:
        data = request.json
        shortcode = data.get('shortcode')

        if not shortcode:
            return jsonify({
                "success": False,
                "error": "Missing required field: shortcode"
            }), 400

        video_path = f"/data/reels/{shortcode}/video.mp4"

        if not os.path.exists(video_path):
            return jsonify({
                "success": False,
                "error": f"Video not found: {video_path}"
            }), 404

        logger.info(f"Extracting audio for shortcode: {shortcode}")
        result = extract_audio_only(shortcode, video_path)

        return jsonify(result)

    except Exception as e:
        logger.error(f"Error extracting audio: {str(e)}", exc_info=True)
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/transcribe', methods=['POST'])
def transcribe():
    """
    Transcribe audio from video file

    Request body:
    {
        "shortcode": "DTQpr8DjlkU",
        "caption": "Optional Instagram reel caption"
    }

    Response:
    {
        "success": true,
        "shortcode": "DTQpr8DjlkU",
        "audioPath": "/data/reels/DTQpr8DjlkU/audio.wav",
        "transcriptPath": "/data/reels/DTQpr8DjlkU/transcript.txt",
        "transcript": "First, heat oil in a pan...",
        "detectedLanguage": "hi",
        "duration": 45.3,
        "processingTime": 12.5
    }
    """
    try:
        data = request.json
        shortcode = data.get('shortcode')
        caption = data.get('caption')

        if not shortcode:
            return jsonify({
                "success": False,
                "error": "Missing required field: shortcode"
            }), 400

        video_path = f"/data/reels/{shortcode}/video.mp4"

        if not os.path.exists(video_path):
            return jsonify({
                "success": False,
                "error": f"Video not found: {video_path}"
            }), 404

        logger.info(f"Starting transcription for shortcode: {shortcode}")
        logger.info(f"Video path: {video_path}")
        logger.info(f"Caption received: {caption is not None and len(str(caption or '')) > 0}")
        if caption:
            logger.info(f"Caption length: {len(caption)}")
        result = transcribe_video(shortcode, video_path, caption)

        return jsonify(result)

    except Exception as e:
        logger.error(f"Error transcribing video: {str(e)}", exc_info=True)
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

if __name__ == '__main__':
    logger.info("Starting Transcription Service on port 5000")
    app.run(host='0.0.0.0', port=5000, debug=False)
