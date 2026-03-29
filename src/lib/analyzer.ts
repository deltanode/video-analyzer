import type { VideoStats, NetworkInfo } from './types';
import { parseHLS, fetchMediaPlaylist } from './parsers/hlsParser';
import { parseDASH } from './parsers/dashParser';
import { detectIssues } from './analyzers/issueDetector';

const CORS_PROXY = 'https://corsproxy.io/?';

export async function fetchWithProxy(url: string): Promise<{ text: string; headers: Record<string, string>; status: number; ttfb: number }> {
  const start = performance.now();

  // Try direct first
  try {
    const res = await fetch(url, { mode: 'cors', cache: 'no-store' });
    const ttfb = performance.now() - start;
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => { headers[k] = v; });
    const text = await res.text();
    return { text, headers, status: res.status, ttfb };
  } catch {
    // Fall back to CORS proxy
    const proxyUrl = CORS_PROXY + encodeURIComponent(url);
    const res = await fetch(proxyUrl, { cache: 'no-store' });
    const ttfb = performance.now() - start;
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => { headers[k] = v; });
    const text = await res.text();
    return { text, headers, status: res.status, ttfb };
  }
}

function detectCDN(headers: Record<string, string>): string | undefined {
  const h = (k: string) => headers[k.toLowerCase()];
  if (h('cf-ray')) return 'Cloudflare';
  if (h('x-amz-cf-id') || h('x-amz-request-id')) return 'AWS CloudFront';
  if (h('x-azure-ref')) return 'Azure CDN';
  if (h('x-fastly-request-id')) return 'Fastly';
  if (h('x-akamai-transformed') || h('x-check-cacheable')) return 'Akamai';
  const via = h('via') || '';
  if (via.toLowerCase().includes('fastly')) return 'Fastly';
  if (via.toLowerCase().includes('varnish')) return 'Varnish';
  const server = h('server') || '';
  if (server.toLowerCase().includes('cloudflare')) return 'Cloudflare';
  return undefined;
}

function detectFormat(url: string, text: string, contentType?: string): 'HLS' | 'DASH' | 'MP4' | 'Unknown' {
  const lower = url.toLowerCase();
  if (lower.includes('.m3u8') || lower.includes('hls')) return 'HLS';
  if (lower.includes('.mpd') || lower.includes('dash')) return 'DASH';
  if (lower.includes('.mp4') || lower.includes('.mov') || lower.includes('.mkv')) return 'MP4';
  if (contentType?.includes('mpegurl') || contentType?.includes('m3u8')) return 'HLS';
  if (contentType?.includes('dash+xml') || contentType?.includes('mpd')) return 'DASH';
  if (contentType?.includes('mp4') || contentType?.includes('video/')) return 'MP4';
  if (text.startsWith('#EXTM3U')) return 'HLS';
  if (text.includes('<MPD') || text.includes('<?xml')) return 'DASH';
  return 'Unknown';
}

export async function analyzeStream(url: string): Promise<VideoStats> {
  const isHttps = url.startsWith('https://');
  let corsBlocked = false;
  let text = '';
  let headers: Record<string, string> = {};
  let status = 0;
  let ttfb = 0;

  try {
    const result = await fetchWithProxy(url);
    text = result.text;
    headers = result.headers;
    status = result.status;
    ttfb = result.ttfb;
  } catch (e) {
    corsBlocked = true;
    // Build minimal stats with CORS error
    const network: NetworkInfo = {
      ttfb: 0, cors: false, corsBlocked: true,
      protocol: isHttps ? 'HTTPS' : 'HTTP',
      httpStatus: 0, isHttps, responseHeaders: {},
    };
    const issues = detectIssues({ url, network, format: 'Unknown', isLive: false, renditions: [], audioTracks: [], subtitleTracks: [], issues: [], analyzedAt: '' });
    return {
      url, format: 'Unknown', isLive: false, network,
      renditions: [], audioTracks: [], subtitleTracks: [],
      issues, analyzedAt: new Date().toISOString(),
    };
  }
  void corsBlocked;

  const contentType = headers['content-type'];
  const format = detectFormat(url, text, contentType);

  const network: NetworkInfo = {
    ttfb: Math.round(ttfb),
    cors: !!headers['access-control-allow-origin'],
    corsBlocked: false,
    cdn: detectCDN(headers),
    protocol: isHttps ? 'HTTPS' : 'HTTP',
    httpStatus: status,
    contentType,
    cacheControl: headers['cache-control'],
    isHttps,
    responseHeaders: headers,
  };

  let stats: Partial<VideoStats> = { url, format, network, analyzedAt: new Date().toISOString() };

  if (format === 'HLS') {
    const parsed = parseHLS(text);
    stats = {
      ...stats,
      isLive: parsed.isLive,
      duration: parsed.duration,
      renditions: parsed.renditions,
      audioTracks: parsed.audioTracks,
      subtitleTracks: parsed.subtitleTracks,
      segments: parsed.segments,
      latency: parsed.latency,
      drm: parsed.drm,
      rawManifest: text,
    };

    // If master, fetch first rendition to get segment info
    if (parsed.isMaster && parsed.renditions.length > 0) {
      const mediaResult = await fetchMediaPlaylist(
        url,
        parsed.renditions[0].uri,
        async (u) => (await fetchWithProxy(u)).text
      );
      if (mediaResult) {
        stats.isLive = mediaResult.isLive;
        stats.segments = mediaResult.segments;
        stats.latency = mediaResult.latency;
        if (!stats.drm && mediaResult.drm) stats.drm = mediaResult.drm;
      }
    }
  } else if (format === 'DASH') {
    const parsed = parseDASH(text);
    stats = {
      ...stats,
      isLive: parsed.isLive,
      duration: parsed.duration,
      renditions: parsed.renditions,
      audioTracks: parsed.audioTracks,
      subtitleTracks: [],
      segments: parsed.segments,
      latency: parsed.latency,
      drm: parsed.drm,
      rawManifest: text,
    };
  } else {
    // MP4 or unknown — just show network info
    stats = {
      ...stats,
      isLive: false,
      renditions: [],
      audioTracks: [],
      subtitleTracks: [],
    };
  }

  const issues = detectIssues({
    ...stats,
    url,
    issues: [],
    analyzedAt: '',
  } as VideoStats);

  return {
    url,
    format: stats.format || 'Unknown',
    isLive: stats.isLive ?? false,
    duration: stats.duration,
    network,
    renditions: stats.renditions || [],
    audioTracks: stats.audioTracks || [],
    subtitleTracks: stats.subtitleTracks || [],
    segments: stats.segments,
    latency: stats.latency,
    drm: stats.drm,
    issues,
    rawManifest: stats.rawManifest,
    analyzedAt: new Date().toISOString(),
  };
}
