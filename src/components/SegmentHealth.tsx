import type { VideoStats } from '../lib/types';

interface Props { stats: VideoStats }

function Row({ label, value, highlight }: { label: string; value: string; highlight?: 'ok' | 'warn' | 'error' }) {
  const colors = { ok: 'text-green-400', warn: 'text-yellow-400', error: 'text-red-400' };
  return (
    <div className="flex justify-between items-center py-2.5 border-b border-gray-700 last:border-0">
      <span className="text-gray-400 text-sm">{label}</span>
      <span className={`text-sm font-medium ${highlight ? colors[highlight] : 'text-white'}`}>{value}</span>
    </div>
  );
}

export default function SegmentHealth({ stats }: Props) {
  const seg = stats.segments;

  if (!seg) {
    return (
      <div className="text-gray-400 text-sm bg-gray-800 rounded-lg p-6 text-center">
        No segment information available. For HLS streams, segment data is fetched from the media playlist.
      </div>
    );
  }

  const variancePct = seg.targetDuration > 0
    ? ((seg.maxSegmentDuration - seg.minSegmentDuration) / seg.targetDuration * 100)
    : 0;

  return (
    <div className="space-y-4">
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
          <div>
            <Row label="Target Duration" value={`${seg.targetDuration}s`} />
            <Row label="Average Duration" value={`${seg.avgSegmentDuration}s`}
              highlight={Math.abs(seg.avgSegmentDuration - seg.targetDuration) > seg.targetDuration * 0.1 ? 'warn' : 'ok'} />
            <Row label="Min Segment" value={`${seg.minSegmentDuration}s`} />
            <Row label="Max Segment" value={`${seg.maxSegmentDuration}s`}
              highlight={seg.maxSegmentDuration > seg.targetDuration * 1.1 ? 'warn' : 'ok'} />
            <Row label="Duration Variance" value={`${variancePct.toFixed(1)}%`}
              highlight={variancePct > 30 ? 'warn' : 'ok'} />
          </div>
          <div>
            <Row label="Segment Count" value={String(seg.segmentCount)} />
            <Row label="Total Duration" value={`${seg.totalDuration.toFixed(1)}s`} />
            <Row label="Media Sequence" value={seg.mediaSequence !== undefined ? String(seg.mediaSequence) : '—'} />
            <Row label="Gaps Detected" value={String(seg.gaps)}
              highlight={seg.gaps > 0 ? 'error' : 'ok'} />
            <Row label="Discontinuities" value={String(seg.discontinuities)}
              highlight={seg.discontinuities > 0 ? 'warn' : 'ok'} />
            <Row label="Byte-Range Segments" value={seg.byteRange ? 'Yes' : 'No'} />
          </div>
        </div>
      </div>

      {/* Visual segment health bar */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
        <div className="text-xs text-gray-400 mb-3">Segment Health Score</div>
        {(() => {
          let score = 100;
          const items: { label: string; impact: number; pass: boolean }[] = [
            { label: 'No gaps', impact: 30, pass: seg.gaps === 0 },
            { label: 'No discontinuities', impact: 20, pass: seg.discontinuities === 0 },
            { label: 'Consistent duration', impact: 25, pass: variancePct <= 20 },
            { label: 'Duration within target', impact: 25, pass: seg.maxSegmentDuration <= seg.targetDuration * 1.1 },
          ];
          items.forEach(i => { if (!i.pass) score -= i.impact; });
          const color = score >= 80 ? 'bg-green-500' : score >= 50 ? 'bg-yellow-500' : 'bg-red-500';
          return (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-gray-700 rounded-full h-3">
                  <div className={`${color} h-3 rounded-full transition-all`} style={{ width: `${score}%` }} />
                </div>
                <span className={`text-sm font-bold ${score >= 80 ? 'text-green-400' : score >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {score}/100
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {items.map(item => (
                  <div key={item.label} className="flex items-center gap-2 text-xs">
                    <span className={item.pass ? 'text-green-400' : 'text-red-400'}>{item.pass ? '✓' : '✗'}</span>
                    <span className="text-gray-400">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
