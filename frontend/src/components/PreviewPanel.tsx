import { useBuilderStore } from '../store/builderStore';
import { Play, ExternalLink, RefreshCw, Loader2, CheckCircle, XCircle, Globe, Eye, Code2 } from 'lucide-react';
import { useState } from 'react';

export default function PreviewPanel() {
  const { selectedFile, selectedFileContent, deployment, isDeploying } = useBuilderStore();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const getDeploymentStatusBadge = () => {
    if (!deployment && !isDeploying) return null;

    if (isDeploying) {
      return (
        <div className="flex items-center gap-2 bg-blue-500/20 border border-blue-500/30 text-blue-300 px-3 py-1 rounded-full text-sm animate-pulse-glow">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Déploiement en cours...</span>
        </div>
      );
    }

    if (deployment?.status === 'deployed') {
      return (
        <div className="flex items-center gap-2 bg-green-500/20 border border-green-500/30 text-green-300 px-3 py-1 rounded-full text-sm glow-blue">
          <CheckCircle className="w-4 h-4" />
          <span>Déployé</span>
        </div>
      );
    }

    if (deployment?.status === 'failed') {
      return (
        <div className="flex items-center gap-2 bg-red-500/20 border border-red-500/30 text-red-300 px-3 py-1 rounded-full text-sm">
          <XCircle className="w-4 h-4" />
          <span>Échec</span>
        </div>
      );
    }

    return null;
  };

  // Determine preview type based on file extension
  const getPreviewContent = () => {
    if (!selectedFile) {
      return (
        <div className="h-full flex items-center justify-center animate-fade-in-up">
          <div className="w-full max-w-2xl mx-auto p-8 glass-card rounded-xl border-2 border-dashed border-white/10">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center animate-pulse-glow">
              <Eye className="w-8 h-8 text-blue-400 glow-icon" />
            </div>
            <h2 className="text-2xl font-bold gradient-text mb-4">Prévisualisation</h2>
            <p className="text-white/60 mb-6">
              Sélectionnez un fichier pour prévisualiser son contenu
            </p>
            <div className="glass-card bg-black/30 h-64 rounded-lg flex items-center justify-center border border-white/5">
              <span className="text-white/30">Preview Iframe</span>
            </div>
          </div>
        </div>
      );
    }

    const extension = selectedFile.split('.').pop()?.toLowerCase();
    const isHtml = extension === 'html' || extension === 'htm';
    const isCss = extension === 'css';
    const isJs = extension === 'js' || extension === 'jsx' || extension === 'ts' || extension === 'tsx';

    if (isHtml && selectedFileContent) {
      return (
        <div className="h-full flex flex-col animate-fade-in-up">
          <div className="flex items-center justify-between px-4 py-3 glass-card border-b border-white/10">
            <div className="flex items-center gap-2">
              <span className="text-sm text-white/80">{selectedFile}</span>
              {getDeploymentStatusBadge()}
            </div>
            <div className="flex items-center gap-2">
              {deployment?.url && (
                <a
                  href={deployment.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-outline-glow flex items-center gap-1 px-3 py-2 rounded-lg text-sm text-white/70 hover:text-white"
                >
                  <Globe className="w-4 h-4 glow-icon" />
                  <span className="hidden sm:inline">Voir en ligne</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="btn-outline-glow flex items-center gap-1 px-3 py-2 rounded-lg text-sm text-white/70 hover:text-white"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Actualiser</span>
              </button>
            </div>
          </div>
          <div className="flex-1 bg-white/5">
            <iframe
              srcDoc={selectedFileContent}
              className="w-full h-full border-none"
              title="Preview"
              sandbox="allow-scripts"
            />
          </div>
        </div>
      );
    }

    // For non-HTML files, show code preview
    return (
      <div className="h-full flex flex-col animate-fade-in-up">
        <div className="flex items-center justify-between px-4 py-3 glass-card border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-sm text-white/80">{selectedFile}</span>
            {getDeploymentStatusBadge()}
          </div>
          <div className="flex items-center gap-2">
            {deployment?.url && (
              <a
                href={deployment.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-outline-glow flex items-center gap-1 px-3 py-2 rounded-lg text-sm text-white/70 hover:text-white"
              >
                <Globe className="w-4 h-4 glow-icon" />
                <span className="hidden sm:inline">Voir en ligne</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
            <div className="flex items-center gap-2 text-sm text-white/50">
              <Code2 className="w-4 h-4" />
              <span className="hidden sm:inline">Code Preview</span>
            </div>
          </div>
        </div>
        <div className="flex-1 bg-black/30 p-4 overflow-auto">
          <pre className="text-sm text-white/90 font-mono whitespace-pre-wrap">
            {selectedFileContent || '(Fichier vide)'}
          </pre>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full">
      {getPreviewContent()}
    </div>
  );
}
