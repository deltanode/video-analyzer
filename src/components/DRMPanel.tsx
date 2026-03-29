import type { VideoStats } from '../lib/types';

interface Props { stats: VideoStats }

const DRM_ICONS: Record<string, string> = {
  'Widevine': '🟢',
  'PlayReady': '🔵',
  'FairPlay': '⚪',
  'ClearKey': '🟡',
};

export default function DRMPanel({ stats }: Props) {
  const drm = stats.drm;

  if (!drm) {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 text-center">
        <div className="text-2xl mb-2">🔓</div>
        <div className="text-gray-300 font-medium">No DRM / Encryption Detected</div>
        <div className="text-gray-500 text-sm mt-1">Stream is unencrypted or uses open distribution.</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="text-2xl">🔐</div>
          <div>
            <div className="text-white font-semibold">{drm.method} Encryption</div>
            <div className="text-gray-400 text-sm">{drm.systems.length} DRM system(s) detected</div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex justify-between py-2 border-b border-gray-700">
            <span className="text-gray-400 text-sm">Encryption Method</span>
            <span className="text-yellow-400 font-medium text-sm">{drm.method}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-700">
            <span className="text-gray-400 text-sm">Key Rotation</span>
            <span className={`font-medium text-sm ${drm.hasKeyRotation ? 'text-green-400' : 'text-gray-300'}`}>
              {drm.hasKeyRotation ? 'Yes' : 'No'}
            </span>
          </div>
          {drm.keyServerUrl && (
            <div className="flex justify-between py-2 border-b border-gray-700 col-span-full">
              <span className="text-gray-400 text-sm">Key Server URL</span>
              <span className="text-gray-300 font-mono text-xs ml-4">{drm.keyServerUrl}</span>
            </div>
          )}
        </div>
      </div>

      {/* DRM systems */}
      {drm.systems.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-300 mb-2">DRM Systems</h3>
          <div className="space-y-2">
            {drm.systems.map((sys, i) => (
              <div key={i} className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{DRM_ICONS[sys.name] || '🔒'}</span>
                    <span className="text-white font-medium">{sys.name}</span>
                  </div>
                  {sys.psshPresent && (
                    <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs">PSSH Present</span>
                  )}
                </div>
                {sys.schemeIdUri && (
                  <div className="text-gray-500 font-mono text-xs mt-2">{sys.schemeIdUri}</div>
                )}
                {sys.licenseUrl && (
                  <div className="text-gray-400 text-xs mt-1">License: <span className="font-mono text-gray-300">{sys.licenseUrl}</span></div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cross-platform coverage */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
        <div className="text-xs text-gray-400 mb-3">Cross-Platform DRM Coverage</div>
        <div className="space-y-2">
          {[
            { platform: 'Chrome / Android', drm: 'Widevine', icon: '🟢' },
            { platform: 'Safari / iOS / macOS', drm: 'FairPlay', icon: '⚪' },
            { platform: 'Edge / Windows', drm: 'PlayReady', icon: '🔵' },
          ].map(({ platform, drm: drmName, icon }) => {
            const covered = drm.systems.some(s => s.name === drmName);
            return (
              <div key={platform} className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <span>{icon}</span>
                  <span className="text-gray-300">{platform}</span>
                  <span className="text-gray-500 text-xs">({drmName})</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded ${covered ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                  {covered ? 'Covered' : 'Missing'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
