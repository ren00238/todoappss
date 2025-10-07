@'
'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function RiskDashboard() {
  const [tasks, setTasks] = useState([]);
  const [filteredTasks, setFilteredTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [filterPriority, setFilterPriority] = useState('全て');
  const [filterAssignee, setFilterAssignee] = useState('全て');
  const [searchTerm, setSearchTerm] = useState('');

  const calculateRiskScore = (task) => {
    let score = 0;
    const priorityScores = { '高': 30, '中': 20, '低': 10 };
    score += priorityScores[task.priority] || 0;
    score += (100 - (task.progress || 0)) * 0.3;
    if (task.due_date) {
      const daysUntilDeadline = Math.floor((new Date(task.due_date) - new Date()) / (1000 * 60 * 60 * 24));
      if (daysUntilDeadline < 0) score += 50;
      else if (daysUntilDeadline < 7) score += 30;
      else if (daysUntilDeadline < 14) score += 15;
    }
    if (task.past_delay_days) score += task.past_delay_days * 5;
    if (task.dependencies && task.dependencies !== 'なし') score += 10;
    return Math.round(score);
  };

  const getRiskLevel = (score) => {
    if (score >= 70) return { level: '高', color: 'bg-red-500', bgColor: 'bg-red-50' };
    if (score >= 50) return { level: '中', color: 'bg-yellow-500', bgColor: 'bg-yellow-50' };
    return { level: '低', color: 'bg-green-500', bgColor: 'bg-green-50' };
  };

  const getDaysUntilDeadline = (dueDate) => {
    if (!dueDate) return null;
    return Math.floor((new Date(dueDate) - new Date()) / (1000 * 60 * 60 * 24));
  };

  const fetchRiskData = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase.from('tasks').select('*');
      if (error) throw new Error(`Supabase error: ${error.message}`);
      if (!data || data.length === 0) {
        setError('データが見つかりません');
        setTasks([]);
        setFilteredTasks([]);
        setLastUpdated(new Date());
        return;
      }
      const tasksWithRisk = data.map(task => ({ ...task, riskScore: calculateRiskScore(task) }));
      const sortedTasks = tasksWithRisk.sort((a, b) => b.riskScore - a.riskScore);
      setTasks(sortedTasks);
      setFilteredTasks(sortedTasks);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err.message || 'データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let filtered = [...tasks];
    if (filterPriority !== '全て') filtered = filtered.filter(task => task.priority === filterPriority);
    if (filterAssignee !== '全て') filtered = filtered.filter(task => task.assignee === filterAssignee);
    if (searchTerm) filtered = filtered.filter(task => task.task_name.toLowerCase().includes(searchTerm.toLowerCase()));
    setFilteredTasks(filtered);
  }, [filterPriority, filterAssignee, searchTerm, tasks]);

  const getAssignees = () => [...new Set(tasks.map(task => task.assignee).filter(Boolean))];

  const getStats = () => {
    const highRisk = filteredTasks.filter(t => t.riskScore >= 70).length;
    const mediumRisk = filteredTasks.filter(t => t.riskScore >= 50 && t.riskScore < 70).length;
    const lowRisk = filteredTasks.filter(t => t.riskScore < 50).length;
    const avgProgress = filteredTasks.length > 0 ? Math.round(filteredTasks.reduce((sum, t) => sum + t.progress, 0) / filteredTasks.length) : 0;
    return { highRisk, mediumRisk, lowRisk, avgProgress, total: filteredTasks.length };
  };

  useEffect(() => { fetchRiskData(); }, []);

  const stats = getStats();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">タスクリスクダッシュボード</h1>
          <p className="text-gray-400">プロジェクトタスクのリスク状況を可視化</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="text-gray-400 text-sm mb-1">総タスク数</div>
            <div className="text-3xl font-bold">{stats.total}</div>
          </div>
          <div className="bg-red-900/30 rounded-lg p-4 border border-red-700">
            <div className="text-red-400 text-sm mb-1">高リスク</div>
            <div className="text-3xl font-bold text-red-500">{stats.highRisk}</div>
          </div>
          <div className="bg-yellow-900/30 rounded-lg p-4 border border-yellow-700">
            <div className="text-yellow-400 text-sm mb-1">中リスク</div>
            <div className="text-3xl font-bold text-yellow-500">{stats.mediumRisk}</div>
          </div>
          <div className="bg-green-900/30 rounded-lg p-4 border border-green-700">
            <div className="text-green-400 text-sm mb-1">低リスク</div>
            <div className="text-3xl font-bold text-green-500">{stats.lowRisk}</div>
          </div>
          <div className="bg-blue-900/30 rounded-lg p-4 border border-blue-700">
            <div className="text-blue-400 text-sm mb-1">平均進捗</div>
            <div className="text-3xl font-bold text-blue-500">{stats.avgProgress}%</div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 mb-6 border border-gray-700">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-[200px]">
              <input type="text" placeholder="タスク名で検索..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full px-4 py-2 bg-gray-700 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none text-white" />
            </div>
            <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} className="px-4 py-2 bg-gray-700 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none text-white">
              <option value="全て">全ての優先度</option>
              <option value="高">高優先度</option>
              <option value="中">中優先度</option>
              <option value="低">低優先度</option>
            </select>
            <select value={filterAssignee} onChange={(e) => setFilterAssignee(e.target.value)} className="px-4 py-2 bg-gray-700 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none text-white">
              <option value="全て">全ての担当者</option>
              {getAssignees().map(assignee => <option key={assignee} value={assignee}>{assignee}</option>)}
            </select>
            <button onClick={fetchRiskData} disabled={loading} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-all duration-200 disabled:opacity-50 flex items-center gap-2">
              <svg className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              更新
            </button>
          </div>
          {lastUpdated && <div className="text-sm text-gray-400 mt-2">最終更新: {lastUpdated.toLocaleTimeString('ja-JP')}</div>}
        </div>

        {loading && <div className="flex justify-center items-center py-20"><div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div></div>}
        {error && <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 mb-6"><p className="text-red-200">エラー: {error}</p></div>}

        {!loading && !error && filteredTasks.length > 0 && (
          <div className="space-y-4">
            {filteredTasks.map((task, index) => {
              const riskInfo = getRiskLevel(task.riskScore);
              const daysLeft = getDaysUntilDeadline(task.due_date);
              return (
                <div key={task.id} className={`${riskInfo.bgColor} border-l-4 ${riskInfo.color.replace('bg-', 'border-')} rounded-lg p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1`}>
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h2 className="text-2xl font-bold text-gray-800">{task.task_name}</h2>
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${riskInfo.color} text-white`}>リスク: {riskInfo.level}</span>
                      </div>
                      <div className="flex gap-4 text-sm text-gray-600">
                        {task.assignee && <span className="flex items-center gap-1"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>{task.assignee}</span>}
                        {task.due_date && <span className="flex items-center gap-1"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>期限: {new Date(task.due_date).toLocaleDateString('ja-JP')}{daysLeft !== null && <span className={`ml-1 ${daysLeft < 0 ? 'text-red-600 font-bold' : daysLeft < 7 ? 'text-yellow-600' : ''}`}>({daysLeft < 0 ? `${Math.abs(daysLeft)}日超過` : `残り${daysLeft}日`})</span>}</span>}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-gray-800">{task.riskScore}</div>
                      <div className="text-sm text-gray-600">リスクスコア</div>
                    </div>
                  </div>
                  <div className="mb-4"><div className="flex justify-between text-sm text-gray-600 mb-1"><span>リスクレベル</span><span>{task.riskScore}/100</span></div><div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden"><div className={`${riskInfo.color} h-3 rounded-full transition-all duration-1000 ease-out`} style={{ width: `${Math.min(task.riskScore, 100)}%` }}></div></div></div>
                  <div className="mb-4"><div className="flex justify-between text-sm text-gray-600 mb-1"><span>進捗状況</span><span>{task.progress}%</span></div><div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden"><div className="bg-blue-500 h-3 rounded-full transition-all duration-1000 ease-out" style={{ width: `${task.progress}%` }}></div></div></div>
                  <div className="grid grid-cols-2 gap-4 text-sm"><div><span className="text-gray-600">優先度: </span><span className="font-semibold text-gray-800">{task.priority}</span></div>{task.past_delay_days > 0 && <div><span className="text-gray-600">過去の遅延: </span><span className="font-semibold text-red-600">{task.past_delay_days}日</span></div>}<div className="col-span-2"><span className="text-gray-600">依存関係: </span><span className="font-semibold text-gray-800">{task.dependencies || 'なし'}</span></div><div className="col-span-2"><span className="text-gray-600">リスク要因: </span><span className="font-semibold text-gray-800">{task.risk_factors || 'なし'}</span></div></div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && !error && filteredTasks.length === 0 && (
          <div className="text-center py-20 text-gray-400"><svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg><p className="text-xl">{searchTerm || filterPriority !== '全て' || filterAssignee !== '全て' ? '条件に一致するタスクが見つかりません' : 'タスクが見つかりません'}</p></div>
        )}
      </div>
    </div>
  );
}
'@ | Set-Content -Path "src/app/risk-dashboard/page.js" -Encoding UTF8
