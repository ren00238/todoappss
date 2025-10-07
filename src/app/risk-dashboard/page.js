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
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [showCharts, setShowCharts] = useState(false);
  const [formData, setFormData] = useState({
    task_name: '',
    assignee: '',
    due_date: '',
    past_delay_days: 0,
    priority: '中',
    progress: 0,
    dependencies: 'なし',
    risk_factors: ''
  });

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

  const handleAddTask = async (e) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('tasks').insert([formData]);
      if (error) throw error;
      setShowAddModal(false);
      resetForm();
      fetchRiskData();
    } catch (err) {
      alert('タスクの追加に失敗しました: ' + err.message);
    }
  };

  const handleEditTask = async (e) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('tasks').update(formData).eq('id', editingTask.id);
      if (error) throw error;
      setShowEditModal(false);
      setEditingTask(null);
      resetForm();
      fetchRiskData();
    } catch (err) {
      alert('タスクの更新に失敗しました: ' + err.message);
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!confirm('このタスクを削除しますか？')) return;
    try {
      const { error } = await supabase.from('tasks').delete().eq('id', taskId);
      if (error) throw error;
      fetchRiskData();
    } catch (err) {
      alert('タスクの削除に失敗しました: ' + err.message);
    }
  };

  const resetForm = () => {
    setFormData({
      task_name: '',
      assignee: '',
      due_date: '',
      past_delay_days: 0,
      priority: '中',
      progress: 0,
      dependencies: 'なし',
      risk_factors: ''
    });
  };

  const openEditModal = (task) => {
    setEditingTask(task);
    setFormData({
      task_name: task.task_name,
      assignee: task.assignee || '',
      due_date: task.due_date || '',
      past_delay_days: task.past_delay_days || 0,
      priority: task.priority || '中',
      progress: task.progress || 0,
      dependencies: task.dependencies || 'なし',
      risk_factors: task.risk_factors || ''
    });
    setShowEditModal(true);
  };

  const getStats = () => {
    const highRisk = filteredTasks.filter(t => t.riskScore >= 70).length;
    const mediumRisk = filteredTasks.filter(t => t.riskScore >= 50 && t.riskScore < 70).length;
    const lowRisk = filteredTasks.filter(t => t.riskScore < 50).length;
    const avgProgress = filteredTasks.length > 0 ? Math.round(filteredTasks.reduce((sum, t) => sum + t.progress, 0) / filteredTasks.length) : 0;
    return { highRisk, mediumRisk, lowRisk, avgProgress, total: filteredTasks.length };
  };

  const getPriorityData = () => {
    const high = tasks.filter(t => t.priority === '高').length;
    const medium = tasks.filter(t => t.priority === '中').length;
    const low = tasks.filter(t => t.priority === '低').length;
    return { high, medium, low };
  };

  const getProgressData = () => {
    const ranges = [
      { label: '0-25%', count: tasks.filter(t => t.progress >= 0 && t.progress < 25).length },
      { label: '25-50%', count: tasks.filter(t => t.progress >= 25 && t.progress < 50).length },
      { label: '50-75%', count: tasks.filter(t => t.progress >= 75 && t.progress < 75).length },
      { label: '75-100%', count: tasks.filter(t => t.progress >= 75 && t.progress <= 100).length }
    ];
    return ranges;
  };

  useEffect(() => { fetchRiskData(); }, []);

  const stats = getStats();
  const priorityData = getPriorityData();
  const progressData = getProgressData();

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
            <button onClick={() => setShowCharts(!showCharts)} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold transition-all duration-200 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              {showCharts ? 'グラフを隠す' : 'グラフを表示'}
            </button>
            <button onClick={fetchRiskData} disabled={loading} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-all duration-200 disabled:opacity-50 flex items-center gap-2">
              <svg className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              更新
            </button>
            <button onClick={() => setShowAddModal(true)} className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-semibold transition-all duration-200 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              タスク追加
            </button>
          </div>
          {lastUpdated && <div className="text-sm text-gray-400 mt-2">最終更新: {lastUpdated.toLocaleTimeString('ja-JP')}</div>}
        </div>

        {showCharts && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h3 className="text-xl font-bold mb-4">優先度別タスク数</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>高優先度</span>
                    <span>{priorityData.high}件</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-4">
                    <div className="bg-red-500 h-4 rounded-full transition-all duration-500" style={{ width: `${(priorityData.high / tasks.length) * 100}%` }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>中優先度</span>
                    <span>{priorityData.medium}件</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-4">
                    <div className="bg-yellow-500 h-4 rounded-full transition-all duration-500" style={{ width: `${(priorityData.medium / tasks.length) * 100}%` }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>低優先度</span>
                    <span>{priorityData.low}件</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-4">
                    <div className="bg-green-500 h-4 rounded-full transition-all duration-500" style={{ width: `${(priorityData.low / tasks.length) * 100}%` }}></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h3 className="text-xl font-bold mb-4">進捗状況分布</h3>
              <div className="space-y-4">
                {progressData.map((range, index) => (
                  <div key={index}>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{range.label}</span>
                      <span>{range.count}件</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-4">
                      <div className="bg-blue-500 h-4 rounded-full transition-all duration-500" style={{ width: `${(range.count / tasks.length) * 100}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

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
                    <div className="flex items-start gap-2">
                      <div className="text-right mr-4">
                        <div className="text-3xl font-bold text-gray-800">{task.riskScore}</div>
                        <div className="text-sm text-gray-600">リスクスコア</div>
                      </div>
                      <button onClick={() => openEditModal(task)} className="p-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors" title="編集">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </button>
                      <button onClick={() => handleDeleteTask(task.id)} className="p-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors" title="削除">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
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

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">新しいタスクを追加</h2>
            <form onSubmit={handleAddTask} className="space-y-4">
              <div><label className="block text-sm font-medium mb-1">タスク名 *</label><input type="text" required value={formData.task_name} onChange={(e) => setFormData({...formData, task_name: e.target.value})} className="w-full px-4 py-2 bg-gray-700 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none text-white" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-1">担当者</label><input type="text" value={formData.assignee} onChange={(e) => setFormData({...formData, assignee: e.target.value})} className="w-full px-4 py-2 bg-gray-700 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none text-white" /></div>
                <div><label className="block text-sm font-medium mb-1">期限</label><input type="date" value={formData.due_date} onChange={(e) => setFormData({...formData, due_date: e.target.value})} className="w-full px-4 py-2 bg-gray-700 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none text-white" /></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div><label className="block text-sm font-medium mb-1">優先度</label><select value={formData.priority} onChange={(e) => setFormData({...formData, priority: e.target.value})} className="w-full px-4 py-2 bg-gray-700 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none text-white"><option value="高">高</option><option value="中">中</option><option value="低">低</option></select></div>
                <div><label className="block text-sm font-medium mb-1">進捗 (%)</label><input type="number" min="0" max="100" value={formData.progress} onChange={(e) => setFormData({...formData, progress: parseInt(e.target.value) || 0})} className="w-full px-4 py-2 bg-gray-700 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none text-white" /></div>
                <div><label className="block text-sm font-medium mb-1">過去の遅延 (日)</label><input type="number" min="0" value={formData.past_delay_days} onChange={(e) => setFormData({...formData, past_delay_days: parseInt(e.target.value) || 0})} className="w-full px-4 py-2 bg-gray-700 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none text-white" /></div>
              </div>
              <div><label className="block text-sm font-medium mb-1">依存関係</label><input type="text" value={formData.dependencies} onChange={(e) => setFormData({...formData, dependencies: e.target.value})} className="w-full px-4 py-2 bg-gray-700 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none text-white" placeholder="なし" /></div>
              <div><label className="block text-sm font-medium mb-1">リスク要因</label><textarea value={formData.risk_factors} onChange={(e) => setFormData({...formData, risk_factors: e.target.value})} className="w-full px-4 py-2 bg-gray-700 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none text-white" rows="3" /></div>
              <div className="flex gap-4 pt-4">
                <button type="submit" className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-semibold transition-colors">追加</button>
                <button type="button" onClick={() => { setShowAddModal(false); resetForm(); }} className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg font-semibold transition-colors">キャンセル</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">タスクを編集</h2>
            <form onSubmit={handleEditTask} className="space-y-4">
              <div><label className="block text-sm font-medium mb-1">タスク名 *</label><input type="text" required value={formData.task_name} onChange={(e) => setFormData({...formData, task_name: e.target.value})} className="w-full px-4 py-2 bg-gray-700 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none text-white" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-1">担当者</label><input type="text" value={formData.assignee} onChange={(e) => setFormData({...formData, assignee: e.target.value})} className="w-full px-4 py-2 bg-gray-700 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none text-white" /></div>
                <div><label className="block text-sm font-medium mb-1">期限</label><input type="date" value={formData.due_date} onChange={(e) => setFormData({...formData, due_date: e.target.value})} className="w-full px-4 py-2 bg-gray-700 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none text-white" /></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div><label className="block text-sm font-medium mb-1">優先度</label><select value={formData.priority} onChange={(e) => setFormData({...formData, priority: e.target.value})} className="w-full px-4 py-2 bg-gray-700 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none text-white"><option value="高">高</option><option value="中">中</option><option value="低">低</option></select></div>
                <div><label className="block text-sm font-medium mb-1">進捗 (%)</label><input type="number" min="0" max="100" value={formData.progress} onChange={(e) => setFormData({...formData, progress: parseInt(e.target.value) || 0})} className="w-full px-4 py-2 bg-gray-700 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none text-white" /></div>
                <div><label className="block text-sm font-medium mb-1">過去の遅延 (日)</label><input type="number" min="0" value={formData.past_delay_days} onChange={(e) => setFormData({...formData, past_delay_days: parseInt(e.target.value) || 0})} className="w-full px-4 py-2 bg-gray-700 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none text-white" /></div>
              </div>
              <div><label className="block text-sm font-medium mb-1">依存関係</label><input type="text" value={formData.dependencies} onChange={(e) => setFormData({...formData, dependencies: e.target.value})} className="w-full px-4 py-2 bg-gray-700 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none text-white" placeholder="なし" /></div>
              <div><label className="block text-sm font-medium mb-1">リスク要因</label><textarea value={formData.risk_factors} onChange={(e) => setFormData({...formData, risk_factors: e.target.value})} className="w-full px-4 py-2 bg-gray-700 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none text-white" rows="3" /></div>
              <div className="flex gap-4 pt-4">
                <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors">更新</button>
                <button type="button" onClick={() => { setShowEditModal(false); setEditingTask(null); resetForm(); }} className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg font-semibold transition-colors">キャンセル</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
