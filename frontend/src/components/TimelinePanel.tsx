import { Clock, CheckCircle, Circle } from 'lucide-react';

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

  return (
    <div className="h-full bg-gray-800 overflow-y-auto">
      <div className="p-4">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Historique de l'agent
        </h3>
        
        <div className="space-y-3">
          {events.length === 0 ? (
            <p className="text-gray-400 text-sm">Aucune activité pour le moment</p>
          ) : (
            events.map((event) => (
              <div key={event.id} className="flex gap-3 text-sm">
                <div className="mt-1">
                  {event.status === 'completed' ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : event.status === 'running' ? (
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Circle className="w-4 h-4 text-gray-500" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-gray-200">{event.message}</p>
                  <p className="text-gray-500 text-xs mt-1">
                    {event.timestamp.toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
