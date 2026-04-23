'use client';

import { useState, useRef, useEffect } from 'react';

type Step = 1 | 2 | 3;
type Tab = 'profile' | 'plan';

const BASE = '/persona-positioning';

interface UploadedFile {
  name: string;
  text: string;
  status: 'uploading' | 'done' | 'error';
}

interface KolSubmission {
  id: string;
  nickname: string;
  submittedAt: string;
  answers: Record<string, string>;
  report: string;
}

const STEP_LABELS = [
  { n: 1 as Step, label: '填写达人资料' },
  { n: 2 as Step, label: '上传对标资料' },
  { n: 3 as Step, label: '生成人设档案' },
];

export default function Home() {
  // ====== 步骤控制 ======
  const [step, setStep] = useState<Step>(1);

  // ====== 步骤 1：达人资料 ======
  const [douyinId, setDouyinId] = useState('');
  const [fetchingDy, setFetchingDy] = useState(false);
  const [fetchDyError, setFetchDyError] = useState('');
  const [top10Content, setTop10Content] = useState('');
  const [fetchDyResult, setFetchDyResult] = useState<{ nickname: string; total: number; top10: number } | null>(null);

  // 达人资料上传
  const [influencerFiles, setInfluencerFiles] = useState<UploadedFile[]>([]);
  const influencerFileRef = useRef<HTMLInputElement | null>(null);

  // 补充资料上传
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [supplementNotes, setSupplementNotes] = useState('');
  const supplementFileRef = useRef<HTMLInputElement | null>(null);

  // ====== 步骤 2：对标资料 ======
  const [benchmarkProfileFiles, setBenchmarkProfileFiles] = useState<UploadedFile[]>([]);
  const [benchmarkPlanFiles, setBenchmarkPlanFiles] = useState<UploadedFile[]>([]);
  const benchmarkProfileRef = useRef<HTMLInputElement | null>(null);
  const benchmarkPlanRef = useRef<HTMLInputElement | null>(null);

  // ====== 步骤 3：结果 ======
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [profileResult, setProfileResult] = useState('');
  const [planResult, setPlanResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // ====== 红人采集数据 ======
  const [kolSubmissions, setKolSubmissions] = useState<KolSubmission[]>([]);
  const [kolLoading, setKolLoading] = useState(false);
  const [selectedKolId, setSelectedKolId] = useState('');

  useEffect(() => {
    fetch(`${BASE}/api/kol-submissions`)
      .then(r => r.json())
      .then(d => setKolSubmissions(d.submissions || []))
      .catch(() => {});
  }, []);

  // ====== 抖音号抓取 ======
  const handleFetchDouyin = async () => {
    if (!douyinId.trim()) return;
    setFetchingDy(true);
    setFetchDyError('');
    setFetchDyResult(null);
    try {
      const res = await fetch(`${BASE}/api/fetch-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: douyinId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFetchDyError(data.error || '抓取失败');
        return;
      }
      setTop10Content(data.top10Text || '');
      setFetchDyResult({ nickname: data.nickname || '', total: data.totalVideos, top10: data.top10Count });
    } catch {
      setFetchDyError('网络错误，请重试');
    } finally {
      setFetchingDy(false);
    }
  };

  // ====== 文件上传（通用） ======
  const handleFileUpload = async (files: FileList, setter: React.Dispatch<React.SetStateAction<UploadedFile[]>>) => {
    for (const file of Array.from(files)) {
      const entry: UploadedFile = { name: file.name, text: '', status: 'uploading' };
      setter((prev) => [...prev, entry]);

      try {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch(`${BASE}/api/parse-file`, { method: 'POST', body: fd });
        const json = await res.json();
        if (!res.ok) {
          setter((prev) =>
            prev.map((f) => (f.name === file.name && f.status === 'uploading' ? { ...f, status: 'error' } : f))
          );
          continue;
        }
        setter((prev) =>
          prev.map((f) => (f.name === file.name && f.status === 'uploading' ? { ...f, text: json.text, status: 'done' } : f))
        );
      } catch {
        setter((prev) =>
          prev.map((f) => (f.name === file.name && f.status === 'uploading' ? { ...f, status: 'error' } : f))
        );
      }
    }
  };

  const handleInfluencerUpload = (files: FileList) => handleFileUpload(files, setInfluencerFiles);
  const handleSupplementUpload = (files: FileList) => handleFileUpload(files, setUploadedFiles);
  const handleBenchmarkProfileUpload = (files: FileList) => handleFileUpload(files, setBenchmarkProfileFiles);
  const handleBenchmarkPlanUpload = (files: FileList) => handleFileUpload(files, setBenchmarkPlanFiles);

  // ====== 从红人采集导入 ======
  const handleImportKol = (submission: KolSubmission) => {
    const fieldLabels: Record<string, string> = {
      nickname: '昵称',
      age_city: '年龄城市',
      relationship: '情感状态',
      kids: '子女情况',
      parents: '与父母关系',
      one_sentence: '一句话介绍',
      career_path: '职业经历',
      unique_experiences: '独特经历',
      speaking_style: '说话风格',
      never_say: '绝对不做的内容',
      credentials: '特殊背书',
      content_direction: '内容方向',
      target_audience: '目标受众',
      liked_blogger: '喜欢的博主',
      liked_douyin_content: '喜欢的抖音内容',
      own_best_content: '自己最满意的内容',
    };

    let text = `红人信息采集表 —— ${submission.nickname}\n采集时间：${submission.submittedAt}\n${'='.repeat(40)}\n\n`;
    for (const [key, label] of Object.entries(fieldLabels)) {
      if (submission.answers[key]) {
        text += `【${label}】\n${submission.answers[key]}\n\n`;
      }
    }
    if (submission.report) {
      text += `${'='.repeat(40)}\n【AI 分析报告】\n${submission.report}\n`;
    }

    const fileName = `红人采集_${submission.nickname}_${submission.submittedAt.split(' ')[0] || ''}.txt`;
    setInfluencerFiles(prev => [
      ...prev,
      { name: fileName, text, status: 'done' as const },
    ]);
    setSelectedKolId(submission.id);
  };

  // ====== 汇总数据 ======
  const buildInfluencerInfo = () => {
    return influencerFiles
      .filter((f) => f.status === 'done' && f.text)
      .map((f) => `=== ${f.name} ===\n${f.text}`)
      .join('\n\n');
  };

  const buildSupplementText = () => {
    const parts: string[] = [];
    const noteText = supplementNotes.trim();
    const fileText = uploadedFiles
      .filter((f) => f.status === 'done' && f.text)
      .map((f) => `=== ${f.name} ===\n${f.text}`)
      .join('\n\n');

    if (noteText) parts.push(`=== 运营补充说明 ===\n${noteText}`);
    if (fileText) parts.push(fileText);

    return parts.join('\n\n');
  };

  const buildBenchmarkTextData = () => {
    const parts: string[] = [];
    const profileText = benchmarkProfileFiles
      .filter((f) => f.status === 'done' && f.text)
      .map((f) => `=== 对标人格档案：${f.name} ===\n${f.text}`)
      .join('\n\n');
    const planText = benchmarkPlanFiles
      .filter((f) => f.status === 'done' && f.text)
      .map((f) => `=== 对标内容规划：${f.name} ===\n${f.text}`)
      .join('\n\n');
    if (profileText) parts.push(profileText);
    if (planText) parts.push(planText);
    return parts.join('\n\n');
  };

  // 有达人资料才能进下一步
  const hasInfluencerData = influencerFiles.some((f) => f.status === 'done');
  const hasParsedDouyin = !douyinId.trim() || !!fetchDyResult;
  const canGoStep2 = hasInfluencerData && hasParsedDouyin;

  // ====== 步骤导航 ======
  const goToStep2 = () => {
    if (!canGoStep2) return;
    setStep(2);
    window.scrollTo(0, 0);
  };

  const goToStep1 = () => {
    setStep(1);
    window.scrollTo(0, 0);
  };

  // ====== 生成 AI 人格档案与内容规划 ======
  const handleGenerate = async () => {
    const influencerInfo = buildInfluencerInfo();
    if (!influencerInfo.trim()) {
      alert('请上传达人资料文档');
      return;
    }

    setLoading(true);
    setProfileResult('');
    setPlanResult('');
    setStep(3);
    setActiveTab('profile');
    abortRef.current = new AbortController();

    try {
      const supplementText = buildSupplementText();
      const benchmarkTextData = buildBenchmarkTextData();
      const res = await fetch(`${BASE}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ influencerInfo, top10Content, supplementText, benchmarkText: benchmarkTextData }),
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
        setProfileResult(parts[0].trim());
        if (parts.length > 1) setPlanResult(parts[1].trim());
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') alert('生成出错，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    abortRef.current?.abort();
    setStep(1);
    setProfileResult('');
    setPlanResult('');
    setLoading(false);
  };

  const handleCopy = (text: string) => { navigator.clipboard.writeText(text); };

  const handleExportWord = async (type: 'profile' | 'plan') => {
    const content = type === 'profile' ? profileResult : planResult;
    if (!content) return;
    setExporting(true);
    try {
      const name = fetchDyResult?.nickname || '达人';
      const res = await fetch(`${BASE}/api/export-word`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ influencerName: name, profileResult, planResult, type }),
      });
      if (!res.ok) { alert('导出失败'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().slice(0, 10);
      const label = type === 'profile' ? '人格档案' : '内容规划';
      a.download = `${label}_${name}_${dateStr}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch { alert('导出失败'); }
    finally { setExporting(false); }
  };

  // ====== 步骤指示器 ======
  const StepIndicator = () => (
    <div className="max-w-3xl mx-auto px-6 pt-8 pb-2">
      <div className="flex items-center">
        {STEP_LABELS.map((s, idx) => (
          <div key={s.n} className="flex items-center flex-1">
            <button
              onClick={() => {
                if (s.n < step) setStep(s.n);
              }}
              disabled={s.n > step}
              className="flex items-center gap-2 transition disabled:cursor-default"
              style={{ cursor: s.n < step ? 'pointer' : 'default' }}
            >
              <div className="w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center shrink-0 transition"
                style={{
                  background: step >= s.n ? 'rgba(167,139,250,0.2)' : 'rgba(255,255,255,0.04)',
                  color: step >= s.n ? '#c4b5fd' : 'rgba(255,255,255,0.25)',
                  border: `1px solid ${step >= s.n ? 'rgba(167,139,250,0.35)' : 'rgba(255,255,255,0.08)'}`,
                }}>
                {step > s.n ? '✓' : s.n}
              </div>
              <span className="text-xs whitespace-nowrap hidden sm:inline"
                style={{ color: step >= s.n ? '#c4b5fd' : 'rgba(255,255,255,0.25)' }}>
                {s.label}
              </span>
            </button>
            {idx < STEP_LABELS.length - 1 && (
              <div className="flex-1 h-px mx-3"
                style={{ background: step > s.n ? 'rgba(167,139,250,0.3)' : 'rgba(255,255,255,0.06)' }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );

  // ====== 文件上传区域组件 ======
  const FileUploadZone = ({ fileRef, files, onUpload, title = '上传文件', emptyTitle = '点击或拖拽文件到这里上传', emptyHint = '支持 Word、PDF、TXT、MD 格式' }: {
    fileRef: React.RefObject<HTMLInputElement | null>;
    files: UploadedFile[];
    onUpload: (files: FileList) => void;
    title?: string;
    emptyTitle?: string;
    emptyHint?: string;
  }) => (
    <>
      <input ref={fileRef} type="file" accept=".docx,.pdf,.txt,.md" multiple className="hidden"
        onChange={(e) => { if (e.target.files) onUpload(e.target.files); e.target.value = ''; }} />
      <div onClick={() => fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (e.dataTransfer.files) onUpload(e.dataTransfer.files); }}
        className="rounded-2xl px-5 py-5 cursor-pointer transition"
        style={{ border: '1.5px dashed rgba(255,255,255,0.12)', background: files.length > 0 ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)' }}>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.88)' }}>{title}</p>
            <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.38)' }}>{files.length > 0 ? '文件会展示在这个大框里，避免误以为没有上传成功' : emptyHint}</p>
          </div>
          <div className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium"
            style={{ background: 'rgba(96,165,250,0.12)', color: '#93c5fd', border: '1px solid rgba(96,165,250,0.18)' }}>
            + 继续上传
          </div>
        </div>

        {files.length === 0 ? (
          <div className="rounded-xl py-8 px-4 text-center"
            style={{ background: 'rgba(255,255,255,0.015)', border: '1px dashed rgba(255,255,255,0.08)' }}>
            <div className="text-2xl mb-2" style={{ opacity: 0.6 }}>+</div>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.56)' }}>{emptyTitle}</p>
            <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>{emptyHint}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {files.map((f, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="w-5 flex justify-center shrink-0">
                  {f.status === 'uploading' && <div className="w-3.5 h-3.5 border rounded-full animate-spin" style={{ borderColor: 'rgba(167,139,250,0.3)', borderTopColor: '#a78bfa' }} />}
                  {f.status === 'done' && <span style={{ color: '#86efac' }}>✓</span>}
                  {f.status === 'error' && <span style={{ color: '#f87171' }}>✗</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm truncate" style={{ color: 'rgba(255,255,255,0.76)' }}>{f.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: f.status === 'error' ? '#f87171' : 'rgba(255,255,255,0.32)' }}>
                    {f.status === 'uploading' ? '正在解析内容…' : f.status === 'done' ? '已上传成功' : '解析失败，请重新上传'}
                  </p>
                </div>
                {f.status === 'done' && <span className="text-xs shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }}>{f.text.length} 字</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );

  // ====== 步骤 3：结果页 ======
  if (step === 3) {
    return (
      <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #0f0f0f 0%, #1a1a2e 50%, #16213e 100%)' }}>
        <div style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(20px)' }}>
          <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold" style={{ color: '#e0d4ff' }}>人设定位助手</h1>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>生成结果</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => handleExportWord('profile')} disabled={exporting || !profileResult || loading}
                className="text-xs px-3 py-1.5 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ background: 'rgba(167,139,250,0.15)', color: '#c4b5fd', border: '1px solid rgba(167,139,250,0.2)' }}>
                导出人格档案
              </button>
              <button onClick={() => handleExportWord('plan')} disabled={exporting || !planResult || loading}
                className="text-xs px-3 py-1.5 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ background: 'rgba(167,139,250,0.15)', color: '#c4b5fd', border: '1px solid rgba(167,139,250,0.2)' }}>
                导出内容规划
              </button>
              <button onClick={handleReset}
                className="text-xs px-3 py-1.5 rounded-lg transition"
                style={{ color: 'rgba(255,255,255,0.5)' }}>
                ← 返回
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {([
                { key: 'profile' as Tab, label: '人格档案' },
                { key: 'plan' as Tab, label: '内容规划' },
              ]).map((tab) => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  className="flex-1 py-3.5 text-sm font-medium transition-all"
                  style={{
                    color: activeTab === tab.key ? '#c4b5fd' : 'rgba(255,255,255,0.35)',
                    borderBottom: activeTab === tab.key ? '2px solid #a78bfa' : '2px solid transparent',
                    background: activeTab === tab.key ? 'rgba(167,139,250,0.05)' : 'transparent',
                  }}>
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-6 md:p-8">
              {activeTab === 'profile' ? (
                <div className="relative">
                  {loading && !profileResult ? (
                    <div className="flex items-center justify-center py-20">
                      <div className="text-center">
                        <div className="inline-block w-8 h-8 border-2 rounded-full animate-spin mb-4"
                          style={{ borderColor: 'rgba(167,139,250,0.3)', borderTopColor: '#a78bfa' }} />
                        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>正在生成人格档案，预计 1-2 分钟...</p>
                      </div>
                    </div>
                  ) : (
                    <div className="prose prose-sm prose-invert max-w-none whitespace-pre-wrap leading-relaxed" style={{ color: 'rgba(255,255,255,0.8)' }}>
                      {profileResult || <span style={{ color: 'rgba(255,255,255,0.25)' }}>等待生成...</span>}
                    </div>
                  )}
                  {profileResult && (
                    <button onClick={() => handleCopy(profileResult)}
                      className="absolute top-0 right-0 text-xs px-2 py-1 rounded transition"
                      style={{ color: 'rgba(255,255,255,0.3)' }}>
                      复制
                    </button>
                  )}
                </div>
              ) : activeTab === 'plan' ? (
                <div className="relative">
                  {loading && !planResult ? (
                    <div className="flex items-center justify-center py-20">
                      <div className="text-center">
                        <div className="inline-block w-8 h-8 border-2 rounded-full animate-spin mb-4"
                          style={{ borderColor: 'rgba(167,139,250,0.3)', borderTopColor: '#a78bfa' }} />
                        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
                          {profileResult ? '内容规划即将生成...' : '正在生成人格档案，内容规划稍后输出...'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="prose prose-sm prose-invert max-w-none whitespace-pre-wrap leading-relaxed" style={{ color: 'rgba(255,255,255,0.8)' }}>
                      {planResult || <span style={{ color: 'rgba(255,255,255,0.25)' }}>等待生成...</span>}
                    </div>
                  )}
                  {planResult && (
                    <button onClick={() => handleCopy(planResult)}
                      className="absolute top-0 right-0 text-xs px-2 py-1 rounded transition"
                      style={{ color: 'rgba(255,255,255,0.3)' }}>
                      复制
                    </button>
                  )}
                </div>
              ) : null}
              {loading && (profileResult || planResult) && (
                <div className="mt-4 flex items-center gap-2 text-xs" style={{ color: '#a78bfa' }}>
                  <div className="w-3 h-3 border rounded-full animate-spin" style={{ borderColor: 'rgba(167,139,250,0.3)', borderTopColor: '#a78bfa' }} />
                  生成中...
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ====== 步骤 1 & 2：输入页 ======
  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #0f0f0f 0%, #1a1a2e 50%, #16213e 100%)' }}>
      {/* 顶部 */}
      <div style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="max-w-3xl mx-auto px-6 py-6 text-center">
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#e0d4ff' }}>人设定位助手</h1>
          <p className="text-sm mt-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
            三步完成达人人设定位：填写达人资料 → 上传对标资料 → AI 生成人格档案与内容规划
          </p>
        </div>
      </div>

      {/* 步骤指示器 */}
      <StepIndicator />

      <div className="max-w-3xl mx-auto px-6 py-6 space-y-8">

        {/* ================== 步骤 1：达人资料 ================== */}
        {step === 1 && (
          <>
            {/* 区块 1：输入达人抖音号 */}
            <section className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-3 mb-1.5">
                <span className="w-7 h-7 rounded-full text-sm font-bold flex items-center justify-center" style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.25)' }}>1</span>
                <h2 className="text-base font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>输入达人抖音号</h2>
              </div>
              <p className="text-xs mb-4 ml-10" style={{ color: 'rgba(255,255,255,0.35)' }}>自动调取达人账号点赞最高的前 10 条内容，供 AI 参考</p>

              <div className="ml-10 space-y-3">
                <input type="text" value={douyinId} onChange={(e) => {
                  setDouyinId(e.target.value);
                  setFetchDyError('');
                  setFetchDyResult(null);
                  setTop10Content('');
                }}
                  onKeyDown={(e) => e.key === 'Enter' && handleFetchDouyin()}
                  placeholder="输入抖音号（如 DNX833）或粘贴主页链接..."
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.85)' }} />

                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-xs font-medium" style={{ color: '#f9c86b' }}>
                    填完抖音号后，这一步必点
                  </p>
                  <button onClick={handleFetchDouyin} disabled={fetchingDy || !douyinId.trim()}
                    className="px-5 py-2.5 text-sm font-medium rounded-xl transition disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap"
                    style={{ background: 'rgba(167,139,250,0.2)', color: '#c4b5fd', border: '1px solid rgba(167,139,250,0.3)' }}>
                    {fetchingDy ? '抓取中...' : '解析（必点）'}
                  </button>
                </div>
              </div>
              {fetchDyError && <p className="text-xs mt-2 ml-10" style={{ color: '#f87171' }}>{fetchDyError}</p>}
              {fetchDyResult && (
                <div className="mt-3 ml-10 p-3 rounded-xl flex items-center justify-between"
                  style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.15)' }}>
                  <p className="text-xs" style={{ color: '#86efac' }}>
                    抓取成功！{fetchDyResult.nickname && <span className="font-medium">「{fetchDyResult.nickname}」</span>} 共 {fetchDyResult.total} 条作品，已提取 TOP{fetchDyResult.top10} 供 AI 参考
                  </p>
                  <span className="text-xs px-2 py-0.5 rounded font-medium ml-2" style={{ background: 'rgba(74,222,128,0.1)', color: '#86efac' }}>已就绪</span>
                </div>
              )}
            </section>

            {/* 区块 2：上传达人资料文档 */}
            <section className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-3 mb-1.5">
                <span className="w-7 h-7 rounded-full text-sm font-bold flex items-center justify-center" style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.25)' }}>2</span>
                <h2 className="text-base font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>员工上传达人资料</h2>
              </div>
              <p className="text-xs mb-5 ml-10" style={{ color: 'rgba(255,255,255,0.35)' }}>
                员工先下载采集表模板发给达人填写，再把达人填写完成的采集表上传到这里，AI 会基于这份表做后续人设定位。
              </p>

              <div className="ml-10 space-y-4">
                {/* 从红人采集导入 */}
                {kolSubmissions.length > 0 && (
                  <div className="rounded-2xl p-4"
                    style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.16)' }}>
                    <p className="text-sm font-medium mb-2" style={{ color: '#86efac' }}>从红人信息采集导入</p>
                    <p className="text-xs mb-3" style={{ color: 'rgba(134,239,172,0.68)' }}>
                      选择已完成红人信息采集的达人，自动导入采集数据（含 AI 分析报告）
                    </p>
                    <div className="flex items-center gap-3">
                      <select
                        value={selectedKolId}
                        onChange={(e) => {
                          const sub = kolSubmissions.find(s => s.id === e.target.value);
                          if (sub) handleImportKol(sub);
                        }}
                        className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none transition"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.85)' }}>
                        <option value="">选择已采集的达人...</option>
                        {kolSubmissions.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.nickname} ({s.submittedAt})
                          </option>
                        ))}
                      </select>
                    </div>
                    {selectedKolId && (
                      <p className="text-xs mt-2" style={{ color: '#86efac' }}>
                        ✓ 已导入，采集数据已添加到下方文件列表
                      </p>
                    )}
                  </div>
                )}

                <div className="rounded-2xl p-4 flex items-start justify-between gap-4 flex-wrap"
                  style={{ background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.16)' }}>
                  <div>
                    <p className="text-sm font-medium" style={{ color: '#dbeafe' }}>给员工用：先下载模板发给达人填写</p>
                    <p className="text-xs mt-1" style={{ color: 'rgba(219,234,254,0.68)' }}>如果达人填写的是旧版或空白表，请重新下载最新模板后再发给达人填写。</p>
                  </div>
                  <a href={`${BASE}/达人入职信息采集表模板.docx`} download
                    className="text-sm px-4 py-2 rounded-xl transition inline-flex items-center gap-2 whitespace-nowrap"
                    style={{ background: 'rgba(96,165,250,0.14)', color: '#bfdbfe', border: '1px solid rgba(96,165,250,0.24)' }}>
                    <span>↓</span> 下载最新采集表模板
                  </a>
                </div>

                <FileUploadZone
                  fileRef={influencerFileRef}
                  files={influencerFiles}
                  onUpload={handleInfluencerUpload}
                  title="给员工用：上传达人已填写的采集表"
                  emptyTitle="把达人填写完成的采集表拖到这里，或点击上传"
                  emptyHint="支持 Word、PDF、TXT、MD 格式；上传成功后会直接在这个大框里显示文件"
                />
              </div>
            </section>

            {/* 区块 3：补充资料上传 */}
            <section className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-3 mb-1.5">
                <span className="w-7 h-7 rounded-full text-sm font-bold flex items-center justify-center" style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.25)' }}>3</span>
                <h2 className="text-base font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>员工补充理解与资料</h2>
              </div>
              <p className="text-xs mb-4 ml-10" style={{ color: 'rgba(255,255,255,0.35)' }}>给员工用：这里不是让达人填表，而是让运营补充自己对这个红人的理解，可以直接打字，也可以上传补充文档。</p>

              <div className="ml-10 space-y-4">
                <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                    <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.86)' }}>给员工用：直接补充你的判断</p>
                    <span className="text-xs px-2.5 py-1 rounded-lg" style={{ background: 'rgba(167,139,250,0.12)', color: '#c4b5fd', border: '1px solid rgba(167,139,250,0.18)' }}>可直接打字</span>
                  </div>
                  <textarea
                    value={supplementNotes}
                    onChange={(e) => setSupplementNotes(e.target.value)}
                    placeholder="比如：这个红人的优势、个人经历、适合卖什么、目前账号的问题、你觉得能切什么人设方向……"
                    className="w-full min-h-[140px] px-4 py-3 rounded-xl text-sm outline-none resize-y transition"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.85)' }}
                  />
                </div>

                <FileUploadZone
                  fileRef={supplementFileRef}
                  files={uploadedFiles}
                  onUpload={handleSupplementUpload}
                  title="给员工用：上传补充文档"
                  emptyTitle="把你整理的补充资料拖到这里，或点击上传"
                  emptyHint="可上传品牌资料、过往作品、访谈记录等；上传成功后会直接在这个大框里显示文件"
                />
              </div>
            </section>

            {/* 下一步按钮 */}
            <button onClick={goToStep2} disabled={!canGoStep2}
              className="w-full py-4 font-semibold rounded-2xl transition text-base disabled:opacity-20 disabled:cursor-not-allowed"
              style={{
                background: canGoStep2
                  ? 'linear-gradient(135deg, rgba(167,139,250,0.25) 0%, rgba(96,165,250,0.25) 100%)'
                  : 'rgba(255,255,255,0.03)',
                color: canGoStep2 ? '#e0d4ff' : 'rgba(255,255,255,0.2)',
                border: `1px solid ${canGoStep2 ? 'rgba(167,139,250,0.3)' : 'rgba(255,255,255,0.06)'}`,
              }}>
              下一步：上传对标资料 →
            </button>
            <p className="text-xs text-center pb-4" style={{ color: 'rgba(255,255,255,0.2)' }}>
              {!hasInfluencerData
                ? '请上传达人资料后进入下一步'
                : !hasParsedDouyin
                  ? '已填写抖音号时，需要先点击解析后才能进入下一步'
                  : '已满足进入下一步条件'}
            </p>
          </>
        )}

        {/* ================== 步骤 2：对标资料 ================== */}
        {step === 2 && (
          <>
            <section className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-3 mb-1.5">
                <span className="w-7 h-7 rounded-full text-sm font-bold flex items-center justify-center" style={{ background: 'rgba(96,165,250,0.15)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.25)' }}>📂</span>
                <h2 className="text-base font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>上传对标账号资料</h2>
              </div>
              <p className="text-xs mb-5 ml-10" style={{ color: 'rgba(255,255,255,0.35)' }}>
                上传你想参考的对标达人分析资料——人格档案、内容规划、爆款分析文档等。AI 会参考对标账号的成功要素来生成人设定位。
              </p>

              <div className="ml-10 space-y-5">
                <div>
                  <p className="text-xs font-medium mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>对标人格档案</p>
                  <FileUploadZone fileRef={benchmarkProfileRef} files={benchmarkProfileFiles} onUpload={handleBenchmarkProfileUpload} />
                </div>

                <div>
                  <p className="text-xs font-medium mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>对标内容规划</p>
                  <FileUploadZone fileRef={benchmarkPlanRef} files={benchmarkPlanFiles} onUpload={handleBenchmarkPlanUpload} />
                </div>
              </div>
            </section>

            <div className="rounded-xl p-4" style={{ background: 'rgba(96,165,250,0.04)', border: '1px solid rgba(96,165,250,0.1)' }}>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
                对标资料是可选的。如果暂时没有，可以直接点击生成。AI 会根据达人自身的资料来定位人设。
              </p>
            </div>

            <div className="flex gap-3">
              <button onClick={goToStep1}
                className="px-6 py-3.5 text-sm font-medium rounded-2xl transition"
                style={{ color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}>
                ← 上一步
              </button>
              <button onClick={handleGenerate}
                className="flex-1 py-3.5 font-semibold rounded-2xl transition text-base"
                style={{
                  background: 'linear-gradient(135deg, rgba(167,139,250,0.25) 0%, rgba(96,165,250,0.25) 100%)',
                  color: '#e0d4ff',
                  border: '1px solid rgba(167,139,250,0.3)',
                }}>
                开始生成人格档案与内容规划
              </button>
            </div>
            <p className="text-xs text-center pb-4" style={{ color: 'rgba(255,255,255,0.2)' }}>
              生成约需 1-2 分钟，请耐心等待
            </p>
          </>
        )}
      </div>
    </div>
  );
}
