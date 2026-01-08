import { useMutation } from "@tanstack/react-query";

import { AsyncReturnType } from "@/types";

import { getVideoInfo, getEnhancedVideoInfo } from "./requests";

export function useVideoInfo() {
  return useMutation<
    AsyncReturnType<typeof getVideoInfo>,
    Error,
    Parameters<typeof getVideoInfo>[0]
  >({
    mutationFn: getVideoInfo,
  });
}

export function useEnhancedVideoInfo() {
  return useMutation<
    AsyncReturnType<typeof getEnhancedVideoInfo>,
    Error,
    Parameters<typeof getEnhancedVideoInfo>[0]
  >({
    mutationFn: getEnhancedVideoInfo,
  });
}
