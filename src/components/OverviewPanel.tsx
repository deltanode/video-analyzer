import type { VideoStats } from '../lib/types';

interface Props { stats: VideoStats }

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className={`text-lg font-semibold ${color || 'text-white'}`}>{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

function formatDuration(sec?: number): string {
  if (!sec) return 'N/A';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function OverviewPanel({ stats }: Props) {
  const errorCount = stats.issues.filter(i => i.severity === 'error').length;
  const warnCount = stats.issues.filter(i => i.severity === 'warning').length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <StatCard
          label="Format"
          value={stats.format}
          color="text-blue-400"
        />
        <StatCard
          label="Stream Type"
          value={stats.isLive ? '🔴 LIVE' : '📹 VOD'}
          color={stats.isLive ? 'text-red-400' : 'text-green-400'}
        />
        <StatCard
          label="Duration"
          value={stats.isLive ? 'Live' : formatDuration(stats.duration)}
        />
        <StatCard
          label="Renditions"
          value={String(stats.renditions.length)}
          sub={stats.renditions.length > 0 ? `Max: ${(Math.max(...stats.renditions.map(r => r.bandwidth)) / 1000).toFixed(0)} kbps` : undefined}
        />
        <StatCard
          label="Audio Tracks"
          value={String(stats.audioTracks.length || '—')}
          sub={stats.audioTracks[0]?.language}
        />
        <StatCard
          label="DRM"
          value={stats.drm ? stats.drm.method : 'None'}
          color={stats.drm ? 'text-yellow-400' : 'text-gray-400'}
          sub={stats.drm?.systems.map(s => s.name).join(', ')}
        />
        <StatCard
          label="Protocol"
          value={stats.network.protocol}
          color={stats.network.isHttps ? 'text-green-400' : 'text-red-400'}
          sub={stats.network.cdn ? `CDN: ${stats.network.cdn}` : undefined}
        />
        <StatCard
          label="Issues"
          value={`${errorCount} errors, ${warnCount} warnings`}
          color={errorCount > 0 ? 'text-red-400' : warnCount > 0 ? 'text-yellow-400' : 'text-green-400'}
        />
      </div>

      {/* URL */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <div className="text-xs text-gray-400 mb-2">Analyzed URL</div>
        <div className="text-sm text-blue-300 break-all font-mono">{stats.url}</div>
        <div className="text-xs text-gray-500 mt-1">Analyzed at {new Date(stats.analyzedAt).toLocaleString()}</div>
      </div>
    </div>
  );
}
