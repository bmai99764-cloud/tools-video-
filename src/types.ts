export type JobStatus = 'idle' | 'queueing' | 'running' | 'completed' | 'failed';

export type InputType = 'text' | 'image' | 'frame';

export type VideoModel = 'veo-3.1-lite-generate-preview' | 'veo-3.1-generate-preview';

export type AspectRatio = '16:9' | '9:16' | '1:1';

export type Resolution = '720p' | '1080p';

export interface VideoJob {
  id: string;
  prompt: string;
  inputType: InputType;
  model: VideoModel;
  aspectRatio: AspectRatio;
  resolution: Resolution;
  outputs: number;
  image?: string; // base64 encoded
  lastFrame?: string; // base64 encoded
  status: JobStatus;
  operationName?: string;
  progress: number; // 0 to 100
  error?: string;
  videoUrl?: string; // local or proxied URL
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
}

export interface QueueConfig {
  concurrency: number;
  simulate: boolean;
}
