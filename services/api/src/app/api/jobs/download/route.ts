import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

const DATA_DIR = '/data/reels';

interface DownloadRequest {
  shortcode: string;
  mediaUrl: string;
}

interface DownloadResponse {
  success: boolean;
  shortcode: string;
  videoPath: string;
  message?: string;
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<DownloadResponse>> {
  try {
    const body: DownloadRequest = await request.json();
    const { shortcode, mediaUrl } = body;

    // Validate input
    if (!shortcode || !mediaUrl) {
      return NextResponse.json(
        {
          success: false,
          shortcode: shortcode || '',
          videoPath: '',
          error: 'Missing required fields: shortcode and mediaUrl',
        },
        { status: 400 }
      );
    }

    // Create directory for this reel
    const reelDir = join(DATA_DIR, shortcode);

    if (!existsSync(reelDir)) {
      try {
        await mkdir(reelDir, { recursive: true });
      } catch (mkdirError) {
        console.error('Failed to create directory:', mkdirError);
        return NextResponse.json(
          {
            success: false,
            shortcode,
            videoPath: '',
            error: `Permission denied: Cannot create directory ${reelDir}. Please check Docker volume permissions.`,
          },
          { status: 500 }
        );
      }
    }

    // Download video
    console.log(`Downloading video for shortcode: ${shortcode}`);
    console.log(`URL: ${mediaUrl}`);

    const response = await fetch(mediaUrl);

    if (!response.ok) {
      throw new Error(`Failed to download video: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer) as Buffer;

    // Save video file
    const videoPath = join(reelDir, 'video.mp4');
    await writeFile(videoPath, buffer);

    console.log(`Video saved successfully: ${videoPath}`);

    // Save metadata
    const metadata = {
      shortcode,
      mediaUrl,
      downloadedAt: new Date().toISOString(),
      videoPath,
      fileSize: buffer.length,
    };

    const metadataPath = join(reelDir, 'metadata.json');
    await writeFile(metadataPath, JSON.stringify(metadata, null, 2));

    return NextResponse.json({
      success: true,
      shortcode,
      videoPath,
      message: 'Video downloaded successfully',
    });

  } catch (error) {
    console.error('Error downloading video:', error);

    return NextResponse.json(
      {
        success: false,
        shortcode: '',
        videoPath: '',
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}
