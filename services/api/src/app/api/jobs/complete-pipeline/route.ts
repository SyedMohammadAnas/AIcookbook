// @ts-ignore: Next.js and Node.js types are available at runtime
import { NextRequest, NextResponse } from 'next/server';
// @ts-ignore: Node.js fs module is available
import { promises as fs } from 'fs';

import { HTTPError } from "@/lib/errors";
import { getEnhancedVideoInfo } from "@/features/instagram";
import { INSTAGRAM_CONFIGS } from "@/features/instagram/constants";
import { getPostIdFromUrl } from "@/features/instagram/utils";

// Simple in-memory cache to prevent duplicate processing
const processingCache = new Set<string>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

setInterval(() => {
  processingCache.clear(); // Clean cache every 5 minutes
}, CACHE_TTL);

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
  let url: string = '';

  try {
    const body: CompletePipelineRequest = await request.json();
    url = body.url;

    if (!url) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required field: url',
        },
        { status: 400 }
      );
    }

    // Check for duplicate processing
    if (processingCache.has(url)) {
      console.log(`[COMPLETE PIPELINE] Skipping duplicate request for: ${url}`);
      return NextResponse.json(
        {
          success: false,
          error: 'Request already being processed',
        },
        { status: 409 }
      );
    }

    processingCache.add(url);

    console.log(`[COMPLETE PIPELINE] Processing: ${url}`);

    // Get metadata directly (enhanced=true to get caption)
    if (!INSTAGRAM_CONFIGS.enableServerAPI) {
      throw new Error('Instagram API not enabled');
    }

    const postId = await getPostIdFromUrl(url);
    if (!postId) {
      throw new Error('Invalid Post URL');
    }

    console.log(`[COMPLETE PIPELINE] Fetched post ID: ${postId}`);

    const metadata = {
      success: true,
      message: "success",
      data: await getEnhancedVideoInfo(postId, url),
      timestamp: new Date().toISOString()
    };

    // Extract shortcode from URL
    const urlMatch = url.match(/\/(?:reel|p)\/([A-Za-z0-9_-]+)/);
    const shortcode = urlMatch ? urlMatch[1] : 'unknown';

    const mediaUrl = metadata.data.medias?.[0]?.url;

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
    // @ts-ignore: Buffer is a Node.js global
    const buffer = Buffer.from(arrayBuffer);

    // Save video file
    const videoPath = `${reelDir}/video.mp4`;
    await fs.writeFile(videoPath, buffer);

    // Extract caption from metadata
    const caption = metadata.data?.title || '';

    console.log(`[COMPLETE PIPELINE] Starting transcription...`);

    let transcribeResponse;
    const maxRetries = 3;
    const retryDelay = 2000; // 2 seconds

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        transcribeResponse = await fetch('http://172.19.0.2:5000/transcribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ shortcode, caption }),
          signal: AbortSignal.timeout(10000),
        });
        break;
      } catch (fetchError) {
        if (attempt === maxRetries) {
          throw new Error(`Transcription service failed: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`);
        }
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

    // Update transcription-meta.txt with transcription content and caption
    try {
      const metaPath = `${reelDir}/transcription-meta.txt`;
      let metaContent = await fs.readFile(metaPath, 'utf-8');

      // Replace OUTPUT FILES section with output data
      const outputSection = `------------------------------------------------------------
OUTPUT DATA
------------------------------------------------------------
1. TRANSCRIPTION:
${transcribeResult.transcript}

2. CAPTION:
${caption || 'No caption available'}

============================================================`;

      metaContent = metaContent.replace(
        /------------------------------------------------------------\s*OUTPUT FILES\s*------------------------------------------------------------[\s\S]*$/m,
        outputSection
      );

      await fs.writeFile(metaPath, metaContent, 'utf-8');
    } catch (updateError) {
      console.error('Meta update failed:', updateError instanceof Error ? updateError.message : String(updateError));
    }

    console.log(`[COMPLETE PIPELINE] Completed: ${shortcode}`);

    // Clean up cache
    processingCache.delete(url);

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

    // Clean up cache on error
    processingCache.delete(url);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}
