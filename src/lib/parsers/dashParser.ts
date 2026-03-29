import type { Rendition, AudioTrack, SegmentInfo, LatencyInfo, DRMInfo, DRMSystem } from '../types';

export interface DASHParseResult {
  isLive: boolean;
  renditions: Rendition[];
  audioTracks: AudioTrack[];
  segments?: SegmentInfo;
  latency?: LatencyInfo;
  drm?: DRMInfo;
  duration?: number;
  rawManifest: string;
}

const DRM_SCHEMES: Record<string, string> = {
  'urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed': 'Widevine',
  'urn:uuid:9a04f079-9840-4286-ab92-e65be0885f95': 'PlayReady',
  'urn:uuid:94ce86fb-07ff-4f43-adb8-93d2fa968ca2': 'FairPlay',
  'urn:uuid:1077efec-c0b2-4d02-ace3-3c1e52e2fb4b': 'ClearKey',
  'urn:mpeg:dash:mp4protection:2011': 'MP4 Protection',
};

function getAttr(el: Element, name: string): string | undefined {
  return el.getAttribute(name) ?? undefined;
}

function parseDuration(iso?: string | null): number | undefined {
  if (!iso) return undefined;
  const m = iso.match(/PT(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?/);
  if (!m) return undefined;
  return (parseFloat(m[1] || '0') * 3600) + (parseFloat(m[2] || '0') * 60) + parseFloat(m[3] || '0');
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

function maskUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.hostname}/***`;
  } catch {
    return '***';
  }
}

export function parseDASH(manifest: string): DASHParseResult {
  const parser = new DOMParser();
  const doc = parser.parseFromString(manifest, 'application/xml');
  const mpd = doc.querySelector('MPD');

  if (!mpd) {
    return { isLive: false, renditions: [], audioTracks: [], rawManifest: manifest };
  }

  const mpdType = getAttr(mpd, 'type') || 'static';
  const isLive = mpdType === 'dynamic';
  const mediaPresentationDuration = parseDuration(getAttr(mpd, 'mediaPresentationDuration'));
  const minBufferTime = parseDuration(getAttr(mpd, 'minBufferTime'));
  const suggestedPresentationDelay = parseDuration(getAttr(mpd, 'suggestedPresentationDelay'));
  const availabilityStartTime = getAttr(mpd, 'availabilityStartTime');

  const renditions: Rendition[] = [];
  const audioTracks: AudioTrack[] = [];
  const drmSystems: DRMSystem[] = [];
  let segmentDuration: number | undefined;

  const adaptationSets = doc.querySelectorAll('AdaptationSet');

  for (const as of Array.from(adaptationSets)) {
    const contentType = getAttr(as, 'contentType') ||
      (getAttr(as, 'mimeType') || '').split('/')[0];
    const lang = getAttr(as, 'lang');

    // Content protection (DRM)
    const cpEls = as.querySelectorAll('ContentProtection');
    for (const cp of Array.from(cpEls)) {
      const schemeId = getAttr(cp, 'schemeIdUri') || '';
      const drmName = DRM_SCHEMES[schemeId.toLowerCase()] || schemeId;
      const laurl = cp.querySelector('Laurl, laurl, ms\\:laurl');
      const licenseUrl = laurl?.textContent?.trim();
      const psshEl = cp.querySelector('pssh');
      if (!drmSystems.find(d => d.name === drmName)) {
        drmSystems.push({
          name: drmName,
          schemeIdUri: schemeId,
          licenseUrl: licenseUrl ? maskUrl(licenseUrl) : undefined,
          psshPresent: !!psshEl,
        });
      }
    }

    // Segment template duration
    const segTemplate = as.querySelector('SegmentTemplate');
    if (segTemplate) {
      const dur = getAttr(segTemplate, 'duration');
      const timescale = getAttr(segTemplate, 'timescale') || '1';
      if (dur && timescale) {
        segmentDuration = parseInt(dur) / parseInt(timescale);
      }
    }

    const representations = as.querySelectorAll('Representation');

    if (contentType === 'video' || getAttr(as, 'mimeType')?.includes('video')) {
      for (const rep of Array.from(representations)) {
        const bandwidth = parseInt(getAttr(rep, 'bandwidth') || '0');
        const width = parseInt(getAttr(rep, 'width') || '0') || undefined;
        const height = parseInt(getAttr(rep, 'height') || '0') || undefined;
        const frameRate = getAttr(rep, 'frameRate');
        const codecStr = getAttr(rep, 'codecs') || getAttr(as, 'codecs');
        renditions.push({
          bandwidth,
          resolution: (width && height) ? `${width}x${height}` : undefined,
          width,
          height,
          frameRate: frameRate ? parseFloat(frameRate) : undefined,
          codecs: codecStr || undefined,
          videoCodec: friendlyCodec(codecStr),
          uri: getAttr(rep, 'id') || '',
        });
      }
    }

    if (contentType === 'audio' || getAttr(as, 'mimeType')?.includes('audio')) {
      for (const rep of Array.from(representations)) {
        const codecStr = getAttr(rep, 'codecs') || getAttr(as, 'codecs');
        audioTracks.push({
          name: lang || getAttr(as, 'id') || 'Audio',
          language: lang,
          codec: friendlyCodec(codecStr),
          channels: getAttr(as, 'audioChannelConfiguration') || undefined,
        });
      }
    }
  }

  // Estimate latency for live
  let estimatedLatencyMs: number | undefined;
  if (isLive && availabilityStartTime) {
    const start = new Date(availabilityStartTime).getTime();
    const elapsed = (Date.now() - start) / 1000;
    const delay = suggestedPresentationDelay ?? (minBufferTime ? minBufferTime * 3 : 30);
    estimatedLatencyMs = delay * 1000;
    void elapsed;
  }

  const latency: LatencyInfo | undefined = isLive ? {
    estimatedLatencyMs,
    targetDurationSec: segmentDuration ?? 0,
    llHls: false,
    dashSuggestedDelay: suggestedPresentationDelay,
    dashMinBufferTime: minBufferTime,
  } : undefined;

  const drm: DRMInfo | undefined = drmSystems.length > 0 ? {
    method: 'CENC',
    systems: drmSystems,
    hasKeyRotation: false,
  } : undefined;

  const segments: SegmentInfo | undefined = segmentDuration ? {
    targetDuration: segmentDuration,
    maxSegmentDuration: segmentDuration,
    minSegmentDuration: segmentDuration,
    avgSegmentDuration: segmentDuration,
    segmentCount: mediaPresentationDuration ? Math.round(mediaPresentationDuration / segmentDuration) : 0,
    gaps: 0,
    discontinuities: 0,
    byteRange: false,
    totalDuration: mediaPresentationDuration ?? 0,
  } : undefined;

  return {
    isLive,
    renditions,
    audioTracks,
    segments,
    latency,
    drm,
    duration: mediaPresentationDuration,
    rawManifest: manifest,
  };
}
