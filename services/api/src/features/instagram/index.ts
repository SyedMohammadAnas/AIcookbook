import { load } from "cheerio";

import {
  getPostPageHTML,
  getPostGraphqlData,
} from "@/services/instagram/requests";

import { VideoInfo, EnhancedVideoInfo } from "@/types";
import { HTTPError } from "@/lib/errors";

import { INSTAGRAM_CONFIGS } from "./constants";
import { formatGraphqlJson, formatPageJson, formatEnhancedGraphqlJson, formatEnhancedPageJson } from "./utils";

const getVideoJsonFromHTML = async (postId: string) => {
  const data = await getPostPageHTML({ postId });

  const postHtml = load(data);
  const videoElement = postHtml("meta[property='og:video']");

  if (videoElement.length === 0) {
    return null;
  }

  const videoInfo = formatPageJson(postHtml);
  return videoInfo;
};

const getEnhancedVideoJsonFromHTML = async (postId: string, postUrl: string) => {
  const data = await getPostPageHTML({ postId });
  const postHtml = load(data);
  return formatEnhancedPageJson(postHtml, postUrl);
};

const getVideoJSONFromGraphQL = async (postId: string) => {
  const data = await getPostGraphqlData({ postId });

  const mediaData = data.data?.xdt_shortcode_media;

  if (!mediaData) {
    return null;
  }

  if (!mediaData.is_video) {
    throw new HTTPError("This post is not a video", 400);
  }

  const videoInfo = formatGraphqlJson(mediaData);
  return videoInfo;
};

const getEnhancedVideoJSONFromGraphQL = async (postId: string, postUrl: string) => {
  const data = await getPostGraphqlData({ postId });
  const mediaData = data.data?.xdt_shortcode_media;

  if (!mediaData) {
    return null;
  }

  if (!mediaData.is_video) {
    throw new HTTPError("This post is not a video", 400);
  }

  return formatEnhancedGraphqlJson(mediaData, postUrl);
};

export const getVideoInfo = async (postId: string) => {
  let videoInfo: VideoInfo | null = null;

  if (INSTAGRAM_CONFIGS.enableWebpage) {
    videoInfo = await getVideoJsonFromHTML(postId);
    if (videoInfo) return videoInfo;
  }

  if (INSTAGRAM_CONFIGS.enableGraphQL) {
    videoInfo = await getVideoJSONFromGraphQL(postId);
    if (videoInfo) return videoInfo;
  }

  throw new HTTPError("Video link for this post is not public.", 401);
};

export const getEnhancedVideoInfo = async (postId: string, postUrl: string): Promise<EnhancedVideoInfo> => {
  let videoInfo: EnhancedVideoInfo | null = null;

  if (INSTAGRAM_CONFIGS.enableGraphQL) {
    videoInfo = await getEnhancedVideoJSONFromGraphQL(postId, postUrl);
    if (videoInfo) return videoInfo;
  }

  if (INSTAGRAM_CONFIGS.enableWebpage) {
    videoInfo = await getEnhancedVideoJsonFromHTML(postId, postUrl);
    if (videoInfo) return videoInfo;
  }

  throw new HTTPError("Video link for this post is not public.", 401);
};
