import React from 'react';
import { Folder, Globe, Clock, Code } from 'lucide-react';
import { Project } from '../services/api';

interface ProjectCardProps {
  project: Project;
  onClick: () => void;
}

export default function ProjectCard({ project, onClick }: ProjectCardProps) {
  const tierColors = {
    free: 'border-green-500 bg-green-500/10',
    pro: 'border-purple-500 bg-purple-500/10',
    team: 'border-yellow-500 bg-yellow-500/10',
  };

  return (
    <div
      onClick={onClick}
      className={`bg-gray-800 rounded-lg border-2 ${tierColors[project.tier]} p-6 cursor-pointer hover:opacity-80 transition-opacity`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gray-700 rounded-lg">
            <Folder className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">{project.name}</h3>
            <p className="text-gray-400 text-sm">{project.description}</p>
          </div>
        </div>
        <span className={`px-2 py-1 rounded text-xs font-medium ${
          project.tier === 'pro' ? 'bg-purple-500/20 text-purple-300' :
          project.tier === 'team' ? 'bg-yellow-500/20 text-yellow-300' :
          'bg-green-500/20 text-green-300'
        }`}>
          {project.tier.toUpperCase()}
        </span>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {project.techStack.frontend.map((tech) => (
          <span key={tech} className="px-2 py-1 bg-gray-700 rounded text-xs text-gray-300">
            {tech}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between text-sm text-gray-400">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <Code className="w-4 h-4" />
            {project.filesCount} files
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {new Date(project.createdAt).toLocaleDateString()}
          </span>
        </div>
        {project.deployment?.url && (
          <a
            href={project.deployment.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 text-blue-400 hover:text-blue-300"
          >
            <Globe className="w-4 h-4" />
            Visit
          </a>
        )}
      </div>
    </div>
  );
}
