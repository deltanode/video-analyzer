export type StreamFormat = 'HLS' | 'DASH' | 'MP4' | 'Unknown';

export interface Rendition {
  bandwidth: number;
  averageBandwidth?: number;
  resolution?: string;
  width?: number;
  height?: number;
  frameRate?: number;
  codecs?: string;
  videoCodec?: string;
  audioCodec?: string;
  hdr?: boolean;
  uri: string;
  name?: string;
}

export interface AudioTrack {
  groupId?: string;
  language?: string;
  name: string;
  codec?: string;
  channels?: string;
  uri?: string;
  default?: boolean;
  autoselect?: boolean;
}

export interface SubtitleTrack {
  groupId?: string;
  language?: string;
  name: string;
  uri?: string;
  forced?: boolean;
}

export interface SegmentInfo {
  targetDuration: number;
  maxSegmentDuration: number;
  minSegmentDuration: number;
  avgSegmentDuration: number;
  segmentCount: number;
  gaps: number;
  discontinuities: number;
  byteRange: boolean;
  mediaSequence?: number;
  totalDuration: number;
  segmentPattern?: string;
}

export interface LatencyInfo {
  estimatedLatencyMs?: number;
  targetDurationSec: number;
  llHls: boolean;
  llHlsPartDuration?: number;
  dvrWindowSec?: number;
  programDateTime?: string;
  serverControl?: Record<string, string>;
  dashSuggestedDelay?: number;
  dashMinBufferTime?: number;
}

export interface DRMInfo {
  method: string;
  systems: DRMSystem[];
  keyServerUrl?: string;
  hasKeyRotation: boolean;
}

export interface DRMSystem {
  name: string;
  schemeIdUri?: string;
  licenseUrl?: string;
  psshPresent?: boolean;
}

export type IssueSeverity = 'error' | 'warning' | 'info';

export interface Issue {
  severity: IssueSeverity;
  code: string;
  message: string;
  suggestion: string;
}

export interface NetworkInfo {
  ttfb: number;
  cors: boolean;
  corsBlocked: boolean;
  cdn?: string;
  protocol: string;
  httpStatus: number;
  contentType?: string;
  cacheControl?: string;
  isHttps: boolean;
  responseHeaders: Record<string, string>;
}

export interface VideoStats {
  url: string;
  format: StreamFormat;
  isLive: boolean;
  duration?: number;
  network: NetworkInfo;
  renditions: Rendition[];
  audioTracks: AudioTrack[];
  subtitleTracks: SubtitleTrack[];
  segments?: SegmentInfo;
  latency?: LatencyInfo;
  drm?: DRMInfo;
  issues: Issue[];
  rawManifest?: string;
  analyzedAt: string;
}
