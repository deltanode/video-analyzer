import { useState } from 'react';
import type { VideoStats } from '../lib/types';

interface Props { stats: VideoStats }

export default function ManifestViewer({ stats }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (stats.rawManifest) {
      navigator.clipboard.writeText(stats.rawManifest);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!stats.rawManifest) {
    return (
      <div className="text-gray-400 text-sm bg-gray-800 rounded-lg p-6 text-center">
        Raw manifest not available for this stream type.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-400">
          {stats.rawManifest.split('\n').length} lines · {(stats.rawManifest.length / 1024).toFixed(1)} KB
        </div>
        <button
          onClick={handleCopy}
          className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      <pre className="bg-gray-900 rounded-lg border border-gray-700 p-4 text-xs text-gray-300 font-mono overflow-auto max-h-[600px] leading-relaxed whitespace-pre-wrap break-all">
        {stats.rawManifest}
      </pre>
    </div>
  );
}
