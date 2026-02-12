import { useState } from 'react';
import { Bot, Clock, Wrench, MessageSquare, Globe, ExternalLink, CheckCircle, AlertCircle, FileEdit, Trash2, QrCode } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Agent } from '../services/api';
import QRCodeModal from './QRCodeModal';

interface ProjectCardProps {
  project: Agent;
  onClick: () => void;
  onDelete?: (id: string) => void;
}

export default function ProjectCard({ project, onClick, onDelete }: ProjectCardProps) {
  const { t } = useTranslation();
  const [showQR, setShowQR] = useState(false);
  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'deployed': return { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/30', label: t('projectCard.deployed'), icon: CheckCircle };
      case 'active': return { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30', label: t('projectCard.active'), icon: AlertCircle };
      default: return { bg: 'bg-t-overlay/5', text: 'text-t-text/50', border: 'border-t-overlay/10', label: t('projectCard.draft'), icon: FileEdit };
    }
  };

  const getTierStyle = (tier: string) => {
    switch (tier) {
      case 'pro': return { bg: 'bg-indigo-500/10', text: 'text-indigo-300', border: 'border-indigo-500/30' };
      default: return { bg: 'bg-blue-500/10', text: 'text-blue-300', border: 'border-blue-500/30' };
    }
  };

  const statusStyle = getStatusStyle(project.status);
  const tierStyle = getTierStyle(project.tier);
  const StatusIcon = statusStyle.icon;

  const modelShortName = (model: string) => {
    if (model.includes('nano')) return 'GPT-4.1 Nano';
    if (model.includes('mini')) return 'GPT-4.1 Mini';
    if (model.includes('4.1')) return 'GPT-4.1';
    return model.split('/').pop() || model;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return t('projectCard.today');
    if (diffDays === 1) return t('projectCard.yesterday');
    if (diffDays < 7) return t('projectCard.daysAgo', { count: diffDays });
    if (diffDays < 30) return t('projectCard.weeksAgo', { count: Math.floor(diffDays / 7) });
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  const toolsCount = project.config?.tools?.filter(t => t.enabled).length || 0;

  return (
    <div
      onClick={onClick}
      className={`glass-card rounded-2xl p-5 cursor-pointer border ${tierStyle.border} animate-fade-in-up group`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className={`p-2.5 rounded-xl bg-gradient-to-br ${tierStyle.bg} border border-t-overlay/5 group-hover:scale-110 transition-transform duration-300 flex-shrink-0`}>
            <Bot className={`w-5 h-5 ${tierStyle.text} glow-icon`} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-t-text truncate">{project.name}</h3>
            <p className="text-t-text/40 text-sm line-clamp-1">{project.description || t('projectCard.noDescription')}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${statusStyle.bg} ${statusStyle.text} border ${statusStyle.border}`}>
            <StatusIcon className="w-3 h-3" />
            {statusStyle.label}
          </div>
          {onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(project.id); }}
              className="p-1.5 rounded-lg text-t-text/30 hover:text-red-400 hover:bg-red-500/10 active:text-red-400 active:bg-red-500/10 transition-all duration-200"
              title={t('projectCard.delete')}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Model & Tools */}
      <div className="flex flex-wrap gap-2 mb-4">
        <span className="px-2.5 py-1 rounded-lg bg-t-overlay/5 border border-t-overlay/10 text-xs text-t-text/60 font-medium">
          {modelShortName(project.config?.model || 'openai/gpt-4.1')}
        </span>
        {toolsCount > 0 && (
          <span className="px-2.5 py-1 rounded-lg bg-t-overlay/5 border border-t-overlay/10 text-xs text-t-text/60 font-medium flex items-center gap-1">
            <Wrench className="w-3 h-3" />
            {toolsCount} {t('projectCard.tools', { count: toolsCount })}
          </span>
        )}
      </div>

      {/* Endpoint */}
      {project.endpoint && (
        <div className="mb-4">
          <div className="flex items-center gap-1.5 text-green-400">
            <CheckCircle className="w-3.5 h-3.5" />
            <span className="text-xs font-medium truncate">{project.endpoint}</span>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-t-overlay/5">
        <div className="flex items-center gap-4 text-xs text-t-text/40">
          <span className="flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5" />
            {project.totalConversations} {t('projectCard.conversations')}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            {formatDate(project.updatedAt)}
          </span>
        </div>
        {project.endpoint && project.slug && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={(e) => { e.stopPropagation(); setShowQR(true); }}
              className="btn-outline-glow px-2.5 py-1.5 rounded-lg text-xs font-medium text-t-text/70 hover:text-indigo-300 flex items-center gap-1 transition-all duration-200"
              title={t('projectCard.qrCode', 'QR Code')}
            >
              <QrCode className="w-3.5 h-3.5" />
              QR
            </button>
            <a
              href={project.endpoint}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="btn-outline-glow px-3 py-1.5 rounded-lg text-xs font-medium text-t-text/70 hover:text-t-text flex items-center gap-1.5 transition-all duration-200"
            >
              <Globe className="w-3.5 h-3.5" />
              API
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
      </div>

      {/* QR Code Modal */}
      {project.slug && (
        <QRCodeModal
          isOpen={showQR}
          onClose={() => setShowQR(false)}
          agentName={project.name}
          agentSlug={project.slug}
        />
      )}
    </div>
  );
}
