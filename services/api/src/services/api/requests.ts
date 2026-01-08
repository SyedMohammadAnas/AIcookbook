import { apiClient } from "@/lib/api-client";

import { CustomError } from "@/lib/errors";

import { APIResponse, VideoInfo, EnhancedResponse } from "@/types";

import { ServerEndpoints } from "./constants";

export async function getVideoInfo({
  postUrl,
}: {
  postUrl: string;
}): Promise<VideoInfo> {
  const searchParams = new URLSearchParams({ postUrl });
  const res = await apiClient.get(
    `${ServerEndpoints.GetByPostURL}?${searchParams.toString()}`
  );

  const json = (await res.json()) as APIResponse<VideoInfo>;

  if (json.status === "error") {
    throw new CustomError(json.message);
  }

  const data = json.data;

  return data;
}

export async function getEnhancedVideoInfo({
  postUrl,
}: {
  postUrl: string;
}): Promise<EnhancedResponse> {
  const searchParams = new URLSearchParams({ postUrl, enhanced: "true" });
  const res = await apiClient.get(
    `${ServerEndpoints.GetByPostURL}?${searchParams.toString()}`
  );

  const json = (await res.json()) as EnhancedResponse;

  if (!json.success) {
    throw new CustomError(json.message || "Failed to get video info");
  }

  return json;
}
