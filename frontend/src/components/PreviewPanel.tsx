import { useBuilderStore } from '../store/builderStore';
import { Play, ExternalLink, RefreshCw } from 'lucide-react';
import { useState } from 'react';

export default function PreviewPanel() {
  const { selectedFile, selectedFileContent } = useBuilderStore();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1000);
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
            </div>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-1 px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Actualiser
            </button>
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
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Play className="w-4 h-4" />
            <span>Code Preview</span>
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
