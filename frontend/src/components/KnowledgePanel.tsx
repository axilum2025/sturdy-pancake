import { useState, useEffect, useCallback, useRef } from 'react';
import {
  BookOpen, Upload, Trash2, Search, FileText, FileSpreadsheet,
  AlertCircle, CheckCircle2, Loader2, HardDrive, Hash, Database,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  uploadKnowledgeDocument,
  listKnowledgeDocuments,
  deleteKnowledgeDocument,
  searchKnowledge,
  getKnowledgeStats,
  KnowledgeDocument,
  KnowledgeSearchResult,
  KnowledgeStats,
} from '../services/api';

interface KnowledgePanelProps {
  agentId: string;
}

const MIME_ICONS: Record<string, typeof FileText> = {
  'application/pdf': FileText,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': FileText,
  'text/csv': FileSpreadsheet,
  'application/json': FileText,
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function statusBadge(status: KnowledgeDocument['status']) {
  switch (status) {
    case 'processing':
      return (
        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300">
          <Loader2 className="w-2.5 h-2.5 animate-spin" /> Traitement…
        </span>
      );
    case 'ready':
      return (
        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-300">
          <CheckCircle2 className="w-2.5 h-2.5" /> Prêt
        </span>
      );
    case 'error':
      return (
        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-300">
          <AlertCircle className="w-2.5 h-2.5" /> Erreur
        </span>
      );
  }
}

export default function KnowledgePanel({ agentId }: KnowledgePanelProps) {
  const { t } = useTranslation();
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [stats, setStats] = useState<KnowledgeStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<KnowledgeSearchResult[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    try {
      const [docsRes, statsRes] = await Promise.all([
        listKnowledgeDocuments(agentId),
        getKnowledgeStats(agentId),
      ]);
      setDocuments(docsRes.documents);
      setStats(statsRes);
    } catch (error) {
      console.error('Error loading knowledge data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    loadData();
    // Poll for processing docs
    const interval = setInterval(() => {
      if (documents.some((d) => d.status === 'processing')) {
        loadData();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [loadData, documents]);

  const handleUpload = async (files: FileList | File[]) => {
    setUploadError(null);
    setIsUploading(true);
    try {
      for (const file of Array.from(files)) {
        await uploadKnowledgeDocument(agentId, file);
      }
      await loadData();
    } catch (error: any) {
      setUploadError(error.message || 'Erreur lors du téléversement');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleUpload(e.dataTransfer.files);
    }
  };

  const handleDelete = async (docId: string) => {
    if (!confirm('Supprimer ce document et tous ses chunks ?')) return;
    try {
      await deleteKnowledgeDocument(agentId, docId);
      await loadData();
    } catch (error) {
      console.error('Error deleting document:', error);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const res = await searchKnowledge(agentId, searchQuery.trim(), 5);
      setSearchResults(res.results);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-pulse text-t-text/40">{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-t-overlay/[0.04] rounded-xl border border-t-overlay/10 p-3 text-center">
            <Database className="w-5 h-5 mx-auto mb-1 text-blue-400" />
            <div className="text-lg font-bold text-t-text/90">{stats.documents}</div>
            <div className="text-[10px] text-t-text/40">Documents</div>
          </div>
          <div className="bg-t-overlay/[0.04] rounded-xl border border-t-overlay/10 p-3 text-center">
            <Hash className="w-5 h-5 mx-auto mb-1 text-purple-400" />
            <div className="text-lg font-bold text-t-text/90">{stats.chunks}</div>
            <div className="text-[10px] text-t-text/40">Chunks</div>
          </div>
          <div className="bg-t-overlay/[0.04] rounded-xl border border-t-overlay/10 p-3 text-center">
            <HardDrive className="w-5 h-5 mx-auto mb-1 text-green-400" />
            <div className="text-lg font-bold text-t-text/90">{(stats.totalTokens / 1000).toFixed(1)}k</div>
            <div className="text-[10px] text-t-text/40">Tokens</div>
          </div>
        </div>
      )}

      {/* Upload Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`cursor-pointer border-2 border-dashed rounded-xl p-6 text-center transition-all ${
          isDragOver
            ? 'border-blue-400 bg-blue-500/10'
            : 'border-t-overlay/15 hover:border-blue-400/40 hover:bg-t-overlay/[0.03]'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.txt,.md,.csv,.json"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) handleUpload(e.target.files);
            e.target.value = '';
          }}
        />
        {isUploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            <p className="text-sm text-t-text/60">Traitement en cours…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="w-8 h-8 text-t-text/30" />
            <p className="text-sm text-t-text/60">
              Glissez vos fichiers ici ou <span className="text-blue-400 underline">parcourir</span>
            </p>
            <p className="text-[10px] text-t-text/30">PDF, DOCX, TXT, MD, CSV, JSON — 20 Mo max</p>
          </div>
        )}
      </div>

      {uploadError && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {uploadError}
        </div>
      )}

      {/* Document List */}
      {documents.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-t-text/60 mb-2">Documents ({documents.length})</h4>
          <div className="space-y-2">
            {documents.map((doc) => {
              const Icon = MIME_ICONS[doc.mimeType] || FileText;
              return (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-t-overlay/[0.04] border border-t-overlay/10"
                >
                  <Icon className="w-5 h-5 text-t-text/40 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-t-text/80 truncate">{doc.filename}</span>
                      {statusBadge(doc.status)}
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-t-text/35 mt-0.5">
                      <span>{formatBytes(doc.fileSize)}</span>
                      {doc.chunkCount > 0 && <span>{doc.chunkCount} chunks</span>}
                      <span>{new Date(doc.createdAt).toLocaleDateString('fr-FR')}</span>
                    </div>
                    {doc.errorMessage && (
                      <p className="text-[10px] text-red-400 mt-0.5 truncate">{doc.errorMessage}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="p-1.5 rounded-lg hover:bg-t-overlay/10 text-t-text/30 hover:text-red-400 transition-colors flex-shrink-0"
                    title="Supprimer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {documents.length === 0 && (
        <div className="text-center py-6 bg-t-overlay/[0.02] rounded-xl border border-dashed border-t-overlay/10">
          <BookOpen className="w-10 h-10 mx-auto mb-2 text-t-text/15" />
          <p className="text-sm text-t-text/30">Aucun document</p>
          <p className="text-xs text-t-text/20 mt-1">
            Uploadez des fichiers pour enrichir les réponses de votre agent avec du contexte pertinent.
          </p>
        </div>
      )}

      {/* Search Test */}
      {documents.some((d) => d.status === 'ready') && (
        <div>
          <h4 className="text-sm font-medium text-t-text/60 mb-2">
            <Search className="w-3.5 h-3.5 inline mr-1" />
            Tester la recherche
          </h4>
          <div className="flex gap-2">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1 bg-t-overlay/[0.04] text-t-text/90 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/30 border border-t-overlay/10"
              placeholder="Posez une question pour tester le RAG…"
            />
            <button
              onClick={handleSearch}
              disabled={isSearching || !searchQuery.trim()}
              className="btn-gradient px-3 py-2 rounded-lg text-sm disabled:opacity-50 flex items-center gap-1"
            >
              {isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              Chercher
            </button>
          </div>

          {searchResults && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-t-text/40">{searchResults.length} résultat(s)</span>
                <button
                  onClick={() => setSearchResults(null)}
                  className="text-xs text-t-text/30 hover:text-t-text/60"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              {searchResults.map((r) => (
                <div key={r.chunkId} className="p-3 rounded-lg bg-t-overlay/[0.04] border border-t-overlay/10">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-t-text/40">
                      {r.filename} {r.metadata?.page ? `• p.${r.metadata.page}` : ''}
                    </span>
                    <span className="text-[10px] font-mono text-blue-400">
                      score: {r.score.toFixed(3)}
                    </span>
                  </div>
                  <p className="text-xs text-t-text/70 line-clamp-3">{r.content}</p>
                </div>
              ))}
              {searchResults.length === 0 && (
                <p className="text-xs text-t-text/35 text-center py-3">Aucun résultat trouvé.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
