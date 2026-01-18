import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';

interface CompletePipelineRequest {
  url: string;
}

interface CompletePipelineResponse {
  success: boolean;
  shortcode?: string;
  stage1?: {
    videoPath: string;
    audioPath: string;
    transcriptPath: string;
    transcript: string;
    detectedLanguage: string;
  };
  error?: string;
}

/**
 * Complete Stage 1 pipeline:
 * 1. Download video from Instagram
 * 2. Extract audio
 * 3. Transcribe to English
 */
export async function POST(request: NextRequest): Promise<NextResponse<CompletePipelineResponse>> {
  try {
    const body: CompletePipelineRequest = await request.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required field: url',
        },
        { status: 400 }
      );
    }

    console.log(`Starting complete pipeline for URL: ${url}`);
    console.log('DEBUG: About to get metadata');

    // Step 1: Get metadata and download video
    console.log('Step 1/3: Getting metadata...');

    // Get metadata from video endpoint (enhanced=true to get caption)
    const metadataUrl = `http://localhost:3000/api/video?postUrl=${encodeURIComponent(url)}&enhanced=true`;
    const metadataResponse = await fetch(metadataUrl);

    if (!metadataResponse.ok) {
      console.error('Metadata response status:', metadataResponse.status);
      console.error('Metadata response statusText:', metadataResponse.statusText);
      const errorText = await metadataResponse.text();
      console.error('Metadata response body:', errorText);
      throw new Error(`Failed to fetch video metadata: ${metadataResponse.status} ${metadataResponse.statusText}`);
    }

    const metadata = await metadataResponse.json();

    if (!metadata.success || !metadata.data) {
      throw new Error(metadata.error || 'Failed to get video metadata');
    }

    // Extract shortcode from URL
    const urlMatch = url.match(/\/(?:reel|p)\/([A-Za-z0-9_-]+)/);
    const shortcode = urlMatch ? urlMatch[1] : 'unknown';

    const mediaUrl = metadata.data.videoUrl || metadata.data.medias?.[0]?.url;

    if (!mediaUrl) {
      throw new Error('No video URL found in metadata');
    }

    console.log('Step 2/3: Downloading video...');

    // Download video directly (same logic as download endpoint)
    const DATA_DIR = '/data/reels';
    const reelDir = `${DATA_DIR}/${shortcode}`;

    // Create directory
    try {
      await fs.mkdir(reelDir, { recursive: true });
    } catch (mkdirError) {
      console.error('Failed to create directory:', mkdirError);
      throw new Error(`Permission denied: Cannot create directory ${reelDir}`);
    }

    // Download video
    console.log(`Downloading video for shortcode: ${shortcode}`);
    console.log(`URL: ${mediaUrl}`);

    const videoResponse = await fetch(mediaUrl);

    if (!videoResponse.ok) {
      throw new Error(`Failed to download video: ${videoResponse.statusText}`);
    }

    const arrayBuffer = await videoResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Save video file
    const videoPath = `${reelDir}/video.mp4`;
    await fs.writeFile(videoPath, buffer);

    console.log(`Video saved successfully: ${videoPath}`);
    console.log(`Video downloaded: ${shortcode}`);

    // Step 3: Transcribe
    console.log('Step 3/3: Transcribing...');

    // Extract caption from metadata (try multiple sources)
    let caption = metadata.data?.title || '';
    if (!caption) {
      caption = metadata.data?.edge_media_to_caption?.edges?.[0]?.node?.text || '';
    }
    console.log('Caption extraction debug:');
    console.log('- metadata.data exists:', !!metadata.data);
    console.log('- metadata.data.title:', metadata.data?.title?.substring(0, 100) + '...');
    console.log('- Final caption length:', caption.length);

    console.log('Attempting to call transcription service...');
    console.log('Shortcode:', shortcode);
    console.log('Final Caption length:', caption ? caption.length : 0);
    console.log('Sending JSON:', JSON.stringify({ shortcode, caption: caption.substring(0, 50) + '...' }));

    let transcribeResponse;
    const maxRetries = 3;
    const retryDelay = 2000; // 2 seconds

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Transcription service call attempt ${attempt}/${maxRetries}`);
        transcribeResponse = await fetch('http://172.19.0.2:5000/transcribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ shortcode, caption }),
          signal: AbortSignal.timeout(10000), // 10 second timeout per attempt
        });
        console.log('Transcription service call successful');
        break; // Success, exit retry loop
      } catch (fetchError) {
        const errorMessage =
          fetchError instanceof Error
            ? fetchError.message
            : typeof fetchError === 'string'
              ? fetchError
              : 'Unknown error';

        console.error(`Transcription service call attempt ${attempt} failed:`, errorMessage);

        if (attempt === maxRetries) {
          throw new Error(`Transcription service unavailable after ${maxRetries} attempts: ${errorMessage}`);
        }

        console.log(`Waiting ${retryDelay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }

    if (!transcribeResponse || !transcribeResponse.ok) {
      throw new Error('Failed to transcribe video');
    }

    const transcribeResult = await transcribeResponse.json();

    if (!transcribeResult.success) {
      throw new Error(transcribeResult.error || 'Failed to transcribe video');
    }

    console.log(`Pipeline complete: ${shortcode}`);

    return NextResponse.json({
      success: true,
      shortcode,
      stage1: {
        videoPath,
        audioPath: transcribeResult.audioPath,
        transcriptPath: transcribeResult.transcriptPath,
        transcript: transcribeResult.transcript,
        detectedLanguage: transcribeResult.detectedLanguage,
      },
    });

  } catch (error) {
    console.error('Pipeline error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}
