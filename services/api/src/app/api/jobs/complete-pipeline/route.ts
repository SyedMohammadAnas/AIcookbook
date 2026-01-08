import { NextRequest, NextResponse } from 'next/server';

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

    // Step 1: Download video
    console.log('Step 1/2: Downloading video...');
    const downloadResponse = await fetch('http://localhost:3000/api/jobs/process', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    });

    if (!downloadResponse.ok) {
      throw new Error('Failed to download video');
    }

    const downloadResult = await downloadResponse.json();

    if (!downloadResult.success) {
      throw new Error(downloadResult.error || 'Failed to download video');
    }

    const { shortcode } = downloadResult;
    console.log(`Video downloaded: ${shortcode}`);

    // Step 2: Transcribe
    console.log('Step 2/2: Transcribing...');
    const transcribeResponse = await fetch('http://localhost:5000/transcribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ shortcode }),
    });

    if (!transcribeResponse.ok) {
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
        videoPath: downloadResult.videoPath,
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
