import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3, Activity, Zap, AlertTriangle, DollarSign, Clock,
  MessageSquare, Wrench, ArrowLeft, Download, Filter, RefreshCw,
  TrendingUp, Users
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  getGlobalAnalytics, getAgentAnalytics, getAgentLogs, exportAgentLogs,
  listAgents,
  type UserAnalytics, type AnalyticsSummary, type LogEntry, type Agent,
} from '../services/api';

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#6366f1', '#3b82f6', '#22c55e', '#f59e0b'];

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

export default function Analytics() {
  const navigate = useNavigate();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [globalData, setGlobalData] = useState<UserAnalytics | null>(null);
  const [agentData, setAgentData] = useState<(AnalyticsSummary & { agentName: string }) | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logFilter, setLogFilter] = useState<{ level: string; event: string }>({ level: '', event: '' });
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);
  const [tab, setTab] = useState<'overview' | 'logs'>('overview');

  const getDateRange = useCallback(() => {
    const end = new Date().toISOString().slice(0, 10);
    const days = dateRange === '7d' ? 7 : dateRange === '90d' ? 90 : 30;
    const start = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
    return { startDate: start, endDate: end };
  }, [dateRange]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { startDate, endDate } = getDateRange();
      const [agentsRes] = await Promise.all([listAgents()]);
      setAgents(agentsRes.agents);

      if (selectedAgent === 'all') {
        const data = await getGlobalAnalytics(startDate, endDate);
        setGlobalData(data);
        setAgentData(null);
      } else {
        const data = await getAgentAnalytics(selectedAgent, startDate, endDate);
        setAgentData(data);
        setGlobalData(null);
      }
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedAgent, getDateRange]);

  const fetchLogs = useCallback(async () => {
    if (selectedAgent === 'all') return;
    setLogsLoading(true);
    try {
      const { startDate, endDate } = getDateRange();
      const res = await getAgentLogs(selectedAgent, {
        level: logFilter.level || undefined,
        event: logFilter.event || undefined,
        startDate,
        endDate,
        limit: 100,
      });
      setLogs(res.logs);
      setLogsTotal(res.total);
    } catch (err) {
      console.error('Failed to load logs:', err);
    } finally {
      setLogsLoading(false);
    }
  }, [selectedAgent, logFilter, getDateRange]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { if (tab === 'logs' && selectedAgent !== 'all') fetchLogs(); }, [tab, fetchLogs, selectedAgent]);

  const handleExport = async () => {
    if (selectedAgent === 'all') return;
    try {
      const { startDate, endDate } = getDateRange();
      const blob = await exportAgentLogs(selectedAgent, { startDate, endDate });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `agent-${selectedAgent}-logs.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  const summary = selectedAgent === 'all' ? globalData : agentData;
  const dailyMetrics = summary?.dailyMetrics || [];

  return (
    <div className="min-h-screen bg-t-page">
      {/* Header */}
      <header className="bg-t-surface/80 backdrop-blur-lg border-b border-t-overlay/10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/dashboard')} className="text-t-text/50 hover:text-t-text/80 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <BarChart3 className="w-5 h-5 text-blue-500" />
            <h1 className="text-lg font-bold text-t-text hidden sm:block">Analytics</h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Date range */}
            <div className="flex rounded-lg border border-t-overlay/10 overflow-hidden">
              {(['7d', '30d', '90d'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setDateRange(r)}
                  className={`px-3 py-1.5 text-xs sm:text-sm ${
                    dateRange === r
                      ? 'bg-blue-600 text-white'
                      : 'bg-t-surface text-t-text/60 hover:bg-t-overlay/5'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            {/* Agent picker */}
            <select
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm border border-t-overlay/10 rounded-lg bg-t-surface text-t-text/80"
            >
              <option value="all">All Agents</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <button onClick={fetchData} className="p-2 text-t-text/40 hover:text-blue-500 transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-t-overlay/10">
          {['overview', 'logs'].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t as any)}
              className={`px-4 py-2 text-sm font-medium capitalize ${
                tab === t
                  ? 'text-blue-500 border-b-2 border-blue-500'
                  : 'text-t-text/40 hover:text-t-text/70'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : tab === 'overview' ? (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <KPICard icon={<MessageSquare className="w-5 h-5" />} label="Messages" value={formatNumber(summary?.totalMessages || 0)} color="blue" />
              <KPICard icon={<Users className="w-5 h-5" />} label="Conversations" value={formatNumber(summary?.totalConversations || 0)} color="green" />
              <KPICard icon={<Zap className="w-5 h-5" />} label="Tokens" value={formatNumber(summary?.totalTokens || 0)} color="amber" />
              <KPICard icon={<Clock className="w-5 h-5" />} label="Avg Response" value={`${summary?.avgResponseMs || 0}ms`} color="indigo" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <KPICard icon={<Wrench className="w-5 h-5" />} label="Tool Calls" value={formatNumber(summary?.totalToolCalls || 0)} color="blue" />
              <KPICard icon={<AlertTriangle className="w-5 h-5" />} label="Errors" value={formatNumber(summary?.totalErrors || 0)} color="red" />
              <KPICard icon={<DollarSign className="w-5 h-5" />} label="Est. Cost" value={`$${(summary?.estimatedCost || 0).toFixed(4)}`} color="green" />
              <KPICard icon={<TrendingUp className="w-5 h-5" />} label="Agents" value={String(agents.length)} color="indigo" />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Messages over time */}
              <div className="glass-card rounded-xl p-4 sm:p-6">
                <h3 className="text-sm font-semibold text-t-text/60 mb-4">Messages Over Time</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={dailyMetrics}>
                    <defs>
                      <linearGradient id="colorMsgs" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Area type="monotone" dataKey="messages" stroke="#3b82f6" fillOpacity={1} fill="url(#colorMsgs)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Tokens & Cost */}
              <div className="glass-card rounded-xl p-4 sm:p-6">
                <h3 className="text-sm font-semibold text-t-text/60 mb-4">Tokens Used</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={dailyMetrics}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="tokensUsed" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Tool calls & Errors */}
              <div className="glass-card rounded-xl p-4 sm:p-6">
                <h3 className="text-sm font-semibold text-t-text/60 mb-4">Tool Calls & Errors</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={dailyMetrics}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="toolCalls" fill="#6366f1" radius={[4, 4, 0, 0]} name="Tool Calls" />
                    <Bar dataKey="errorCount" fill="#ef4444" radius={[4, 4, 0, 0]} name="Errors" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Agent breakdown (global only) */}
              {globalData && globalData.agentBreakdown.length > 0 && (
                <div className="glass-card rounded-xl p-4 sm:p-6">
                  <h3 className="text-sm font-semibold text-t-text/60 mb-4">Messages by Agent</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={globalData.agentBreakdown}
                        dataKey="messages"
                        nameKey="agentName"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={({ name, percent }: any) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                      >
                        {globalData.agentBreakdown.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Response time chart */}
              <div className="glass-card rounded-xl p-4 sm:p-6">
                <h3 className="text-sm font-semibold text-t-text/60 mb-4">Avg Response Time (ms)</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={dailyMetrics}>
                    <defs>
                      <linearGradient id="colorResp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Area type="monotone" dataKey="avgResponseMs" stroke="#f59e0b" fillOpacity={1} fill="url(#colorResp)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        ) : (
          /* ============ LOGS TAB ============ */
          <div>
            {selectedAgent === 'all' ? (
              <div className="text-center py-12 text-t-text/40">
                <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Select a specific agent to view logs</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Filter className="w-4 h-4 text-t-text/30" />
                    <select
                      value={logFilter.level}
                      onChange={(e) => setLogFilter(prev => ({ ...prev, level: e.target.value }))}
                      className="px-2 py-1 text-sm border border-t-overlay/10 rounded bg-t-surface text-t-text/80"
                    >
                      <option value="">All Levels</option>
                      <option value="info">Info</option>
                      <option value="warn">Warning</option>
                      <option value="error">Error</option>
                      <option value="debug">Debug</option>
                    </select>
                    <select
                      value={logFilter.event}
                      onChange={(e) => setLogFilter(prev => ({ ...prev, event: e.target.value }))}
                      className="px-2 py-1 text-sm border border-t-overlay/10 rounded bg-t-surface text-t-text/80"
                    >
                      <option value="">All Events</option>
                      <option value="chat">Chat</option>
                      <option value="tool_call">Tool Call</option>
                      <option value="tool_error">Tool Error</option>
                      <option value="error">Error</option>
                    </select>
                    <span className="text-sm text-t-text/40">{logsTotal} total</span>
                  </div>
                  <button
                    onClick={handleExport}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-t-surface border border-t-overlay/10 rounded-lg hover:bg-t-overlay/5 text-t-text/70"
                  >
                    <Download className="w-4 h-4" />
                    Export CSV
                  </button>
                </div>

                {logsLoading ? (
                  <div className="flex justify-center py-10">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                  </div>
                ) : logs.length === 0 ? (
                  <div className="text-center py-12 text-t-text/40">
                    <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No logs found for this period</p>
                  </div>
                ) : (
                  <div className="glass-card rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-t-overlay/5">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-t-text/40 uppercase">Time</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-t-text/40 uppercase">Level</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-t-text/40 uppercase">Event</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-t-text/40 uppercase">Message</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-t-text/40 uppercase">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-t-overlay/5">
                        {logs.map((log) => (
                          <tr key={log.id} className="hover:bg-t-overlay/3">
                            <td className="px-4 py-2 text-xs text-t-text/40 whitespace-nowrap">
                              {new Date(log.createdAt).toLocaleString()}
                            </td>
                            <td className="px-4 py-2">
                              <LevelBadge level={log.level} />
                            </td>
                            <td className="px-4 py-2 text-t-text/70 font-mono text-xs">
                              {log.event}
                            </td>
                            <td className="px-4 py-2 text-t-text/70 max-w-xs truncate">
                              {log.message}
                            </td>
                            <td className="px-4 py-2 text-xs text-t-text/40">
                              {log.metadata && (
                                <span className="font-mono">
                                  {(log.metadata as any).responseMs && `${(log.metadata as any).responseMs}ms`}
                                  {(log.metadata as any).toolName && ` | ${(log.metadata as any).toolName}`}
                                  {(log.metadata as any).tokensPrompt != null &&
                                    ` | ${(log.metadata as any).tokensPrompt}+${(log.metadata as any).tokensCompletion} tok`}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

// ----------------------------------------------------------
// Sub-components
// ----------------------------------------------------------

function KPICard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  const bgMap: Record<string, string> = {
    blue: 'bg-blue-500/10 text-blue-500',
    green: 'bg-green-500/10 text-green-500',
    amber: 'bg-amber-500/10 text-amber-500',
    indigo: 'bg-indigo-500/10 text-indigo-500',
    red: 'bg-red-500/10 text-red-500',
  };

  return (
    <div className="glass-card rounded-xl p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${bgMap[color] || bgMap.blue}`}>{icon}</div>
        <div>
          <p className="text-xs text-t-text/40">{label}</p>
          <p className="text-lg font-bold text-t-text">{value}</p>
        </div>
      </div>
    </div>
  );
}

function LevelBadge({ level }: { level: string }) {
  const styles: Record<string, string> = {
    info: 'bg-blue-500/15 text-blue-400',
    warn: 'bg-amber-500/15 text-amber-400',
    error: 'bg-red-500/15 text-red-400',
    debug: 'bg-t-overlay/10 text-t-text/50',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles[level] || styles.info}`}>
      {level}
    </span>
  );
}
