// ─── Enums ───────────────────────────────────────────────────────────────────

export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed';
export type TransformType = 'pose2d' | 'pose3d' | 'custom_v1';

// ─── Responses ───────────────────────────────────────────────────────────────

export interface UploadVideoResponse {
  video_id: string;
  filename: string;
  status: string;
}

export interface DerivedVideoAssociation {
  result_video_id: string;
  transform_type: TransformType;
  job_id: string;
  status: JobStatus;
}

export interface VideoAssociationsResponse {
  source_video_id: string;
  derived_videos: DerivedVideoAssociation[];
}

export interface JobStatusResponse {
  job_id: string;
  job_name: string;
  transform_type?: TransformType | null;
  source_video_id?: string | null;
  result_video_id?: string | null;
  status: JobStatus;
  container_name?: string | null;
  pod_id?: string | null;
  pod_name?: string | null;
  execution_backend?: string | null;
  exit_code?: number | null;
  error_summary?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface PoseJobAcceptedResponse {
  job_id: string;
  job_name: string;
  transform_type: TransformType;
  source_video_id: string;
  result_video_id?: string | null;
  status: JobStatus;
}

export interface JobListResponse {
  jobs: JobStatusResponse[];
  total: number;
  limit: number;
  offset: number;
}

// ─── Requests ────────────────────────────────────────────────────────────────

export interface PoseJobSubmitRequest {
  source_video_id: string;
}

// ─── Auth Config ─────────────────────────────────────────────────────────────

export interface AuthConfig {
  subject: string;
  apiKey: string;
  baseUrl: string;
}

// ─── Filter params ───────────────────────────────────────────────────────────

export interface JobListParams {
  status?: JobStatus;
  job_type?: TransformType;
  source_video_id?: string;
  result_video_id?: string;
  execution_backend?: string;
  limit?: number;
  offset?: number;
}
