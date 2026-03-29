import type { VideoStats } from '../lib/types';

interface Props { stats: VideoStats }

function Row({ label, value, highlight, mono }: { label: string; value: string; highlight?: 'ok' | 'warn' | 'error'; mono?: boolean }) {
  const colors = { ok: 'text-green-400', warn: 'text-yellow-400', error: 'text-red-400' };
  return (
    <div className="flex justify-between items-center py-2.5 border-b border-gray-700 last:border-0">
      <span className="text-gray-400 text-sm">{label}</span>
      <span className={`text-sm ${mono ? 'font-mono' : 'font-medium'} ${highlight ? colors[highlight] : 'text-white'} text-right ml-4`}>{value}</span>
    </div>
  );
}

export default function NetworkPanel({ stats }: Props) {
  const { network } = stats;
  const ttfbSec = (network.ttfb / 1000).toFixed(2);

  const importantHeaders = [
    'content-type', 'cache-control', 'access-control-allow-origin',
    'x-cache', 'via', 'cf-ray', 'x-amz-cf-id', 'server',
    'age', 'etag', 'last-modified', 'content-length',
  ];

  const filteredHeaders = Object.entries(network.responseHeaders)
    .filter(([k]) => importantHeaders.includes(k.toLowerCase()))
    .sort(([a], [b]) => a.localeCompare(b));

  const allHeaders = Object.entries(network.responseHeaders);

  return (
    <div className="space-y-4">
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
          <div>
            <Row label="HTTP Status" value={String(network.httpStatus || '—')}
              highlight={network.httpStatus >= 200 && network.httpStatus < 300 ? 'ok' : network.httpStatus >= 400 ? 'error' : undefined}
            />
            <Row label="Protocol" value={network.protocol}
              highlight={network.isHttps ? 'ok' : 'warn'}
            />
            <Row label="Time to First Byte (TTFB)" value={`${ttfbSec}s`}
              highlight={network.ttfb < 1000 ? 'ok' : network.ttfb < 3000 ? 'warn' : 'error'}
            />
            <Row label="CDN" value={network.cdn || 'Not detected'} />
          </div>
          <div>
            <Row label="CORS Header Present" value={network.cors ? 'Yes' : 'No'}
              highlight={network.cors ? 'ok' : 'warn'}
            />
            <Row label="CORS Blocked" value={network.corsBlocked ? 'Yes (using proxy)' : 'No'}
              highlight={network.corsBlocked ? 'warn' : 'ok'}
            />
            <Row label="Cache-Control" value={network.cacheControl || '—'} mono />
            <Row label="Content-Type" value={network.contentType?.split(';')[0] || '—'} mono />
          </div>
        </div>
      </div>

      {filteredHeaders.length > 0 && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <div className="text-xs text-gray-400 mb-3">Response Headers (Key)</div>
          <div className="space-y-1.5">
            {filteredHeaders.map(([k, v]) => (
              <div key={k} className="flex gap-2 text-xs">
                <span className="text-gray-500 font-mono min-w-0 shrink-0 w-48">{k}:</span>
                <span className="text-gray-300 font-mono break-all">{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {allHeaders.length > filteredHeaders.length && (
        <details className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-300">
            All Headers ({allHeaders.length} total)
          </summary>
          <div className="mt-3 space-y-1.5">
            {allHeaders.map(([k, v]) => (
              <div key={k} className="flex gap-2 text-xs">
                <span className="text-gray-500 font-mono min-w-0 shrink-0 w-48">{k}:</span>
                <span className="text-gray-300 font-mono break-all">{v}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
