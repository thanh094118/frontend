import type {
  AuthConfig,
  UploadVideoResponse,
  VideoAssociationsResponse,
  JobStatusResponse,
  JobListResponse,
  PoseJobAcceptedResponse,
  PoseJobSubmitRequest,
  JobListParams,
} from '../types';

class WHAMApiClient {
  private config: AuthConfig;

  constructor(config: AuthConfig) {
    this.config = config;
  }

  private get headers(): Record<string, string> {
    return {
      'X-WHAM-Subject': this.config.subject,
      'X-WHAM-Api-Key': this.config.apiKey,
    };
  }

  private url(path: string): string {
    return `${this.config.baseUrl.replace(/\/$/, '')}${path}`;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(this.url(path), {
      ...init,
      headers: { ...this.headers, ...(init.headers as Record<string, string> || {}) },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.detail?.[0]?.msg || `HTTP ${res.status}`);
    }
    return res.json();
  }

  // ─── Health ──────────────────────────────────────────────────────────────

  async ping(): Promise<Record<string, string>> {
    const res = await fetch(this.url('/ping'));
    return res.json();
  }

  // ─── Videos ──────────────────────────────────────────────────────────────

  async uploadVideo(file: File): Promise<UploadVideoResponse> {
    const form = new FormData();
    form.append('file', file);
    return this.request<UploadVideoResponse>('/v1/videos/upload', {
      method: 'POST',
      body: form,
    });
  }

  async downloadVideo(videoId: string): Promise<Blob> {
    const res = await fetch(this.url(`/v1/videos/${videoId}/download`), {
      headers: this.headers,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.blob();
  }

  async getVideoAssociations(videoId: string): Promise<VideoAssociationsResponse> {
    return this.request<VideoAssociationsResponse>(`/v1/videos/${videoId}/associations`);
  }

  // ─── Jobs ─────────────────────────────────────────────────────────────────

  async submitPose2dJob(body: PoseJobSubmitRequest): Promise<PoseJobAcceptedResponse> {
    return this.request<PoseJobAcceptedResponse>('/v1/pose2d/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  async submitPose3dJob(body: PoseJobSubmitRequest): Promise<PoseJobAcceptedResponse> {
    return this.request<PoseJobAcceptedResponse>('/v1/pose3d/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  async submitCustomV1Job(body: PoseJobSubmitRequest): Promise<PoseJobAcceptedResponse> {
    return this.request<PoseJobAcceptedResponse>('/v1/custom_v1/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  async getJobStatus(jobId: string): Promise<JobStatusResponse> {
    return this.request<JobStatusResponse>(`/v1/jobs/${jobId}`);
  }

  async listJobs(params: JobListParams = {}): Promise<JobListResponse> {
    const q = new URLSearchParams();
    if (params.status) q.set('status', params.status);
    if (params.job_type) q.set('job_type', params.job_type);
    if (params.source_video_id) q.set('source_video_id', params.source_video_id);
    if (params.result_video_id) q.set('result_video_id', params.result_video_id);
    if (params.execution_backend) q.set('execution_backend', params.execution_backend);
    if (params.limit !== undefined) q.set('limit', String(params.limit));
    if (params.offset !== undefined) q.set('offset', String(params.offset));
    const qs = q.toString();
    return this.request<JobListResponse>(`/v1/jobs${qs ? `?${qs}` : ''}`);
  }

  async cancelJob(jobId: string): Promise<JobStatusResponse> {
    return this.request<JobStatusResponse>(`/v1/jobs/${jobId}/cancel`, { method: 'POST' });
  }

  async downloadJobArtifacts(jobId: string): Promise<Blob> {
    const res = await fetch(this.url(`/v1/jobs/${jobId}/artifacts/download`), {
      headers: this.headers,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.blob();
  }
}

export function createApiClient(config: AuthConfig): WHAMApiClient {
  return new WHAMApiClient(config);
}

export type { WHAMApiClient };
