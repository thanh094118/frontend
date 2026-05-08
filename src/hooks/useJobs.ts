import { useState, useCallback } from 'react';
import { useAuthStore } from '../store/auth';
import type {
  JobStatusResponse,
  JobListResponse,
  PoseJobAcceptedResponse,
  TransformType,
  JobListParams,
} from '../types';

export function useJobs() {
  const client = useAuthStore((s) => s.client);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitJob = useCallback(
    async (
      type: TransformType,
      sourceVideoId: string
    ): Promise<PoseJobAcceptedResponse | null> => {
      if (!client) return null;
      setLoading(true);
      setError(null);
      try {
        const body = { source_video_id: sourceVideoId };
        if (type === 'pose2d') return await client.submitPose2dJob(body);
        if (type === 'pose3d') return await client.submitPose3dJob(body);
        return await client.submitCustomV1Job(body);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Unknown error');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [client]
  );

  const listJobs = useCallback(
    async (params?: JobListParams): Promise<JobListResponse | null> => {
      if (!client) return null;
      setLoading(true);
      setError(null);
      try {
        return await client.listJobs(params);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Unknown error');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [client]
  );

  const getJobStatus = useCallback(
    async (jobId: string): Promise<JobStatusResponse | null> => {
      if (!client) return null;
      try {
        return await client.getJobStatus(jobId);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Unknown error');
        return null;
      }
    },
    [client]
  );

  const cancelJob = useCallback(
    async (jobId: string): Promise<JobStatusResponse | null> => {
      if (!client) return null;
      setLoading(true);
      setError(null);
      try {
        return await client.cancelJob(jobId);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Unknown error');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [client]
  );

  const downloadArtifacts = useCallback(
    async (jobId: string): Promise<void> => {
      if (!client) return;
      try {
        const blob = await client.downloadJobArtifacts(jobId);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `artifacts-${jobId}.zip`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Download failed');
      }
    },
    [client]
  );

  return { loading, error, submitJob, listJobs, getJobStatus, cancelJob, downloadArtifacts };
}
