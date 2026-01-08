export type SiteConfig = {
  name: string;
  description: string;
  url: string;
  ogImageUrl: string;
  links: {
    twitter: string;
    github: string;
  };
};

export type Unit = "ms" | "s" | "m" | "h" | "d";
export type Duration = `${number} ${Unit}` | `${number}${Unit}`;

export type VideoInfo = {
  filename: string;
  width: string;
  height: string;
  videoUrl: string;
};

export type MediaItem = {
  id: string;
  url: string;
  thumbnail?: string;
  quality: string;
  resolution: string | null;
  duration: number;
  is_audio: boolean;
  type: "video" | "audio";
  extension: string;
  mimeType?: string;
  codec?: string;
  bandwidth?: number;
  frameRate?: number | null;
};

export type Owner = {
  username: string;
  profile_pic_url: string;
  is_unpublished: boolean;
  full_name: string;
  id: string;
  pk: string;
  friendship_status: null;
  is_verified: boolean;
  is_private: boolean;
  profile_pic_url_hd: string;
  __typename: string;
  is_embeds_disabled: boolean;
};

export type EnhancedVideoInfo = {
  url: string;
  source: string;
  title: string;
  author: string;
  shortcode: string;
  view_count: number | null;
  like_count: number;
  thumbnail: string;
  duration: number;
  owner: Owner;
  location: null;
  medias: MediaItem[];
  type: string;
  error: boolean;
  time_end: number;
};

export type EnhancedResponse = {
  success: boolean;
  message: string;
  data: EnhancedVideoInfo;
  timestamp: string;
};

export type SuccessResponse<T> = {
  status: "success";
  message?: string;
  data: T;
};

export type EnhancedSuccessResponse = {
  success: boolean;
  message: string;
  data: EnhancedVideoInfo;
  timestamp: string;
};

export type ErrorResponse = {
  status: "error";
  message: string;
};

export type APIResponse<T> = SuccessResponse<T> | ErrorResponse;

export type AsyncReturnType<T extends (...args: any) => any> = T extends (
  ...args: any
) => Promise<infer R>
  ? R
  : never;
