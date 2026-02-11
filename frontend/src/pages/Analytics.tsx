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

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/dashboard')} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-blue-600" />
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Analytics</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Date range */}
            <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
              {(['7d', '30d', '90d'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setDateRange(r)}
                  className={`px-3 py-1.5 text-sm ${
                    dateRange === r
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
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
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200"
            >
              <option value="all">All Agents</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <button onClick={fetchData} className="p-2 text-gray-500 hover:text-blue-600">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-700">
          {['overview', 'logs'].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t as any)}
              className={`px-4 py-2 text-sm font-medium capitalize ${
                tab === t
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
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
              <KPICard icon={<Zap className="w-5 h-5" />} label="Tokens" value={formatNumber(summary?.totalTokens || 0)} color="yellow" />
              <KPICard icon={<Clock className="w-5 h-5" />} label="Avg Response" value={`${summary?.avgResponseMs || 0}ms`} color="purple" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <KPICard icon={<Wrench className="w-5 h-5" />} label="Tool Calls" value={formatNumber(summary?.totalToolCalls || 0)} color="cyan" />
              <KPICard icon={<AlertTriangle className="w-5 h-5" />} label="Errors" value={formatNumber(summary?.totalErrors || 0)} color="red" />
              <KPICard icon={<DollarSign className="w-5 h-5" />} label="Est. Cost" value={`$${(summary?.estimatedCost || 0).toFixed(4)}`} color="emerald" />
              <KPICard icon={<TrendingUp className="w-5 h-5" />} label="Agents" value={String(agents.length)} color="indigo" />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Messages over time */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Messages Over Time</h3>
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
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Tokens Used</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={dailyMetrics}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="tokensUsed" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Tool calls & Errors */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Tool Calls & Errors</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={dailyMetrics}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="toolCalls" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Tool Calls" />
                    <Bar dataKey="errorCount" fill="#ef4444" radius={[4, 4, 0, 0]} name="Errors" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Agent breakdown (global only) */}
              {globalData && globalData.agentBreakdown.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Messages by Agent</h3>
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
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Avg Response Time (ms)</h3>
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
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Select a specific agent to view logs</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Filter className="w-4 h-4 text-gray-400" />
                    <select
                      value={logFilter.level}
                      onChange={(e) => setLogFilter(prev => ({ ...prev, level: e.target.value }))}
                      className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200"
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
                      className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200"
                    >
                      <option value="">All Events</option>
                      <option value="chat">Chat</option>
                      <option value="tool_call">Tool Call</option>
                      <option value="tool_error">Tool Error</option>
                      <option value="error">Error</option>
                    </select>
                    <span className="text-sm text-gray-500 dark:text-gray-400">{logsTotal} total</span>
                  </div>
                  <button
                    onClick={handleExport}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
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
                  <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No logs found for this period</p>
                  </div>
                ) : (
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Time</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Level</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Event</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Message</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {logs.map((log) => (
                          <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                            <td className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                              {new Date(log.createdAt).toLocaleString()}
                            </td>
                            <td className="px-4 py-2">
                              <LevelBadge level={log.level} />
                            </td>
                            <td className="px-4 py-2 text-gray-700 dark:text-gray-300 font-mono text-xs">
                              {log.event}
                            </td>
                            <td className="px-4 py-2 text-gray-700 dark:text-gray-300 max-w-xs truncate">
                              {log.message}
                            </td>
                            <td className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400">
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
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-600',
    yellow: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600',
    purple: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600',
    red: 'bg-red-50 dark:bg-red-900/20 text-red-600',
    cyan: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600',
    emerald: 'bg-green-50 dark:bg-green-900/20 text-green-600',
    indigo: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600',
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${bgMap[color] || bgMap.blue}`}>{icon}</div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">{value}</p>
        </div>
      </div>
    </div>
  );
}

function LevelBadge({ level }: { level: string }) {
  const styles: Record<string, string> = {
    info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    warn: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    error: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    debug: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles[level] || styles.info}`}>
      {level}
    </span>
  );
}
