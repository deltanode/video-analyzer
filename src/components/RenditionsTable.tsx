import type { VideoStats } from '../lib/types';

interface Props { stats: VideoStats }

function formatBitrate(bps: number): string {
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(2)} Mbps`;
  return `${(bps / 1000).toFixed(0)} kbps`;
}

export default function RenditionsTable({ stats }: Props) {
  const sorted = [...stats.renditions].sort((a, b) => b.bandwidth - a.bandwidth);

  return (
    <div className="space-y-4">
      {sorted.length === 0 ? (
        <div className="text-gray-400 text-sm bg-gray-800 rounded-lg p-6 text-center">
          No renditions found. This may be a single-rendition or non-adaptive stream.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-800 text-gray-400 text-left">
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">Resolution</th>
                <th className="px-4 py-3 font-medium">Bandwidth</th>
                <th className="px-4 py-3 font-medium">Avg Bandwidth</th>
                <th className="px-4 py-3 font-medium">Frame Rate</th>
                <th className="px-4 py-3 font-medium">Video Codec</th>
                <th className="px-4 py-3 font-medium">Audio Codec</th>
                <th className="px-4 py-3 font-medium">HDR</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => (
                <tr key={i} className="border-t border-gray-700 hover:bg-gray-800/50">
                  <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-white">{r.resolution || '—'}</span>
                    {r.height && (
                      <span className="ml-2 text-xs text-gray-500">
                        {r.height >= 2160 ? '4K' : r.height >= 1080 ? 'FHD' : r.height >= 720 ? 'HD' : 'SD'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-blue-300 font-mono">{formatBitrate(r.bandwidth)}</td>
                  <td className="px-4 py-3 text-gray-300 font-mono">
                    {r.averageBandwidth ? formatBitrate(r.averageBandwidth) : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-300">{r.frameRate ? `${r.frameRate} fps` : '—'}</td>
                  <td className="px-4 py-3 text-gray-300 text-xs">{r.videoCodec || r.codecs || '—'}</td>
                  <td className="px-4 py-3 text-gray-300 text-xs">{r.audioCodec || '—'}</td>
                  <td className="px-4 py-3">
                    {r.hdr
                      ? <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-xs">HDR</span>
                      : <span className="text-gray-500 text-xs">SDR</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Audio Tracks */}
      {stats.audioTracks.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-300 mb-2">Audio Tracks</h3>
          <div className="overflow-x-auto rounded-lg border border-gray-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-800 text-gray-400 text-left">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Language</th>
                  <th className="px-4 py-3 font-medium">Codec</th>
                  <th className="px-4 py-3 font-medium">Channels</th>
                  <th className="px-4 py-3 font-medium">Default</th>
                </tr>
              </thead>
              <tbody>
                {stats.audioTracks.map((a, i) => (
                  <tr key={i} className="border-t border-gray-700 hover:bg-gray-800/50">
                    <td className="px-4 py-3 text-white">{a.name}</td>
                    <td className="px-4 py-3 text-gray-300">{a.language || '—'}</td>
                    <td className="px-4 py-3 text-gray-300 text-xs">{a.codec || '—'}</td>
                    <td className="px-4 py-3 text-gray-300">{a.channels || '—'}</td>
                    <td className="px-4 py-3">
                      {a.default
                        ? <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-xs">Yes</span>
                        : <span className="text-gray-500 text-xs">No</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Subtitle Tracks */}
      {stats.subtitleTracks.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-300 mb-2">Subtitle / Caption Tracks</h3>
          <div className="flex flex-wrap gap-2">
            {stats.subtitleTracks.map((s, i) => (
              <span key={i} className="px-3 py-1 bg-gray-800 border border-gray-700 rounded-full text-xs text-gray-300">
                {s.name} {s.language ? `(${s.language})` : ''} {s.forced ? '• Forced' : ''}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
