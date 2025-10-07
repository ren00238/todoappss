// app/page.js
"use client"
import { useState, useEffect } from 'react';
// 👈 パスを修正しました
import { supabase } from '../lib/supabaseClient'; 

const Home = () => {
  const [todos, setTodos] = useState([]);
  const [newTodo, setNewTodo] = useState('');
  const [loading, setLoading] = useState(true);

  // データの取得
  const fetchTodos = async () => {
    // ★ 'todos' はあなたのSupabaseテーブル名に合わせてください
    const { data, error } = await supabase
      .from('todos') 
      .select('*')
      .order('id', { ascending: true });

    if (error) console.error('Error fetching todos:', error.message);
    else setTodos(data);
    setLoading(false);
  };

  // タスクの追加
  const addTodo = async (e) => {
    e.preventDefault();
    if (!newTodo.trim()) return;

    // ★ 'todos' はあなたのSupabaseテーブル名に合わせてください
    const { data, error } = await supabase
      .from('todos') 
      .insert({ task: newTodo.trim() })
      .select();

    if (error) console.error('Error adding todo:', error.message);
    else {
      setTodos([...todos, ...data]);
      setNewTodo('');
    }
  };

  // タスクの完了（トグル）
  const toggleComplete = async (id, currentComplete) => {
    // ★ 'todos' はあなたのSupabaseテーブル名に合わせてください
    const { error } = await supabase
      .from('todos') 
      .update({ is_complete: !currentComplete })
      .eq('id', id);

    if (error) console.error('Error updating todo:', error.message);
    else {
      // ローカルの状態を更新
      setTodos(todos.map(todo => 
        todo.id === id ? { ...todo, is_complete: !currentComplete } : todo
      ));
    }
  };

  // タスクの削除
  const deleteTodo = async (id) => {
    // ★ 'todos' はあなたのSupabaseテーブル名に合わせてください
    const { error } = await supabase
      .from('todos') 
      .delete()
      .eq('id', id);

    if (error) console.error('Error deleting todo:', error.message);
    else {
      // ローカルの状態を更新
      setTodos(todos.filter(todo => todo.id !== id));
    }
  };

  useEffect(() => {
    // Supabaseに 'todos' テーブルが事前に作成されている必要があります
    fetchTodos();
  }, []);

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="max-w-xl mx-auto p-8 border border-gray-200 shadow-lg mt-10 rounded-lg">
      <h1 className="text-3xl font-bold mb-6 text-center">Supabase Todo App</h1>
      
      {/* タスク追加フォーム */}
      <form onSubmit={addTodo} className="flex mb-6">
        <input
          type="text"
          value={newTodo}
          onChange={(e) => setNewTodo(e.target.value)}
          placeholder="新しいタスクを入力"
          // Tailwind CSSを使用していることを前提としたスタイル
          className="flex-grow p-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          className="bg-blue-600 text-white p-2 rounded-r-md hover:bg-blue-700 transition-colors"
        >
          追加
        </button>
      </form>

      {/* タスクリスト */}
      <ul className="space-y-3">
        {todos.map((todo) => (
          <li
            key={todo.id}
            className={`flex items-center justify-between p-3 border rounded-md shadow-sm transition-all ${
              todo.is_complete ? 'bg-green-100 border-green-300' : 'bg-white border-gray-200'
            }`}
          >
            <div 
                className={`cursor-pointer flex-grow ${todo.is_complete ? 'line-through text-gray-500' : 'text-gray-800'}`}
                onClick={() => toggleComplete(todo.id, todo.is_complete)}
            >
              {todo.task}
            </div>
            <button
              onClick={() => deleteTodo(todo.id)}
              className="ml-4 bg-red-500 text-white p-1 rounded-full text-xs hover:bg-red-600 transition-colors w-6 h-6 flex items-center justify-center"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      
      {todos.length === 0 && !loading && (
          <p className="text-center text-gray-500 mt-8">タスクはありません。追加しましょう！</p>
      )}
    </div>
  );
};

export default Home;
