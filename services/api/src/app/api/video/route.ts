import { NextResponse } from "next/server";

import { HTTPError } from "@/lib/errors";
import { makeErrorResponse, makeSuccessResponse } from "@/lib/http";

import { VideoInfo, EnhancedResponse } from "@/types";
import { getVideoInfo, getEnhancedVideoInfo } from "@/features/instagram";
import { INSTAGRAM_CONFIGS } from "@/features/instagram/constants";
import { getPostIdFromUrl } from "@/features/instagram/utils";

function handleError(error: any) {
  if (error instanceof HTTPError) {
    const response = makeErrorResponse(error.message);
    return NextResponse.json(response, { status: error.status });
  } else {
    console.error(error);
    const response = makeErrorResponse();
    return NextResponse.json(response, { status: 500 });
  }
}

export async function GET(request: Request) {
  if (!INSTAGRAM_CONFIGS.enableServerAPI) {
    const notImplementedResponse = makeErrorResponse("Not Implemented");
    return NextResponse.json(notImplementedResponse, { status: 501 });
  }

  const url = new URL(request.url);
  const postUrl = url.searchParams.get("postUrl");
  const enhanced = url.searchParams.get("enhanced") === "true";

  if (!postUrl) {
    const badRequestResponse = makeErrorResponse("Post URL is required");
    return NextResponse.json(badRequestResponse, { status: 400 });
  }

  const postId = await getPostIdFromUrl(postUrl);
  if (!postId) {
    const noPostIdResponse = makeErrorResponse("Invalid Post URL");
    return NextResponse.json(noPostIdResponse, { status: 400 });
  }

  try {
    if (enhanced) {
      const enhancedData = await getEnhancedVideoInfo(postId, postUrl);
      const response: EnhancedResponse = {
        success: true,
        message: "success",
        data: enhancedData,
        timestamp: new Date().toISOString()
      };
      return new NextResponse(JSON.stringify(response, null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } else {
      const postJson = await getVideoInfo(postId);
      const response = makeSuccessResponse<VideoInfo>(postJson);
      return new NextResponse(JSON.stringify(response, null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
  } catch (error: any) {
    return handleError(error);
  }
}
