import { useState, useCallback } from 'react';
import { useAuthStore } from '../store/auth';
import type { UploadVideoResponse, VideoAssociationsResponse } from '../types';

export function useVideos() {
  const client = useAuthStore((s) => s.client);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const uploadVideo = useCallback(
    async (file: File): Promise<UploadVideoResponse | null> => {
      if (!client) return null;
      setUploading(true);
      setProgress(0);
      setError(null);
      try {
        // Simulate progress (real XHR progress would need XMLHttpRequest)
        const timer = setInterval(() => {
          setProgress((p) => Math.min(p + 10, 90));
        }, 200);
        const result = await client.uploadVideo(file);
        clearInterval(timer);
        setProgress(100);
        return result;
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Upload failed');
        return null;
      } finally {
        setUploading(false);
      }
    },
    [client]
  );

  const downloadVideo = useCallback(
    async (videoId: string, filename?: string): Promise<void> => {
      if (!client) return;
      try {
        const blob = await client.downloadVideo(videoId);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || `video-${videoId}`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Download failed');
      }
    },
    [client]
  );

  const getAssociations = useCallback(
    async (videoId: string): Promise<VideoAssociationsResponse | null> => {
      if (!client) return null;
      try {
        return await client.getVideoAssociations(videoId);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Unknown error');
        return null;
      }
    },
    [client]
  );

  return { uploading, progress, error, uploadVideo, downloadVideo, getAssociations };
}
