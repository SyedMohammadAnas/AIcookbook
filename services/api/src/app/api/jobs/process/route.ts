import { NextRequest, NextResponse } from 'next/server';

interface ProcessRequest {
  url: string;
}

interface ProcessResponse {
  success: boolean;
  shortcode?: string;
  videoPath?: string;
  metadata?: any;
  error?: string;
}

/**
 * Complete processing endpoint that:
 * 1. Fetches metadata from Instagram
 * 2. Downloads the video
 * 3. Returns complete information
 */
export async function POST(request: NextRequest): Promise<NextResponse<ProcessResponse>> {
  try {
    // Manually parse JSON to catch parsing errors
    let body: ProcessRequest;
    try {
      const rawBody = await request.text();
      body = JSON.parse(rawBody);
    } catch (jsonError) {
      console.error('JSON parsing error:', jsonError);
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid JSON in request body',
        },
        { status: 400 }
      );
    }
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

    // Step 1: Get metadata
    const metadataUrl = `http://localhost:3000/api/video?postUrl=${encodeURIComponent(url)}`;
    console.log('Fetching metadata from:', metadataUrl);
    const metadataResponse = await fetch(metadataUrl);

    if (!metadataResponse.ok) {
      console.error('Metadata response status:', metadataResponse.status);
      console.error('Metadata response statusText:', metadataResponse.statusText);
      const errorText = await metadataResponse.text();
      console.error('Metadata response body:', errorText);
      throw new Error(`Failed to fetch video metadata: ${metadataResponse.status} ${metadataResponse.statusText}`);
    }

    const metadata = await metadataResponse.json();

    if (metadata.status !== 'success' || !metadata.data) {
      throw new Error(metadata.error || 'Failed to get video metadata');
    }

    // Extract shortcode from URL (e.g., "DTQpr8DjlkU" from "https://www.instagram.com/reel/DTQpr8DjlkU/" or "https://www.instagram.com/p/DTQpr8DjlkU/")
    const urlMatch = url.match(/\/(?:reel|p)\/([A-Za-z0-9_-]+)/);
    const shortcode = urlMatch ? urlMatch[1] : 'unknown';

    const mediaUrl = metadata.data.videoUrl;

    if (!mediaUrl) {
      throw new Error('No video URL found in metadata');
    }

    // Step 2: Download video
    const downloadResponse = await fetch(`http://localhost:3000/api/jobs/download`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        shortcode,
        mediaUrl,
      }),
    });

    if (!downloadResponse.ok) {
      throw new Error('Failed to download video');
    }

    const downloadResult = await downloadResponse.json();

    if (!downloadResult.success) {
      throw new Error(downloadResult.error || 'Failed to download video');
    }

    return NextResponse.json({
      success: true,
      shortcode,
      videoPath: downloadResult.videoPath,
      metadata: metadata.data,
    });

  } catch (error) {
    console.error('Error processing video:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}
