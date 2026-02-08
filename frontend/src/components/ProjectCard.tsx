import React from 'react';
import { Folder, Globe, Clock, Code, ExternalLink, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { Project } from '../services/api';

interface ProjectCardProps {
  project: Project;
  onClick: () => void;
}

export default function ProjectCard({ project, onClick }: ProjectCardProps) {
  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'pro': return {
        border: 'border-purple-500/30',
        bg: 'bg-purple-500/10',
        text: 'text-purple-300',
        glow: 'glow-purple'
      };
      case 'team': return {
        border: 'border-yellow-500/30',
        bg: 'bg-yellow-500/10',
        text: 'text-yellow-300',
        glow: 'glow-cyan'
      };
      default: return {
        border: 'border-green-500/30',
        bg: 'bg-green-500/10',
        text: 'text-green-300',
        glow: 'glow-blue'
      };
    }
  };

  const tierStyle = getTierColor(project.tier);

  const getDeploymentStatus = () => {
    if (!project.deployment) return null;
    
    const status = project.deployment.status;
    switch (status) {
      case 'deployed':
        return (
          <div className="flex items-center gap-1.5 text-green-400">
            <CheckCircle className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">Déployé</span>
          </div>
        );
      case 'failed':
        return (
          <div className="flex items-center gap-1.5 text-red-400">
            <XCircle className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">Échoué</span>
          </div>
        );
      case 'deploying':
        return (
          <div className="flex items-center gap-1.5 text-yellow-400">
            <AlertCircle className="w-3.5 h-3.5 animate-pulse" />
            <span className="text-xs font-medium">En cours</span>
          </div>
        );
      default:
        return null;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Aujourd'hui";
    if (diffDays === 1) return "Hier";
    if (diffDays < 7) return `Il y a ${diffDays} jours`;
    if (diffDays < 30) return `Il y a ${Math.floor(diffDays / 7)} sem.`;
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  return (
    <div
      onClick={onClick}
      className={`glass-card rounded-2xl p-5 cursor-pointer border ${tierStyle.border} animate-fade-in-up group`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className={`p-2.5 rounded-xl bg-gradient-to-br ${tierStyle.bg} border border-white/5 group-hover:scale-110 transition-transform duration-300 flex-shrink-0`}>
            <Folder className={`w-5 h-5 ${tierStyle.text} glow-icon`} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-white truncate">{project.name}</h3>
            <p className="text-white/40 text-sm line-clamp-1">{project.description}</p>
          </div>
        </div>
        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${tierStyle.bg} ${tierStyle.text} border border-white/5 flex-shrink-0`}>
          {project.tier.toUpperCase()}
        </span>
      </div>

      {/* Tech Stack */}
      <div className="flex flex-wrap gap-2 mb-4">
        {project.techStack.frontend.map((tech) => (
          <span 
            key={tech} 
            className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-white/60 font-medium"
          >
            {tech}
          </span>
        ))}
      </div>

      {/* Deployment Status */}
      {project.deployment && (
        <div className="mb-4">
          {getDeploymentStatus()}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-white/5">
        <div className="flex items-center gap-4 text-xs text-white/40">
          <span className="flex items-center gap-1.5">
            <Code className="w-3.5 h-3.5" />
            {project.filesCount} fichiers
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            {formatDate(project.createdAt)}
          </span>
        </div>
        {project.deployment?.url && (
          <a
            href={project.deployment.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="btn-outline-glow px-3 py-1.5 rounded-lg text-xs font-medium text-white/70 hover:text-white flex items-center gap-1.5 transition-all duration-200"
          >
            <Globe className="w-3.5 h-3.5" />
            Visiter
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  );
}
