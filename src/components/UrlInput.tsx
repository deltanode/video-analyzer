import { useState } from 'react';

interface Props {
  onAnalyze: (url: string) => void;
  loading: boolean;
}

const SAMPLES = [
  { label: 'Apple HLS (VOD)', url: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8' },
  { label: 'Apple HLS (TS)', url: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/bipbop_adv_example_hevc/master.m3u8' },
  { label: 'Akamai DASH', url: 'https://dash.akamaized.net/akamai/bbb_30fps/bbb_30fps.mpd' },
];

export default function UrlInput({ onAnalyze, loading }: Props) {
  const [url, setUrl] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) onAnalyze(url.trim());
  };

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="Paste HLS (.m3u8), DASH (.mpd), or MP4 URL..."
          className="flex-1 px-4 py-3 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
        />
        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-medium text-sm transition-colors flex items-center gap-2"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Analyzing...
            </>
          ) : 'Analyze'}
        </button>
      </form>

      <div className="mt-3 flex flex-wrap gap-2 items-center">
        <span className="text-xs text-gray-500">Samples:</span>
        {SAMPLES.map(s => (
          <button
            key={s.url}
            onClick={() => { setUrl(s.url); onAnalyze(s.url); }}
            disabled={loading}
            className="text-xs px-3 py-1 rounded-full bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 transition-colors disabled:opacity-50"
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
