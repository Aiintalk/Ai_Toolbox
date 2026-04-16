'use client';

import { useState, useRef, useEffect } from 'react';

type Step = 'input' | 'result';
type Tab = 'profile' | 'plan';

interface HistoryItem {
  id: string;
  createdAt: number;
  nickname: string;
  accountName: string;
  totalVideos: number;
}

const BASE = '/benchmark-analyzer';

export default function Home() {
  // 输入状态
  const [accountUrl, setAccountUrl] = useState('');
  const [top10Content, setTop10Content] = useState('');
  const [recent30Content, setRecent30Content] = useState('');
  const [accountName, setAccountName] = useState('');
  const [nickname, setNickname] = useState('');
  const [secUserId, setSecUserId] = useState('');
  const [totalVideos, setTotalVideos] = useState(0);

  // 抓取状态
  const [fetching, setFetching] = useState(false);
  const [fetchResult, setFetchResult] = useState<{ total: number; top10: number; recent30: number } | null>(null);
  const [fetchError, setFetchError] = useState('');

  // 分析状态
  const [step, setStep] = useState<Step>('input');
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [profileResult, setProfileResult] = useState('');
  const [planResult, setPlanResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // 历史记录
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`${BASE}/api/history`);
      const data = await res.json();
      if (Array.isArray(data.items)) setHistory(data.items);
    } catch {
      // 静默失败
    } finally {
      setHistoryLoading(false);
    }
  };

  // 自动抓取
  const handleFetch = async () => {
    if (!accountUrl.trim()) return;
    setFetching(true);
    setFetchError('');
    setFetchResult(null);

    try {
      const res = await fetch(`${BASE}/api/fetch-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: accountUrl }),
      });
      const data = await res.json();

      if (!res.ok) {
        setFetchError(data.error || '抓取失败');
        return;
      }

      setTop10Content(data.top10Text);
      setRecent30Content(data.recent30Text);
      if (data.nickname) {
        setAccountName(data.nickname);
        setNickname(data.nickname);
      }
      if (data.secUserId) setSecUserId(data.secUserId);
      setTotalVideos(data.totalVideos || 0);
      setFetchResult({
        total: data.totalVideos,
        top10: data.top10Count,
        recent30: data.recent30Count,
      });
    } catch {
      setFetchError('网络错误，请重试');
    } finally {
      setFetching(false);
    }
  };

  // AI 分析
  const handleAnalyze = async () => {
    if (!top10Content.trim() && !recent30Content.trim()) {
      alert('请至少填写一组内容数据');
      return;
    }

    setLoading(true);
    setProfileResult('');
    setPlanResult('');
    setStep('result');
    setActiveTab('profile');
    abortRef.current = new AbortController();

    let finalProfile = '';
    let finalPlan = '';

    try {
      const res = await fetch(`${BASE}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountName, top10Content, recent30Content }),
        signal: abortRef.current.signal,
      });

      const reader = res.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
        const parts = fullText.split('===SPLIT===');
        finalProfile = parts[0].trim();
        setProfileResult(finalProfile);
        if (parts.length > 1) {
          finalPlan = parts[1].trim();
          setPlanResult(finalPlan);
        }
      }

      // 分析完成后自动保存
      if (finalProfile || finalPlan) {
        try {
          await fetch(`${BASE}/api/history`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              nickname: nickname || accountName || '未命名',
              secUserId,
              accountName,
              totalVideos,
              top10Text: top10Content,
              recent30Text: recent30Content,
              profileResult: finalProfile,
              planResult: finalPlan,
            }),
          });
          loadHistory();
        } catch {
          // 静默失败，不影响结果展示
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        alert('分析出错，请重试');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLoadHistory = async (id: string) => {
    try {
      const res = await fetch(`${BASE}/api/history/${id}`);
      if (!res.ok) {
        alert('加载失败');
        return;
      }
      const data = await res.json();
      setNickname(data.nickname || '');
      setAccountName(data.accountName || '');
      setSecUserId(data.secUserId || '');
      setTotalVideos(data.totalVideos || 0);
      setTop10Content(data.top10Text || '');
      setRecent30Content(data.recent30Text || '');
      setProfileResult(data.profileResult || '');
      setPlanResult(data.planResult || '');
      setStep('result');
      setActiveTab('profile');
    } catch {
      alert('加载失败');
    }
  };

  const handleReset = () => {
    abortRef.current?.abort();
    setStep('input');
    setProfileResult('');
    setPlanResult('');
    setLoading(false);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleExportWord = async (type: 'profile' | 'plan') => {
    const content = type === 'profile' ? profileResult : planResult;
    if (!content) return;
    setExporting(true);
    try {
      const res = await fetch(`${BASE}/api/export-word`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: nickname || accountName || '对标账号',
          profileResult,
          planResult,
          type,
        }),
      });
      if (!res.ok) {
        alert('导出失败');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().slice(0, 10);
      const label = type === 'profile' ? '人格档案' : '内容规划';
      a.download = `${label}_${nickname || accountName || '账号'}_${dateStr}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert('导出失败');
    } finally {
      setExporting(false);
    }
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day} ${hh}:${mm}`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="text-gray-400 hover:text-gray-600 transition-colors" title="返回首页">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
              </svg>
            </a>
            <div>
              <h1 className="text-xl font-bold text-gray-900">对标分析助手</h1>
              <p className="text-sm text-gray-500 mt-1">系统化拆解对标账号，输出人格档案与内容规划</p>
            </div>
          </div>
          {step === 'result' && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleExportWord('profile')}
                disabled={exporting || !profileResult || loading}
                className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                导出人格档案
              </button>
              <button
                onClick={() => handleExportWord('plan')}
                disabled={exporting || !planResult || loading}
                className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                导出内容规划
              </button>
              <button onClick={handleReset} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100">
                ← 返回
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {step === 'input' ? (
          <div className="space-y-6">
            {/* 历史记录 */}
            {history.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold text-gray-900">已分析的对标账号</h2>
                  <span className="text-xs text-gray-400">共 {history.length} 个账号</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {history.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleLoadHistory(item.id)}
                      className="text-left p-4 border border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50/40 transition"
                    >
                      <div className="text-sm font-medium text-gray-900 truncate">{item.nickname || item.accountName || '未命名'}</div>
                      <div className="text-xs text-gray-400 mt-1.5">{item.totalVideos} 条作品</div>
                      <div className="text-xs text-gray-400 mt-0.5">{formatDate(item.createdAt)}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {historyLoading && history.length === 0 && (
              <div className="text-center text-xs text-gray-400 py-2">加载历史记录...</div>
            )}

            {/* 第一步：获取数据 */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-1">第一步：获取对标账号数据</h2>
              <p className="text-xs text-gray-500 mb-5">选择任意方式导入数据</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 方式一：抖音链接 */}
                <div className="border border-gray-200 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">方式一：抖音号 / 链接</h3>
                  <p className="text-xs text-gray-500 mb-4">输入抖音号或主页分享链接，自动抓取全部作品</p>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={accountUrl}
                      onChange={(e) => setAccountUrl(e.target.value)}
                      placeholder="输入抖音号（如 DNX833）或粘贴主页链接..."
                      className="flex-1 px-3 py-2.5 rounded-lg border border-gray-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none text-sm"
                    />
                    <button
                      onClick={handleFetch}
                      disabled={fetching || !accountUrl.trim()}
                      className="px-5 py-2.5 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      {fetching ? '抓取中...' : '解析'}
                    </button>
                  </div>

                  {fetchError && (
                    <p className="text-xs text-red-500 mt-3">{fetchError}</p>
                  )}
                  {fetchResult && (
                    <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-xs text-green-700 font-medium">
                        抓取成功！共 {fetchResult.total} 条作品，TOP10 已选出 {fetchResult.top10} 条，最近30天 {fetchResult.recent30} 条
                      </p>
                    </div>
                  )}
                </div>

                {/* 方式二：手动粘贴 */}
                <div className="border border-gray-200 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">方式二：直接粘贴文案</h3>
                  <p className="text-xs text-gray-500 mb-4">
                    用 <a href="https://www.aihao.co" target="_blank" className="text-blue-500 underline">AI好记</a> 等工具转好文案后粘贴到下方
                  </p>
                  <div className="flex items-center justify-center h-20 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                    <p className="text-xs text-gray-400">直接在下方文本框中编辑</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 账号名称 */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">账号名称（可选）</h3>
              <input
                type="text"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="输入对标账号名称（如：40岁的陶然·悠然生活）"
                className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none text-sm"
              />
            </div>

            {/* 数据一：TOP10 */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">数据一：全账号点赞 TOP10</h3>
                  <p className="text-xs text-gray-500 mt-1">整个账号按点赞量排序最高的10条视频文案</p>
                </div>
                {top10Content && <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">已填充</span>}
              </div>
              <textarea
                value={top10Content}
                onChange={(e) => setTop10Content(e.target.value)}
                placeholder="自动抓取后会自动填充，也可以手动粘贴..."
                className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none text-sm resize-none"
                rows={8}
              />
              {top10Content && <p className="text-xs text-gray-400 mt-2">已输入 {top10Content.length} 字</p>}
            </div>

            {/* 数据二：最近30天 */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">数据二：最近30天全部内容</h3>
                  <p className="text-xs text-gray-500 mt-1">最近一个月内发布的所有视频文案</p>
                </div>
                {recent30Content && <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">已填充</span>}
              </div>
              <textarea
                value={recent30Content}
                onChange={(e) => setRecent30Content(e.target.value)}
                placeholder="自动抓取后会自动填充，也可以手动粘贴..."
                className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none text-sm resize-none"
                rows={8}
              />
              {recent30Content && <p className="text-xs text-gray-400 mt-2">已输入 {recent30Content.length} 字</p>}
            </div>

            {/* 开始分析 */}
            <button
              onClick={handleAnalyze}
              disabled={!top10Content.trim() && !recent30Content.trim()}
              className="w-full py-3.5 bg-green-600 text-white font-medium rounded-xl hover:bg-green-700 transition disabled:opacity-40 disabled:cursor-not-allowed text-sm"
            >
              开始分析
            </button>
          </div>
        ) : (
          /* ====== 结果页 ====== */
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex border-b border-gray-200">
                <button
                  onClick={() => setActiveTab('profile')}
                  className={`flex-1 py-3.5 text-sm font-medium transition ${
                    activeTab === 'profile'
                      ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  人格档案
                </button>
                <button
                  onClick={() => setActiveTab('plan')}
                  className={`flex-1 py-3.5 text-sm font-medium transition ${
                    activeTab === 'plan'
                      ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  内容规划
                </button>
              </div>

              <div className="p-6">
                {loading && !profileResult && !planResult ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="text-center">
                      <div className="inline-block w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
                      <p className="text-sm text-gray-500">正在分析账号内容，预计1-2分钟...</p>
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="prose prose-sm max-w-none whitespace-pre-wrap text-gray-800 leading-relaxed">
                      {activeTab === 'profile' ? (
                        profileResult || <span className="text-gray-400">等待生成...</span>
                      ) : (
                        planResult || (loading ? <span className="text-gray-400">人格档案生成中，内容规划稍后输出...</span> : <span className="text-gray-400">等待生成...</span>)
                      )}
                    </div>
                    {((activeTab === 'profile' && profileResult) || (activeTab === 'plan' && planResult)) && (
                      <button
                        onClick={() => handleCopy(activeTab === 'profile' ? profileResult : planResult)}
                        className="absolute top-0 right-0 text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded hover:bg-gray-100"
                      >
                        复制
                      </button>
                    )}
                  </div>
                )}
                {loading && (profileResult || planResult) && (
                  <div className="mt-4 flex items-center gap-2 text-xs text-blue-500">
                    <div className="w-3 h-3 border border-blue-500 border-t-transparent rounded-full animate-spin" />
                    生成中...
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
