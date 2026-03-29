import type { VideoStats, Issue } from '../types';

export function detectIssues(stats: Partial<VideoStats> & { url: string }): Issue[] {
  const issues: Issue[] = [];

  // Network issues
  if (stats.network) {
    const { network } = stats;

    if (network.corsBlocked) {
      issues.push({
        severity: 'error',
        code: 'CORS_BLOCKED',
        message: 'CORS policy blocked the request from browser.',
        suggestion: 'Add Access-Control-Allow-Origin header on your manifest/segment server, or use a proxy.',
      });
    }

    if (!network.isHttps) {
      issues.push({
        severity: 'warning',
        code: 'INSECURE_HTTP',
        message: 'Stream is served over HTTP (not HTTPS).',
        suggestion: 'Serve over HTTPS to avoid mixed-content blocking in modern browsers and ensure security.',
      });
    }

    if (network.httpStatus >= 400) {
      issues.push({
        severity: 'error',
        code: `HTTP_${network.httpStatus}`,
        message: `Manifest returned HTTP ${network.httpStatus}.`,
        suggestion: network.httpStatus === 403
          ? 'Check CDN authentication tokens or signed URL expiry.'
          : network.httpStatus === 404
          ? 'Manifest URL is invalid or the stream has ended.'
          : 'Check your origin server configuration.',
      });
    }

    if (network.ttfb > 3000) {
      issues.push({
        severity: 'warning',
        code: 'HIGH_TTFB',
        message: `Manifest TTFB is ${(network.ttfb / 1000).toFixed(2)}s (threshold: 3s).`,
        suggestion: 'Consider CDN caching for manifests, or optimize origin response time.',
      });
    }
  }

  // Renditions
  if (stats.renditions) {
    if (stats.renditions.length === 0 && stats.format === 'HLS') {
      issues.push({
        severity: 'warning',
        code: 'NO_RENDITIONS',
        message: 'No video renditions found in master playlist.',
        suggestion: 'Ensure your master playlist contains #EXT-X-STREAM-INF entries.',
      });
    }

    if (stats.renditions.length === 1) {
      issues.push({
        severity: 'info',
        code: 'SINGLE_RENDITION',
        message: 'Only one video rendition found — no ABR (Adaptive Bitrate) available.',
        suggestion: 'Add multiple renditions (e.g. 360p, 720p, 1080p) to enable ABR for varying network conditions.',
      });
    }

    // Check for HEVC without H.264 fallback
    const hasHEVC = stats.renditions.some(r => r.videoCodec?.includes('H.265') || r.videoCodec?.includes('HEVC'));
    const hasH264 = stats.renditions.some(r => r.videoCodec?.includes('H.264'));
    if (hasHEVC && !hasH264) {
      issues.push({
        severity: 'warning',
        code: 'HEVC_NO_FALLBACK',
        message: 'Stream uses H.265/HEVC but no H.264 fallback rendition exists.',
        suggestion: 'Add H.264 renditions as fallback for devices that do not support HEVC (especially older Android devices and browsers).',
      });
    }
  }

  // Audio tracks
  if (stats.audioTracks !== undefined && stats.audioTracks.length === 0 && stats.format === 'HLS') {
    issues.push({
      severity: 'info',
      code: 'NO_AUDIO_DECLARED',
      message: 'No explicit audio tracks declared in master playlist.',
      suggestion: 'Consider using #EXT-X-MEDIA TYPE=AUDIO to declare audio tracks for multi-language support.',
    });
  }

  // Segments
  if (stats.segments) {
    const { segments } = stats;

    if (segments.gaps > 0) {
      issues.push({
        severity: 'error',
        code: 'SEGMENT_GAPS',
        message: `${segments.gaps} segment gap(s) detected (#EXT-X-GAP).`,
        suggestion: 'Encoder/packager produced missing segments. Check your encoder output and CDN origin for dropped segments.',
      });
    }

    if (segments.discontinuities > 0) {
      issues.push({
        severity: 'warning',
        code: 'DISCONTINUITIES',
        message: `${segments.discontinuities} discontinuity(ies) detected.`,
        suggestion: 'Discontinuities cause player rebuffering. Ensure your live encoder handles ad breaks / source switches seamlessly.',
      });
    }

    if (segments.targetDuration > 0 && segments.maxSegmentDuration > segments.targetDuration * 1.1) {
      issues.push({
        severity: 'warning',
        code: 'SEGMENT_DURATION_EXCEEDED',
        message: `Max segment duration (${segments.maxSegmentDuration.toFixed(2)}s) exceeds target duration (${segments.targetDuration}s) by >10%.`,
        suggestion: 'Ensure your encoder produces segments that do not exceed #EXT-X-TARGETDURATION. This can cause player stalls.',
      });
    }

    const variance = segments.maxSegmentDuration - segments.minSegmentDuration;
    if (variance > segments.targetDuration * 0.3 && segments.segmentCount > 3) {
      issues.push({
        severity: 'warning',
        code: 'SEGMENT_DURATION_VARIANCE',
        message: `Segment duration varies significantly (min: ${segments.minSegmentDuration.toFixed(2)}s, max: ${segments.maxSegmentDuration.toFixed(2)}s).`,
        suggestion: 'High variance in segment durations suggests encoder instability. Use constant segment duration for predictable ABR behavior.',
      });
    }
  }

  // Latency issues
  if (stats.latency && stats.isLive) {
    const { latency } = stats;

    if (!latency.programDateTime && stats.format === 'HLS' && !latency.llHls) {
      issues.push({
        severity: 'warning',
        code: 'MISSING_PROGRAM_DATE_TIME',
        message: 'No #EXT-X-PROGRAM-DATE-TIME tag found in live playlist.',
        suggestion: 'Add EXT-X-PROGRAM-DATE-TIME to enable accurate latency measurement, clock synchronization, and DVR features.',
      });
    }

    if (latency.estimatedLatencyMs !== undefined && latency.estimatedLatencyMs > 30000) {
      issues.push({
        severity: 'warning',
        code: 'HIGH_LATENCY',
        message: `Estimated live latency is ${(latency.estimatedLatencyMs / 1000).toFixed(1)}s (>30s).`,
        suggestion: 'Consider LL-HLS or LL-DASH for low-latency use cases. Reduce segment duration and playlist window size.',
      });
    }

    if (latency.targetDurationSec > 10) {
      issues.push({
        severity: 'info',
        code: 'LARGE_SEGMENT_DURATION',
        message: `Target segment duration is ${latency.targetDurationSec}s — this increases live latency.`,
        suggestion: 'Use 2–6s segments for standard latency, or <1s parts with LL-HLS for low-latency streaming.',
      });
    }
  }

  // DRM issues
  if (stats.drm) {
    const { drm } = stats;

    if (drm.systems.length === 0 && drm.method !== 'NONE') {
      issues.push({
        severity: 'info',
        code: 'DRM_NO_SYSTEM_IDENTIFIED',
        message: 'Encryption is present but no specific DRM system was identified.',
        suggestion: 'Verify your manifest includes proper ContentProtection / EXT-X-KEY tags pointing to a license server.',
      });
    }

    // Check for single DRM with no fallback
    if (drm.systems.length === 1) {
      const system = drm.systems[0].name;
      if (system === 'FairPlay') {
        issues.push({
          severity: 'info',
          code: 'DRM_FAIRPLAY_ONLY',
          message: 'Only FairPlay DRM detected — this is Safari/Apple only.',
          suggestion: 'For cross-platform support, also provide Widevine (Chrome/Android) and PlayReady (Edge/Windows).',
        });
      } else if (system === 'Widevine') {
        issues.push({
          severity: 'info',
          code: 'DRM_WIDEVINE_ONLY',
          message: 'Only Widevine DRM detected.',
          suggestion: 'Consider adding PlayReady (Microsoft Edge, Windows) and FairPlay (Safari) for full cross-platform DRM coverage.',
        });
      }
    }
  }

  return issues;
}
