import { CheerioAPI } from "cheerio";
import querystring from "querystring";
import fetch from 'node-fetch';
import { getTimedFilename } from "@/lib/utils";
import { createBrotliDecompress } from 'zlib';
import { VideoInfo } from "@/types";
import { MediaData } from "./types";

// Function to generate a video filename
export const getIGVideoFileName = () =>
  getTimedFilename("ig-downloader", "mp4");

// Function to process Instagram share URL and resolve it to the reel ID

export const getPostIdFromUrl = async (postUrl: string): Promise<string> => {
  const shareRegex = /^https:\/\/(?:www\.)?instagram\.com\/share\/([a-zA-Z0-9_-]+)\/?/;
  const postRegex = /^https:\/\/(?:www\.)?instagram\.com\/p\/([a-zA-Z0-9_-]+)\/?/;
  const reelRegex = /^https:\/\/(?:www\.)?instagram\.com\/reels?\/([a-zA-Z0-9_-]+)\/?/;

  if (shareRegex.test(postUrl)) {
    console.log('Detected Share URL');
    try {
      const reelId = await fetchReelIdFromShareURL(postUrl);
      return reelId;
    } catch (error) {
      console.error('Error resolving share URL');
      throw error;
    }
  }

  const postMatch = postUrl.match(postRegex);
  if (postMatch?.[1]) {
    console.log('Matched Post ID');
    return postMatch[1];
  }

  const reelMatch = postUrl.match(reelRegex);
  if (reelMatch?.[1]) {
    console.log('Matched Reel ID');
    return reelMatch[1];
  }

  console.error('No match found');
  throw new Error('Unable to extract ID');
};




// Function to fetch and extract the reel ID from a share URL
export const fetchReelIdFromShareURL = async (shareUrl: string): Promise<string> => {
  try {
    const response = await fetch(shareUrl, { method: 'GET', redirect: 'follow' });

    if (!response.ok) {
      console.error("Failed to fetch share URL");
      throw new Error("Failed to fetch share URL");
    }

    console.log("Final URL after redirects:", response.url);

    const match = response.url.match(/reel\/([a-zA-Z0-9_-]+)/);
    // console.log("match:", match);

    if (!match || !match[1]) {
      throw new Error("Reel ID not found in URL");
    }

    return match[1];
  } catch (error) {
    console.error("Error fetching or parsing share URL:", error);
    throw error; // Re-throw error to allow the caller to handle it.
  }
};


// Function to fetch and decompress Instagram's Brotli-compressed response
export const fetchAndDecompress = async (url: string) => {
  try {
    const response = await fetch(url, { method: 'GET', redirect: 'follow' });

    if (!response.body) {
      throw new Error("No response body.");
    }

    const decompressedChunks: Uint8Array[] = [];
    const brotliDecompressor = createBrotliDecompress();

    return new Promise<Uint8Array>((resolve, reject) => {
      response.body?.on('data', (chunk: Buffer) => {
        try {
          // Convert Buffer directly to Uint8Array safely
          const uint8ArrayChunk = new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength);
          decompressedChunks.push(uint8ArrayChunk);
        } catch (error) {
          reject(error);
        }
      });

      response.body?.on('end', () => {
        const combinedBuffer = Buffer.concat(decompressedChunks);
        resolve(new Uint8Array(combinedBuffer));
      });

      response.body?.on('error', reject);
    });
  } catch (error) {
    console.error("Failed to decompress response body", error);
    throw error;
  }
};

// Function to prepare GraphQL request payload
export const encodeGraphqlRequestData = (shortcode: string) => {
  const requestData = {
    av: "0",
    __d: "www",
    __user: "0",
    __a: "1",
    __req: "3",
    __hs: "19624.HYP:instagram_web_pkg.2.1..0.0",
    dpr: "3",
    __ccg: "UNKNOWN",
    __rev: "1008824440",
    __s: "xf44ne:zhh75g:xr51e7",
    __hsi: "7282217488877343271",
    __dyn:
      "7xeUmwlEnwn8K2WnFw9-2i5U4e0yoW3q32360CEbo1nEhw2nVE4W0om78b87C0yE5ufz81s8hwGwQwoEcE7O2l0Fwqo31w9a9x-0z8-U2zxe2GewGwso88cobEaU2eUlwhEe87q7-0iK2S3qazo7u1xwIw8O321LwTwKG1pg661pwr86C1mwraCg",
    __csr:
      "gZ3yFmJkillQvV6ybimnG8AmhqujGbLADgjyEOWz49z9XDlAXBJpC7Wy-vQTSvUGWGh5u8KibG44dBiigrgjDxGjU0150Q0848azk48N09C02IR0go4SaR70r8owyg9pU0V23hwiA0LQczA48S0f-x-27o05NG0fkw",
    __comet_req: "7",
    lsd: "AVqbxe3J_YA",
    jazoest: "2957",
    __spin_r: "1008824440",
    __spin_b: "trunk",
    __spin_t: "1695523385",
    fb_api_caller_class: "RelayModern",
    fb_api_req_friendly_name: "PolarisPostActionLoadPostQueryQuery",
    variables: JSON.stringify({
      shortcode: shortcode,
      fetch_comment_count: "null",
      fetch_related_profile_media_count: "null",
      parent_comment_count: "null",
      child_comment_count: "null",
      fetch_like_count: "null",
      fetch_tagged_user_count: "null",
      fetch_preview_comment_count: "null",
      has_threaded_comments: "false",
      hoisted_comment_id: "null",
      hoisted_reply_id: "null",
    }),
    server_timestamps: "true",
    doc_id: "10015901848480474",
  };
  const encoded = querystring.stringify(requestData);
  return encoded;
};

// Function to format GraphQL data into a usable video file JSON
export const formatGraphqlJson = (data: MediaData) => {
  const filename = getIGVideoFileName();
  const width = data.dimensions.width.toString();
  const height = data.dimensions.height.toString();
  const videoUrl = data.video_url;

  const videoJson: VideoInfo = {
    filename,
    width,
    height,
    videoUrl,
  };

  return videoJson;
};

// Function to format enhanced GraphQL data
export const formatEnhancedGraphqlJson = (data: MediaData, postUrl: string) => {
  const caption = data.edge_media_to_caption.edges[0]?.node.text || "";
  const shortcode = data.shortcode;
  
  const medias = [];
  
  // Add video media
  if (data.video_url) {
    medias.push({
      id: data.id,
      url: data.video_url,
      thumbnail: data.display_url,
      quality: `${data.dimensions.width}x${data.dimensions.height}p`,
      resolution: `${data.dimensions.width}x${data.dimensions.height}`,
      duration: data.video_duration || 0,
      is_audio: data.has_audio,
      type: "video" as const,
      extension: "mp4"
    });
  }

  return {
    url: postUrl,
    source: "instagram",
    title: caption,
    author: data.owner.full_name,
    shortcode,
    view_count: data.video_view_count || null,
    like_count: data.edge_media_preview_like.count,
    thumbnail: data.display_url,
    duration: data.video_duration || 0,
    owner: {
      username: data.owner.username,
      profile_pic_url: data.owner.profile_pic_url,
      is_unpublished: data.owner.is_unpublished,
      full_name: data.owner.full_name,
      id: data.owner.id,
      pk: data.owner.id,
      friendship_status: null,
      is_verified: data.owner.is_verified,
      is_private: data.owner.is_private,
      profile_pic_url_hd: data.owner.profile_pic_url,
      __typename: "XDTUserDict",
      is_embeds_disabled: data.owner.is_embeds_disabled
    },
    location: null,
    medias,
    type: medias.length > 1 ? "multiple" : "single",
    error: false,
    time_end: Date.now()
  };
};

// Function to format video data from Instagram page meta tags
export const formatPageJson = (postHtml: CheerioAPI) => {
  const videoElement = postHtml("meta[property='og:video']");

  if (videoElement.length === 0) {
    return null;
  }

  const videoUrl = videoElement.attr("content");
  if (!videoUrl) return null;

  const width =
    postHtml("meta[property='og:video:width']").attr("content") ?? "";
  const height =
    postHtml("meta[property='og:video:height']").attr("content") ?? "";

  const filename = getIGVideoFileName();

  const videoJson: VideoInfo = {
    filename,
    width,
    height,
    videoUrl,
  };

  return videoJson;
};

// Function to format enhanced page data
export const formatEnhancedPageJson = (postHtml: CheerioAPI, postUrl: string) => {
  const videoElement = postHtml("meta[property='og:video']");
  if (videoElement.length === 0) return null;

  const videoUrl = videoElement.attr("content");
  if (!videoUrl) return null;

  const width = postHtml("meta[property='og:video:width']").attr("content") ?? "640";
  const height = postHtml("meta[property='og:video:height']").attr("content") ?? "640";
  const title = postHtml("meta[property='og:title']").attr("content") ?? "";
  const description = postHtml("meta[property='og:description']").attr("content") ?? "";
  const thumbnail = postHtml("meta[property='og:image']").attr("content") ?? "";
  
  // Extract shortcode from URL
  const shortcodeMatch = postUrl.match(/\/(p|reel|reels)\/([a-zA-Z0-9_-]+)/);
  const shortcode = shortcodeMatch?.[2] ?? "";

  const medias = [{
    id: `${shortcode}_video`,
    url: videoUrl,
    thumbnail,
    quality: `${width}x${height}p`,
    resolution: `${width}x${height}`,
    duration: 0,
    is_audio: true,
    type: "video" as const,
    extension: "mp4"
  }];

  return {
    url: postUrl,
    source: "instagram",
    title: description || title,
    author: "",
    shortcode,
    view_count: null,
    like_count: 0,
    thumbnail,
    duration: 0,
    owner: {
      username: "",
      profile_pic_url: "",
      is_unpublished: false,
      full_name: "",
      id: "",
      pk: "",
      friendship_status: null,
      is_verified: false,
      is_private: false,
      profile_pic_url_hd: "",
      __typename: "XDTUserDict",
      is_embeds_disabled: false
    },
    location: null,
    medias,
    type: "single",
    error: false,
    time_end: Date.now()
  };
};

// Function to validate Instagram URLs
export const isValidInstagramURL = (postUrl: string) => {
  if (!postUrl) {
    return "Instagram URL was not provided";
  }

  if (!postUrl.includes("instagram.com/")) {
    return "Invalid URL does not contain Instagram domain";
  }

  if (!postUrl.startsWith("https://")) {
    return 'Invalid URL it should start with "https://www.instagram.com..."';
  }

  const postRegex =
    /^https:\/\/(?:www\.)?instagram\.com\/p\/([a-zA-Z0-9_-]+)\/?/;

  const reelRegex =
    /^https:\/\/(?:www\.)?instagram\.com\/reels?\/([a-zA-Z0-9_-]+)\/?/;

  if (!postRegex.test(postUrl) && !reelRegex.test(postUrl)) {
    return "URL does not match Instagram post or reel";
  }

  return "";
};
