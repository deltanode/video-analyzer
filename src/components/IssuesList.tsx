import type { VideoStats, Issue } from '../lib/types';

interface Props { stats: VideoStats }

const SEVERITY_CONFIG = {
  error: { bg: 'bg-red-500/10', border: 'border-red-500/30', icon: '✗', iconColor: 'text-red-400', labelColor: 'text-red-400', label: 'Error' },
  warning: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', icon: '⚠', iconColor: 'text-yellow-400', labelColor: 'text-yellow-400', label: 'Warning' },
  info: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', icon: 'ℹ', iconColor: 'text-blue-400', labelColor: 'text-blue-400', label: 'Info' },
};

function IssueCard({ issue }: { issue: Issue }) {
  const cfg = SEVERITY_CONFIG[issue.severity];
  return (
    <div className={`rounded-lg border p-4 ${cfg.bg} ${cfg.border}`}>
      <div className="flex items-start gap-3">
        <span className={`text-lg leading-none mt-0.5 ${cfg.iconColor}`}>{cfg.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-semibold uppercase tracking-wide ${cfg.labelColor}`}>{cfg.label}</span>
            <span className="text-gray-600 text-xs font-mono">{issue.code}</span>
          </div>
          <div className="text-white text-sm mb-2">{issue.message}</div>
          <div className="text-gray-400 text-sm">
            <span className="text-gray-500">Fix: </span>{issue.suggestion}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function IssuesList({ stats }: Props) {
  const errors = stats.issues.filter(i => i.severity === 'error');
  const warnings = stats.issues.filter(i => i.severity === 'warning');
  const infos = stats.issues.filter(i => i.severity === 'info');

  if (stats.issues.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg border border-green-500/30 p-8 text-center">
        <div className="text-4xl mb-3">✓</div>
        <div className="text-green-400 font-semibold text-lg">No Issues Detected</div>
        <div className="text-gray-400 text-sm mt-1">Stream looks healthy based on static analysis.</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex gap-4">
        {errors.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/30 rounded-lg">
            <span className="text-red-400 font-bold">{errors.length}</span>
            <span className="text-gray-400 text-sm">Error{errors.length !== 1 ? 's' : ''}</span>
          </div>
        )}
        {warnings.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <span className="text-yellow-400 font-bold">{warnings.length}</span>
            <span className="text-gray-400 text-sm">Warning{warnings.length !== 1 ? 's' : ''}</span>
          </div>
        )}
        {infos.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <span className="text-blue-400 font-bold">{infos.length}</span>
            <span className="text-gray-400 text-sm">Info</span>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {[...errors, ...warnings, ...infos].map((issue, i) => (
          <IssueCard key={i} issue={issue} />
        ))}
      </div>
    </div>
  );
}
