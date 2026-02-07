import { useBuilderStore } from '../store/builderStore';
import { Play, ExternalLink, RefreshCw, Loader2, CheckCircle, XCircle, Globe } from 'lucide-react';
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
        <div className="flex items-center gap-2 bg-blue-600 text-white px-3 py-1 rounded-full text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Déploiement en cours...</span>
        </div>
      );
    }

    if (deployment?.status === 'deployed') {
      return (
        <div className="flex items-center gap-2 bg-green-600 text-white px-3 py-1 rounded-full text-sm">
          <CheckCircle className="w-4 h-4" />
          <span>Déployé avec succès</span>
        </div>
      );
    }

    if (deployment?.status === 'failed') {
      return (
        <div className="flex items-center gap-2 bg-red-600 text-white px-3 py-1 rounded-full text-sm">
          <XCircle className="w-4 h-4" />
          <span>Échec du déploiement</span>
        </div>
      );
    }

    return null;
  };

  // Determine preview type based on file extension
  const getPreviewContent = () => {
    if (!selectedFile) {
      return (
        <div className="text-center">
          <div className="w-full max-w-2xl mx-auto p-8 bg-gray-800 rounded-lg border-2 border-dashed border-gray-600">
            <h2 className="text-2xl font-bold text-white mb-4">Aperçu en direct</h2>
            <p className="text-gray-400 mb-6">
              Sélectionnez un fichier pour prévisualiser son contenu
            </p>
            <div className="bg-gray-700 h-64 rounded-lg flex items-center justify-center">
              <span className="text-gray-500">Preview Iframe</span>
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
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-300">{selectedFile}</span>
              {getDeploymentStatusBadge()}
            </div>
            <div className="flex items-center gap-2">
              {deployment?.url && (
                <a
                  href={deployment.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm"
                >
                  <Globe className="w-4 h-4" />
                  <span>Voir en ligne</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="flex items-center gap-1 px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                Actualiser
              </button>
            </div>
          </div>
          <div className="flex-1 bg-white">
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
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-300">{selectedFile}</span>
            {getDeploymentStatusBadge()}
          </div>
          <div className="flex items-center gap-2">
            {deployment?.url && (
              <a
                href={deployment.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm"
              >
                <Globe className="w-4 h-4" />
                <span>Voir en ligne</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Play className="w-4 h-4" />
              <span>Code Preview</span>
            </div>
          </div>
        </div>
        <div className="flex-1 bg-gray-900 p-4 overflow-auto">
          <pre className="text-sm text-gray-100 font-mono whitespace-pre-wrap">
            {selectedFileContent || '(Fichier vide)'}
          </pre>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full bg-gray-900">
      {getPreviewContent()}
    </div>
  );
}
