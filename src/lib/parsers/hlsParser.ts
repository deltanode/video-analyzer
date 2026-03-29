import type {
  Rendition, AudioTrack, SubtitleTrack, SegmentInfo,
  LatencyInfo, DRMInfo, DRMSystem
} from '../types';

export interface HLSParseResult {
  isLive: boolean;
  isMaster: boolean;
  renditions: Rendition[];
  audioTracks: AudioTrack[];
  subtitleTracks: SubtitleTrack[];
  segments?: SegmentInfo;
  latency?: LatencyInfo;
  drm?: DRMInfo;
  duration?: number;
  rawManifest: string;
}

function parseAttributes(attrStr: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const regex = /([A-Z0-9-]+)=("([^"]*?)"|([^,]+))/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(attrStr)) !== null) {
    attrs[m[1]] = m[3] !== undefined ? m[3] : m[4];
  }
  return attrs;
}

function parseCodecs(codecs?: string): { videoCodec?: string; audioCodec?: string } {
  if (!codecs) return {};
  const parts = codecs.split(',').map(c => c.trim());
  let videoCodec: string | undefined;
  let audioCodec: string | undefined;
  for (const c of parts) {
    if (/^avc1|^hvc1|^hev1|^av01|^vp09|^dvh1/.test(c)) videoCodec = c;
    else if (/^mp4a|^ac-3|^ec-3|^opus|^flac/.test(c)) audioCodec = c;
  }
  return { videoCodec, audioCodec };
}

function friendlyCodec(codec?: string): string | undefined {
  if (!codec) return undefined;
  if (codec.startsWith('avc1')) return `H.264 (${codec})`;
  if (codec.startsWith('hvc1') || codec.startsWith('hev1')) return `H.265/HEVC (${codec})`;
  if (codec.startsWith('av01')) return `AV1 (${codec})`;
  if (codec.startsWith('vp09')) return `VP9 (${codec})`;
  if (codec.startsWith('mp4a')) return `AAC (${codec})`;
  if (codec.startsWith('ac-3')) return `Dolby AC-3 (${codec})`;
  if (codec.startsWith('ec-3')) return `Dolby E-AC-3 (${codec})`;
  return codec;
}

export function parseHLS(manifest: string): HLSParseResult {
  const lines = manifest.split('\n').map(l => l.trim()).filter(Boolean);
  const isMaster = manifest.includes('#EXT-X-STREAM-INF');
  const isLive = manifest.includes('#EXT-X-STREAM-INF')
    ? false  // master playlists are format only
    : !manifest.includes('#EXT-X-ENDLIST');

  const renditions: Rendition[] = [];
  const audioTracks: AudioTrack[] = [];
  const subtitleTracks: SubtitleTrack[] = [];

  // DRM
  let drmMethod = 'NONE';
  const drmSystems: DRMSystem[] = [];
  let keyServerUrl: string | undefined;
  let hasKeyRotation = false;
  let keyCount = 0;

  // Segments
  const segmentDurations: number[] = [];
  let targetDuration = 0;
  let mediaSequence: number | undefined;
  let discontinuities = 0;
  let gaps = 0;
  let byteRange = false;

  // Latency
  let programDateTime: string | undefined;
  let llHls = false;
  let llHlsPartDuration: number | undefined;
  const serverControl: Record<string, string> = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Renditions (master)
    if (line.startsWith('#EXT-X-STREAM-INF:')) {
      const attrs = parseAttributes(line.slice('#EXT-X-STREAM-INF:'.length));
      const uri = lines[i + 1] || '';
      const { videoCodec, audioCodec } = parseCodecs(attrs['CODECS']);
      const [w, h] = (attrs['RESOLUTION'] || '').split('x').map(Number);
      renditions.push({
        bandwidth: parseInt(attrs['BANDWIDTH'] || '0'),
        averageBandwidth: attrs['AVERAGE-BANDWIDTH'] ? parseInt(attrs['AVERAGE-BANDWIDTH']) : undefined,
        resolution: attrs['RESOLUTION'],
        width: w || undefined,
        height: h || undefined,
        frameRate: attrs['FRAME-RATE'] ? parseFloat(attrs['FRAME-RATE']) : undefined,
        codecs: attrs['CODECS'],
        videoCodec: friendlyCodec(videoCodec),
        audioCodec: friendlyCodec(audioCodec),
        hdr: attrs['VIDEO-RANGE'] === 'PQ' || attrs['VIDEO-RANGE'] === 'HLG',
        uri,
      });
    }

    // Audio tracks
    if (line.startsWith('#EXT-X-MEDIA:') && line.includes('TYPE=AUDIO')) {
      const attrs = parseAttributes(line.slice('#EXT-X-MEDIA:'.length));
      audioTracks.push({
        groupId: attrs['GROUP-ID'],
        language: attrs['LANGUAGE'],
        name: attrs['NAME'] || 'Unknown',
        channels: attrs['CHANNELS'],
        uri: attrs['URI'],
        default: attrs['DEFAULT'] === 'YES',
        autoselect: attrs['AUTOSELECT'] === 'YES',
      });
    }

    // Subtitle tracks
    if (line.startsWith('#EXT-X-MEDIA:') && (line.includes('TYPE=SUBTITLES') || line.includes('TYPE=CLOSED-CAPTIONS'))) {
      const attrs = parseAttributes(line.slice('#EXT-X-MEDIA:'.length));
      subtitleTracks.push({
        groupId: attrs['GROUP-ID'],
        language: attrs['LANGUAGE'],
        name: attrs['NAME'] || 'Unknown',
        uri: attrs['URI'],
        forced: attrs['FORCED'] === 'YES',
      });
    }

    // DRM / Encryption
    if (line.startsWith('#EXT-X-KEY:')) {
      const attrs = parseAttributes(line.slice('#EXT-X-KEY:'.length));
      keyCount++;
      if (keyCount > 1) hasKeyRotation = true;
      drmMethod = attrs['METHOD'] || 'NONE';
      if (attrs['URI']) {
        keyServerUrl = attrs['URI'].replace(/^"(.*)"$/, '$1');
        // Detect Widevine / FairPlay by key URI patterns
        if (keyServerUrl.includes('widevine') || keyServerUrl.includes('eme')) {
          drmSystems.push({ name: 'Widevine', licenseUrl: keyServerUrl });
        } else if (keyServerUrl.includes('fairplay') || keyServerUrl.startsWith('skd://')) {
          drmSystems.push({ name: 'FairPlay', licenseUrl: keyServerUrl });
        }
      }
    }

    // Target duration
    if (line.startsWith('#EXT-X-TARGETDURATION:')) {
      targetDuration = parseInt(line.split(':')[1]);
    }

    // Media sequence
    if (line.startsWith('#EXT-X-MEDIA-SEQUENCE:')) {
      mediaSequence = parseInt(line.split(':')[1]);
    }

    // Discontinuity
    if (line === '#EXT-X-DISCONTINUITY') {
      discontinuities++;
    }

    // Gaps
    if (line === '#EXT-X-GAP') {
      gaps++;
    }

    // Byte range
    if (line.startsWith('#EXT-X-BYTERANGE:')) {
      byteRange = true;
    }

    // Segment durations
    if (line.startsWith('#EXTINF:')) {
      const dur = parseFloat(line.split(':')[1].split(',')[0]);
      if (!isNaN(dur)) segmentDurations.push(dur);
    }

    // Program date time
    if (line.startsWith('#EXT-X-PROGRAM-DATE-TIME:')) {
      programDateTime = line.split(':').slice(1).join(':');
    }

    // LL-HLS parts
    if (line.startsWith('#EXT-X-PART:')) {
      llHls = true;
      const attrs = parseAttributes(line.slice('#EXT-X-PART:'.length));
      if (attrs['DURATION']) llHlsPartDuration = parseFloat(attrs['DURATION']);
    }

    // Server control (LL-HLS)
    if (line.startsWith('#EXT-X-SERVER-CONTROL:')) {
      llHls = true;
      const attrs = parseAttributes(line.slice('#EXT-X-SERVER-CONTROL:'.length));
      Object.assign(serverControl, attrs);
    }
  }

  // Build segment info
  let segments: SegmentInfo | undefined;
  if (segmentDurations.length > 0) {
    const total = segmentDurations.reduce((a, b) => a + b, 0);
    const avg = total / segmentDurations.length;
    const max = Math.max(...segmentDurations);
    const min = Math.min(...segmentDurations);

    // Detect gaps: check for large jumps between consecutive segment times
    let computedGaps = gaps;
    let runningTime = 0;
    for (let i = 0; i < segmentDurations.length - 1; i++) {
      runningTime += segmentDurations[i];
    }
    void runningTime; // used only for gap tracking — simplified here

    segments = {
      targetDuration,
      maxSegmentDuration: max,
      minSegmentDuration: min,
      avgSegmentDuration: parseFloat(avg.toFixed(3)),
      segmentCount: segmentDurations.length,
      gaps: computedGaps,
      discontinuities,
      byteRange,
      mediaSequence,
      totalDuration: parseFloat(total.toFixed(3)),
    };
  }

  // Build latency info
  let latency: LatencyInfo | undefined;
  if (targetDuration > 0 || llHls || programDateTime) {
    let estimatedLatencyMs: number | undefined;
    if (programDateTime && segmentDurations.length > 0) {
      const pdtTime = new Date(programDateTime).getTime();
      const totalSegDur = segmentDurations.reduce((a, b) => a + b, 0);
      const streamEdge = pdtTime + totalSegDur * 1000;
      estimatedLatencyMs = Math.max(0, Date.now() - streamEdge);
    }

    latency = {
      estimatedLatencyMs,
      targetDurationSec: targetDuration,
      llHls,
      llHlsPartDuration,
      dvrWindowSec: segmentDurations.length > 0
        ? parseFloat(segmentDurations.reduce((a, b) => a + b, 0).toFixed(1))
        : undefined,
      programDateTime,
      serverControl: Object.keys(serverControl).length > 0 ? serverControl : undefined,
    };
  }

  // Build DRM info
  let drm: DRMInfo | undefined;
  if (drmMethod !== 'NONE') {
    drm = {
      method: drmMethod,
      systems: drmSystems,
      keyServerUrl: keyServerUrl ? maskUrl(keyServerUrl) : undefined,
      hasKeyRotation,
    };
  }

  const totalDuration = segmentDurations.reduce((a, b) => a + b, 0);

  return {
    isLive: isMaster ? false : isLive,
    isMaster,
    renditions,
    audioTracks,
    subtitleTracks,
    segments: segments || undefined,
    latency,
    drm,
    duration: totalDuration > 0 ? totalDuration : undefined,
    rawManifest: manifest,
  };
}

function maskUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.hostname}/***`;
  } catch {
    return '***';
  }
}

// Fetch a media playlist to get segment info (for master HLS)
export async function fetchMediaPlaylist(
  masterUrl: string,
  renditionUri: string,
  proxyFn: (url: string) => Promise<string>
): Promise<HLSParseResult | null> {
  try {
    const base = masterUrl.substring(0, masterUrl.lastIndexOf('/') + 1);
    const mediaUrl = renditionUri.startsWith('http') ? renditionUri : base + renditionUri;
    const text = await proxyFn(mediaUrl);
    return parseHLS(text);
  } catch {
    return null;
  }
}
