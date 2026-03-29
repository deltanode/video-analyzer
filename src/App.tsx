import { useState } from 'react';
import type { VideoStats } from './lib/types';
import { analyzeStream } from './lib/analyzer';
import UrlInput from './components/UrlInput';
import OverviewPanel from './components/OverviewPanel';
import RenditionsTable from './components/RenditionsTable';
import SegmentHealth from './components/SegmentHealth';
import LatencyPanel from './components/LatencyPanel';
import DRMPanel from './components/DRMPanel';
import IssuesList from './components/IssuesList';
import NetworkPanel from './components/NetworkPanel';
import ManifestViewer from './components/ManifestViewer';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'renditions', label: 'Renditions' },
  { id: 'segments', label: 'Segments' },
  { id: 'latency', label: 'Latency' },
  { id: 'drm', label: 'DRM' },
  { id: 'issues', label: 'Issues', badge: true },
  { id: 'network', label: 'Network' },
  { id: 'manifest', label: 'Manifest' },
];

export default function App() {
  const [stats, setStats] = useState<VideoStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  const handleAnalyze = async (url: string) => {
    setLoading(true);
    setError(null);
    setStats(null);
    setActiveTab('overview');
    try {
      const result = await analyzeStream(url);
      setStats(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to analyze stream');
    } finally {
      setLoading(false);
    }
  };

  const issueCount = stats ? stats.issues.filter(i => i.severity === 'error' || i.severity === 'warning').length : 0;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3 mb-4">
            <div>
              <h1 className="text-xl font-bold text-white">Video Analyzer</h1>
              <p className="text-gray-400 text-sm">Deep analysis for HLS · DASH · MP4 · Live streams</p>
            </div>
          </div>
          <UrlInput onAnalyze={handleAnalyze} loading={loading} />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <svg className="animate-spin h-8 w-8 text-blue-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <div className="text-gray-400">Fetching and analyzing stream...</div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
            <span className="font-medium">Error: </span>{error}
          </div>
        )}

        {/* Results */}
        {stats && !loading && (
          <div>
            {/* Tab bar */}
            <div className="flex gap-1 border-b border-gray-800 mb-6 overflow-x-auto">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex items-center gap-1.5 ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-400'
                      : 'border-transparent text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {tab.label}
                  {tab.badge && issueCount > 0 && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                      stats.issues.some(i => i.severity === 'error')
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {issueCount}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div>
              {activeTab === 'overview' && <OverviewPanel stats={stats} />}
              {activeTab === 'renditions' && <RenditionsTable stats={stats} />}
              {activeTab === 'segments' && <SegmentHealth stats={stats} />}
              {activeTab === 'latency' && <LatencyPanel stats={stats} />}
              {activeTab === 'drm' && <DRMPanel stats={stats} />}
              {activeTab === 'issues' && <IssuesList stats={stats} />}
              {activeTab === 'network' && <NetworkPanel stats={stats} />}
              {activeTab === 'manifest' && <ManifestViewer stats={stats} />}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!stats && !loading && !error && (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <div className="text-gray-500 text-lg">Paste a stream URL above to start analyzing</div>
            <div className="text-gray-600 text-sm max-w-md">
              Supports HLS (.m3u8), DASH (.mpd), and MP4 URLs. Extracts renditions,
              segment health, latency, DRM info, and auto-detects issues.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
