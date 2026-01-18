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

/**
 * Extract transcription and caption from transcription-meta.json file
 */
async function extractTranscriptionData(shortcode: string): Promise<{ transcription: string; caption: string; detectedLanguage: string }> {
  const DATA_DIR = '/data/reels';
  const metaPath = `${DATA_DIR}/${shortcode}/transcription-meta.json`;

  try {
    const metaContent = await fs.readFile(metaPath, 'utf-8');
    const metaData = JSON.parse(metaContent);

    return {
      transcription: metaData.output.transcription || '',
      caption: metaData.output.caption || '',
      detectedLanguage: metaData.language_detection.language || 'en'
    };
  } catch (error) {
    console.error('Failed to read transcription-meta.json:', error);
    return { transcription: '', caption: '', detectedLanguage: 'en' };
  }
}

/**
 * Process transcription data through LLM to extract structured recipe
 */
async function processRecipeWithLLM(shortcode: string): Promise<RecipeData> {
  try {
    // Extract transcription and caption from transcription-meta.json
    const { transcription, caption, detectedLanguage } = await extractTranscriptionData(shortcode);

    if (!transcription && !caption) {
      throw new Error('No transcription or caption data found');
    }

    console.log(`[LLM] Processing recipe extraction for shortcode: ${shortcode}`);

    // Recipe extraction system prompt
    const systemPrompt = `You are a recipe extraction assistant. Your task is to analyze Instagram reel transcriptions and captions to extract structured recipe information.

DETECTED LANGUAGE: ${detectedLanguage}
NOTE: If the detected language is not English, focus on extracting any English recipe content that may be present in the caption, as the transcription may be translated.

INPUT DATA:
- TRANSCRIPTION: [Audio transcription from the reel - may be translated to English]
- CAPTION: [Original text caption from the Instagram post]

INSTRUCTIONS:
1. Read both the transcription and caption carefully
2. IGNORE promotional content, app recommendations, content hooks, and irrelevant information
3. Extract ONLY cooking-related information
4. If ingredients/instructions appear in both transcription and caption, combine and deduplicate them
5. Prioritize the caption for accurate ingredient quantities and instructions when available
6. Output a clean JSON object with the following structure

OUTPUT FORMAT (JSON only, no markdown):
{
  "recipe_name": "Name of the dish",
  "servings": "Number of servings or portions",
  "prep_time": "Preparation time (e.g., '15 minutes')",
  "cook_time": "Cooking time (e.g., '30 minutes')",
  "total_time": "Total time (e.g., '45 minutes')",
  "ingredients": [
    {
      "item": "ingredient name",
      "quantity": "amount",
      "unit": "measurement unit",
      "notes": "any preparation notes (optional)"
    }
  ],
  "instructions": [
    {
      "step": 1,
      "instruction": "Detailed step description"
    }
  ],
  "tags": ["tag1", "tag2"],
  "cuisine": "Type of cuisine",
  "difficulty": "easy/medium/hard"
}

TRANSCRIPTION:
${transcription}

CAPTION:
${caption}

Extract the recipe information now:`;

    // Call LLM API
    const llmResponse = await fetch('http://llm-processor:11434/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama3.2:3b',
        prompt: systemPrompt,
        stream: false,
        format: 'json'
      }),
      signal: AbortSignal.timeout(240000), // 240 seconds timeout for first request
    });

    if (!llmResponse.ok) {
      throw new Error(`LLM API request failed: ${llmResponse.status} ${llmResponse.statusText}`);
    }

    const llmResult = await llmResponse.json();

    if (!llmResult.response) {
      throw new Error('LLM returned empty response');
    }

    // Parse the JSON response
    let recipeData: RecipeData;
    try {
      recipeData = JSON.parse(llmResult.response);
    } catch (parseError) {
      console.error('Failed to parse LLM response as JSON:', llmResult.response);
      throw new Error('LLM returned invalid JSON response');
    }

    // Validate basic structure
    if (!recipeData.ingredients || !Array.isArray(recipeData.ingredients)) {
      throw new Error('LLM response missing required ingredients array');
    }

    // Save recipe.json file
    const recipePath = `/data/reels/${shortcode}/recipe.json`;
    await fs.writeFile(recipePath, JSON.stringify(recipeData, null, 2));

    console.log(`[LLM] Successfully extracted recipe for shortcode: ${shortcode}`);

    return recipeData;

  } catch (error) {
    console.error(`[LLM] Error processing recipe for ${shortcode}:`, error);
    throw error;
  }
}

interface CompletePipelineRequest {
  url: string;
}

interface RecipeData {
  recipe_name: string;
  servings: string;
  prep_time: string;
  cook_time: string;
  total_time: string;
  ingredients: Array<{
    item: string;
    quantity: string;
    unit: string;
    notes?: string;
  }>;
  instructions: Array<{
    step: number;
    instruction: string;
  }>;
  tags: string[];
  cuisine: string;
  difficulty: string;
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
  recipe?: RecipeData;
  recipePath?: string;
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

    // Save Instagram metadata to metadata.json
    const metadataPath = `${reelDir}/metadata.json`;
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    console.log(`[COMPLETE PIPELINE] Saved metadata to: ${metadataPath}`);

    // Download thumbnail image
    const thumbnailUrl = metadata.data.thumbnail;
    if (thumbnailUrl) {
      try {
        console.log(`[COMPLETE PIPELINE] Downloading thumbnail...`);
        const thumbnailResponse = await fetch(thumbnailUrl);
        if (thumbnailResponse.ok) {
          // @ts-ignore: Buffer is available in Node.js runtime
          const thumbnailBuffer = Buffer.from(await thumbnailResponse.arrayBuffer());
          const thumbnailPath = `${reelDir}/thumbnail.jpg`;
          await fs.writeFile(thumbnailPath, thumbnailBuffer);
          console.log(`[COMPLETE PIPELINE] Saved thumbnail to: ${thumbnailPath}`);
        } else {
          console.warn(`[COMPLETE PIPELINE] Failed to download thumbnail: ${thumbnailResponse.status}`);
        }
      } catch (thumbnailError) {
        console.warn(`[COMPLETE PIPELINE] Thumbnail download failed:`, thumbnailError);
      }
    }

    // Download profile picture
    const profilePicUrl = metadata.data.owner?.profile_pic_url;
    if (profilePicUrl) {
      try {
        console.log(`[COMPLETE PIPELINE] Downloading profile picture...`);
        const profileResponse = await fetch(profilePicUrl);
        if (profileResponse.ok) {
          // @ts-ignore: Buffer is available in Node.js runtime
          const profileBuffer = Buffer.from(await profileResponse.arrayBuffer());
          const profilePath = `${reelDir}/profile.jpg`;
          await fs.writeFile(profilePath, profileBuffer);
          console.log(`[COMPLETE PIPELINE] Saved profile picture to: ${profilePath}`);
        } else {
          console.warn(`[COMPLETE PIPELINE] Failed to download profile picture: ${profileResponse.status}`);
        }
      } catch (profileError) {
        console.warn(`[COMPLETE PIPELINE] Profile picture download failed:`, profileError);
      }
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

    // Create transcription-meta.json with structured data
    try {
      const metaJsonPath = `${reelDir}/transcription-meta.json`;

      const transcriptionMetaData = {
        metadata: {
          shortcode: shortcode,
          transcribed_at: new Date().toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC')
        },
        language_detection: {
          language: transcribeResult.detectedLanguage || 'en',
          confidence_percent: transcribeResult.confidence ? parseFloat((transcribeResult.confidence * 100).toFixed(1)) : 99.8,
          detection_time_seconds: transcribeResult.detectionTime ? parseFloat(transcribeResult.detectionTime.toFixed(2)) : 0.25
        },
        transcription_info: {
          model_used: transcribeResult.model || 'tiny',
          task: 'transcribe',
          audio_duration_seconds: transcribeResult.audioDuration ? parseFloat(transcribeResult.audioDuration.toFixed(2)) : 0,
          transcription_time_seconds: transcribeResult.transcriptionTime ? parseFloat(transcribeResult.transcriptionTime.toFixed(2)) : 0,
          total_processing_time_seconds: transcribeResult.totalProcessingTime ? parseFloat(transcribeResult.totalProcessingTime.toFixed(2)) : 0
        },
        output: {
          transcription: transcribeResult.transcript,
          caption: caption || 'No caption available'
        }
      };

      await fs.writeFile(metaJsonPath, JSON.stringify(transcriptionMetaData, null, 2));
      console.log(`[COMPLETE PIPELINE] Saved transcription metadata to: ${metaJsonPath}`);
    } catch (updateError) {
      console.error('Transcription metadata save failed:', updateError instanceof Error ? updateError.message : String(updateError));
    }

    console.log(`[COMPLETE PIPELINE] Completed transcription: ${shortcode}`);

    // Stage 2: Process transcription through LLM for recipe extraction
    console.log(`[COMPLETE PIPELINE] Starting LLM recipe extraction...`);

    let recipeData: RecipeData | undefined;
    let recipePath: string | undefined;

    try {
      recipeData = await processRecipeWithLLM(shortcode);
      recipePath = `/data/reels/${shortcode}/recipe.json`;
      console.log(`[COMPLETE PIPELINE] Recipe extraction completed: ${shortcode}`);
    } catch (llmError) {
      console.error(`[COMPLETE PIPELINE] LLM processing failed for ${shortcode}:`, llmError);
      // Continue with pipeline even if LLM fails - don't throw error
      console.log(`[COMPLETE PIPELINE] Continuing without recipe extraction due to LLM error`);
    }

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
      recipe: recipeData,
      recipePath,
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
