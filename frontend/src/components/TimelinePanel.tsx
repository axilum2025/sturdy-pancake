import { Clock, CheckCircle, Circle, Loader2, FileText, Code, Sparkles, AlertCircle, Zap, Trash2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useStudioStore, TimelineEvent } from '../store/studioStore';

export default function TimelinePanel({ onClose }: { onClose?: () => void }) {
  const { timelineEvents: events, clearTimeline } = useStudioStore();
  const { t } = useTranslation();

  const getEventIcon = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'planning':
        return <Sparkles className="w-4 h-4 text-indigo-400 glow-icon" />;
      case 'generation':
        return <Zap className="w-4 h-4 text-blue-400 glow-icon" />;
      case 'file-create':
        return <FileText className="w-4 h-4 text-blue-400 glow-icon" />;
      case 'file-edit':
        return <Code className="w-4 h-4 text-indigo-400 glow-icon" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      case 'complete':
        return <CheckCircle className="w-4 h-4 text-green-400 glow-icon" />;
      default:
        return <Circle className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusDot = (status: TimelineEvent['status']) => {
    switch (status) {
      case 'completed':
        return <div className="w-2 h-2 rounded-full bg-green-400 glow-blue"></div>;
      case 'running':
        return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />;
      case 'error':
        return <div className="w-2 h-2 rounded-full bg-red-400"></div>;
      case 'pending':
        return <div className="w-2 h-2 rounded-full bg-gray-500"></div>;
      default:
        return <div className="w-2 h-2 rounded-full bg-gray-500"></div>;
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="px-4 py-3 border-b border-t-overlay/10 flex items-center justify-between">
        <h3 className="text-lg font-semibold gradient-text flex items-center gap-2">
          <Clock className="w-5 h-5 glow-icon" />
          {t('timeline.title')}
        </h3>
        {events.length > 0 && (
          <button
            onClick={clearTimeline}
            className="p-1.5 rounded-lg text-t-text/30 hover:text-t-text/60 hover:bg-t-overlay/5 transition-colors"
            title={t('timeline.clear')}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-t-text/50 hover:text-t-text hover:bg-t-overlay/10 transition-colors"
            title={t('common.close')}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      
      {/* Timeline */}
      <div className="p-4">
        {events.length === 0 ? (
          <div className="text-center py-8 animate-fade-in-up">
            <Clock className="w-12 h-12 mx-auto mb-3 text-t-text/20" />
            <p className="text-t-text/40 text-sm">{t('timeline.noActivity')}</p>
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[19px] top-0 bottom-0 w-px bg-gradient-to-b from-blue-500/50 via-indigo-500/50 to-transparent"></div>
            
            <div className="space-y-4">
              {events.map((event, idx) => (
                <div key={event.id} className="relative flex gap-3 animate-fade-in-up" style={{ animationDelay: `${idx * 100}ms` }}>
                  {/* Timeline dot */}
                  <div className="relative z-10 flex-shrink-0 w-10 h-10 rounded-full glass-card flex items-center justify-center border border-t-overlay/10">
                    {getEventIcon(event.type)}
                  </div>
                  
                  {/* Event content */}
                  <div className="flex-1 min-w-0">
                    <div className="glass-card p-3 rounded-lg border border-t-overlay/5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-t-text/90 text-sm">{event.message}</p>
                        {getStatusDot(event.status)}
                      </div>
                      <p className="text-t-text/40 text-xs mt-2">
                        {event.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
