import type { VideoStats } from '../lib/types';

interface Props { stats: VideoStats }

function Row({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: 'ok' | 'warn' | 'error' }) {
  const colors = { ok: 'text-green-400', warn: 'text-yellow-400', error: 'text-red-400' };
  return (
    <div className="flex justify-between items-start py-2.5 border-b border-gray-700 last:border-0">
      <div>
        <div className="text-gray-400 text-sm">{label}</div>
        {sub && <div className="text-gray-600 text-xs">{sub}</div>}
      </div>
      <span className={`text-sm font-medium ml-4 text-right ${highlight ? colors[highlight] : 'text-white'}`}>{value}</span>
    </div>
  );
}

export default function LatencyPanel({ stats }: Props) {
  if (!stats.isLive) {
    return (
      <div className="text-gray-400 text-sm bg-gray-800 rounded-lg p-6 text-center">
        This is a VOD (on-demand) stream. Latency metrics only apply to live streams.
      </div>
    );
  }

  const lat = stats.latency;
  if (!lat) {
    return (
      <div className="text-gray-400 text-sm bg-gray-800 rounded-lg p-6 text-center">
        No latency information could be determined.
      </div>
    );
  }

  const latSec = lat.estimatedLatencyMs !== undefined ? lat.estimatedLatencyMs / 1000 : undefined;

  return (
    <div className="space-y-4">
      {/* Latency gauge */}
      {latSec !== undefined && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <div className="text-xs text-gray-400 mb-3">Estimated End-to-End Latency</div>
          <div className="flex items-baseline gap-2 mb-3">
            <span className={`text-4xl font-bold ${latSec < 5 ? 'text-green-400' : latSec < 15 ? 'text-yellow-400' : 'text-red-400'}`}>
              {latSec.toFixed(1)}s
            </span>
            <span className="text-gray-400 text-sm">
              {latSec < 3 ? 'Ultra-Low Latency' : latSec < 10 ? 'Low Latency' : latSec < 30 ? 'Standard Latency' : 'High Latency'}
            </span>
          </div>
          <div className="relative h-3 bg-gray-700 rounded-full overflow-hidden">
            <div className="absolute inset-0 flex">
              <div className="bg-green-500 opacity-30" style={{ width: '10%' }} />
              <div className="bg-yellow-500 opacity-30" style={{ width: '20%' }} />
              <div className="bg-red-500 opacity-30" style={{ width: '70%' }} />
            </div>
            <div
              className={`absolute top-0 left-0 h-full rounded-full transition-all ${latSec < 5 ? 'bg-green-500' : latSec < 15 ? 'bg-yellow-500' : 'bg-red-500'}`}
              style={{ width: `${Math.min(100, (latSec / 60) * 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-600 mt-1">
            <span>0s (LL)</span>
            <span>6s</span>
            <span>30s</span>
            <span>60s+</span>
          </div>
        </div>
      )}

      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
          <div>
            <Row label="Estimated Latency"
              value={latSec !== undefined ? `${latSec.toFixed(1)}s` : 'Unknown'}
              highlight={latSec === undefined ? undefined : latSec < 10 ? 'ok' : latSec < 30 ? 'warn' : 'error'}
            />
            <Row label="Target Segment Duration"
              value={lat.targetDurationSec > 0 ? `${lat.targetDurationSec}s` : '—'}
            />
            <Row label="DVR Window"
              value={lat.dvrWindowSec !== undefined ? `${lat.dvrWindowSec.toFixed(0)}s` : '—'}
              sub="How far back a viewer can seek in live"
            />
          </div>
          <div>
            <Row label="LL-HLS Support"
              value={lat.llHls ? 'Yes' : 'No'}
              highlight={lat.llHls ? 'ok' : 'warn'}
            />
            {lat.llHls && lat.llHlsPartDuration !== undefined && (
              <Row label="Part Duration (LL-HLS)" value={`${lat.llHlsPartDuration}s`} />
            )}
            <Row label="Program Date/Time"
              value={lat.programDateTime ? 'Present' : 'Missing'}
              highlight={lat.programDateTime ? 'ok' : 'warn'}
              sub={lat.programDateTime || undefined}
            />
            {lat.dashSuggestedDelay !== undefined && (
              <Row label="DASH Suggested Delay" value={`${lat.dashSuggestedDelay}s`} />
            )}
            {lat.dashMinBufferTime !== undefined && (
              <Row label="DASH Min Buffer Time" value={`${lat.dashMinBufferTime}s`} />
            )}
          </div>
        </div>
      </div>

      {lat.serverControl && Object.keys(lat.serverControl).length > 0 && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <div className="text-xs text-gray-400 mb-3">EXT-X-SERVER-CONTROL (LL-HLS)</div>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(lat.serverControl).map(([k, v]) => (
              <div key={k} className="text-sm">
                <span className="text-gray-400">{k}: </span>
                <span className="text-white font-mono">{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
