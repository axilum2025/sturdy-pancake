import { Clock, CheckCircle, Circle, Loader2, FileText, Code, Terminal, Sparkles } from 'lucide-react';

interface TimelineEvent {
  id: string;
  type: 'planning' | 'file-create' | 'file-edit' | 'command' | 'complete';
  message: string;
  timestamp: Date;
  status: 'pending' | 'running' | 'completed';
}

export default function TimelinePanel() {
  // Mock data - will be connected to real events later
  const events: TimelineEvent[] = [
    {
      id: '1',
      type: 'planning',
      message: 'Analyse de la demande...',
      timestamp: new Date(),
      status: 'completed'
    }
  ];

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'planning':
        return <Sparkles className="w-4 h-4 text-purple-400 glow-icon" />;
      case 'file-create':
        return <FileText className="w-4 h-4 text-blue-400 glow-icon" />;
      case 'file-edit':
        return <Code className="w-4 h-4 text-cyan-400 glow-icon" />;
      case 'command':
        return <Terminal className="w-4 h-4 text-green-400 glow-icon" />;
      case 'complete':
        return <CheckCircle className="w-4 h-4 text-green-400 glow-icon" />;
      default:
        return <Circle className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusDot = (status: string) => {
    switch (status) {
      case 'completed':
        return <div className="w-2 h-2 rounded-full bg-green-400 glow-blue"></div>;
      case 'running':
        return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />;
      case 'pending':
        return <div className="w-2 h-2 rounded-full bg-gray-500"></div>;
      default:
        return <div className="w-2 h-2 rounded-full bg-gray-500"></div>;
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10">
        <h3 className="text-lg font-semibold gradient-text flex items-center gap-2">
          <Clock className="w-5 h-5 glow-icon" />
          Historique
        </h3>
      </div>
      
      {/* Timeline */}
      <div className="p-4">
        {events.length === 0 ? (
          <div className="text-center py-8 animate-fade-in-up">
            <Clock className="w-12 h-12 mx-auto mb-3 text-white/20" />
            <p className="text-white/40 text-sm">Aucune activité pour le moment</p>
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[19px] top-0 bottom-0 w-px bg-gradient-to-b from-blue-500/50 via-purple-500/50 to-transparent"></div>
            
            <div className="space-y-4">
              {events.map((event, idx) => (
                <div key={event.id} className="relative flex gap-3 animate-fade-in-up" style={{ animationDelay: `${idx * 100}ms` }}>
                  {/* Timeline dot */}
                  <div className="relative z-10 flex-shrink-0 w-10 h-10 rounded-full glass-card flex items-center justify-center border border-white/10">
                    {getEventIcon(event.type)}
                  </div>
                  
                  {/* Event content */}
                  <div className="flex-1 min-w-0">
                    <div className="glass-card p-3 rounded-lg border border-white/5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-white/90 text-sm">{event.message}</p>
                        {getStatusDot(event.status)}
                      </div>
                      <p className="text-white/40 text-xs mt-2">
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
