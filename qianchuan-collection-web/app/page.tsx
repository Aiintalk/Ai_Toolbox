'use client'

import { useState, useEffect, useRef } from 'react'

const BASE = '/qianchuan-collection'

interface Persona { name: string; scriptCount: number }
interface Script { id: string; title: string; likes?: number; source?: string; sourceAccount?: string; date: string; content: string; persona?: string; pool: 'global' | 'persona' }

export default function Home() {
  const [personas, setPersonas] = useState<Persona[]>([])
  const [scripts, setScripts] = useState<Script[]>([])

  const [mode, setMode] = useState<'all' | 'persona'>('all')
  const [selectedPersona, setSelectedPersona] = useState<string>('')

  const [showAddPersona, setShowAddPersona] = useState(false)
  const [newPersonaName, setNewPersonaName] = useState('')

  const [showAddForm, setShowAddForm] = useState(false)
  const [addForPersona, setAddForPersona] = useState('')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')

  const [loading, setLoading] = useState('')
  const [toast, setToast] = useState('')
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; pool: string; persona?: string } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { loadPersonas() }, [])
  useEffect(() => { loadScripts() }, [mode, selectedPersona])

  async function loadPersonas() {
    const d = await fetch(`${BASE}/api/personas`).then(r => r.json())
    setPersonas(d.personas || [])
  }

  async function loadScripts() {
    let url = `${BASE}/api/scripts`
    if (mode === 'all') {
      url += '?pool=global'
    } else if (selectedPersona) {
      url += `?pool=persona&persona=${encodeURIComponent(selectedPersona)}`
    } else {
      setScripts([]); return
    }
    const d = await fetch(url).then(r => r.json())
    setScripts(d.scripts || [])
  }

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2000) }

  async function handleCreatePersona() {
    if (!newPersonaName.trim()) return
    setLoading('创建达人...')
    try {
      const res = await fetch(`${BASE}/api/personas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newPersonaName.trim() }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({ error: '创建失败' })); throw new Error(d.error || '创建失败') }
      await loadPersonas()
      setSelectedPersona(newPersonaName.trim())
      setShowAddPersona(false); setNewPersonaName('')
      showToast('达人已创建')
    } catch (e: any) { setError(e.message) } finally { setLoading('') }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading('解析文件...')
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`${BASE}/api/upload`, { method: 'POST', body: formData })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || '解析失败') }
      const d = await res.json()
      setContent(d.text || '')
      if (!title && d.title) setTitle(d.title)
      showToast('文件已解析')
    } catch (e: any) { setError(e.message) } finally {
      setLoading('')
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleAddScript() {
    if (!title.trim() || !content.trim()) return
    if (mode === 'persona' && !addForPersona) return
    setLoading('保存脚本...')
    try {
      const res = await fetch(`${BASE}/api/scripts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pool: mode === 'all' ? 'global' : 'persona',
          persona: mode === 'persona' ? addForPersona : undefined,
          title: title.trim(),
          content: content.trim(),
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      await loadScripts(); await loadPersonas()
      setTitle(''); setContent(''); setShowAddForm(false)
      showToast('脚本已添加')
    } catch (e: any) { setError(e.message) } finally { setLoading('') }
  }

  async function handleDeleteScript(id: string, pool: string, persona?: string) {
    setLoading('删除脚本...')
    try {
      const res = await fetch(`${BASE}/api/scripts`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pool, persona, id }),
      })
      if (!res.ok) throw new Error(await res.text())
      await loadScripts(); await loadPersonas()
      setDeleteTarget(null); showToast('脚本已删除')
    } catch (e: any) { setError(e.message) } finally { setLoading('') }
  }

  function formatLikes(n?: number) {
    if (!n) return ''
    if (n >= 10000) return `${(n / 10000).toFixed(1)}万赞`
    return `${n}赞`
  }

  function copyText(text: string) {
    navigator.clipboard.writeText(text).then(() => showToast('已复制到剪贴板'))
  }

  function downloadScript(s: Script) {
    const blob = new Blob([s.content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `${s.title}.txt`; a.click()
    URL.revokeObjectURL(url)
  }

  const displayScripts = scripts.filter(s => !searchQuery || s.title.includes(searchQuery) || s.content.includes(searchQuery))
  const showList = mode === 'all' || (mode === 'persona' && selectedPersona)

  return (
    <div className="min-h-screen bg-gray-50">
      {toast && <div className="fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-pulse">{toast}</div>}

      <header className="bg-white border-b px-6 py-4">
        <h1 className="text-xl font-bold text-gray-900">千川爆文合集</h1>
        <p className="text-sm text-gray-500 mt-1">全网高跑量千川脚本收集与管理</p>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-4">
        {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}<button className="ml-2 underline" onClick={() => setError('')}>关闭</button></div>}
        {loading && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            {loading}
          </div>
        )}

        {/* 模式选择 */}
        <div className="bg-white rounded-lg border p-4">
          <div className="flex gap-3">
            <button className={`flex-1 py-3 px-4 rounded-lg text-sm font-medium transition border-2 ${mode === 'all' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'}`} onClick={() => { setMode('all'); setExpandedId(null); setSearchQuery(''); setShowAddForm(false) }}>
              <div className="text-base font-bold">全网爆款</div>
              <div className="text-xs mt-0.5 opacity-70">全网跑量好的千川脚本</div>
            </button>
            <button className={`flex-1 py-3 px-4 rounded-lg text-sm font-medium transition border-2 ${mode === 'persona' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'}`} onClick={() => { setMode('persona'); setExpandedId(null); setSearchQuery(''); setShowAddForm(false) }}>
              <div className="text-base font-bold">达人爆款</div>
              <div className="text-xs mt-0.5 opacity-70">查看特定达人的脚本库</div>
            </button>
          </div>

          {mode === 'persona' && (
            <div className="mt-3 flex gap-2">
              <select className="flex-1 border rounded-lg px-3 py-2 text-sm" value={selectedPersona} onChange={e => { setSelectedPersona(e.target.value); setExpandedId(null); setShowAddForm(false) }}>
                <option value="">请选择达人...</option>
                {personas.map(p => <option key={p.name} value={p.name}>{p.name}（{p.scriptCount} 条）</option>)}
              </select>
              <button className="text-xs px-3 py-2 rounded-lg border border-green-200 text-green-600 hover:bg-green-50 transition whitespace-nowrap" onClick={() => setShowAddPersona(!showAddPersona)}>
                {showAddPersona ? '取消' : '+ 新达人'}
              </button>
            </div>
          )}

          {showAddPersona && mode === 'persona' && (
            <div className="mt-3 flex gap-2 border-t pt-3">
              <input type="text" className="flex-1 border rounded-lg px-3 py-2 text-sm" placeholder="达人名称" value={newPersonaName} onChange={e => setNewPersonaName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreatePersona()} />
              <button className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50" disabled={!newPersonaName.trim() || !!loading} onClick={handleCreatePersona}>创建</button>
            </div>
          )}
        </div>

        {/* 搜索 + 添加 */}
        {showList && (
          <div className="flex gap-2">
            <input type="text" className="flex-1 border rounded-lg px-3 py-2 text-sm bg-white" placeholder="搜索标题或内容..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition whitespace-nowrap" onClick={() => { setShowAddForm(true); if (mode === 'persona') setAddForPersona(selectedPersona) }}>
              + 添加脚本
            </button>
          </div>
        )}

        {/* 添加脚本表单 */}
        {showAddForm && (
          <div className="bg-white rounded-lg border p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-medium text-gray-900">{mode === 'all' ? '添加全网爆文' : `为 ${selectedPersona} 添加爆文`}</h2>
              <button className="text-sm text-gray-500 hover:text-gray-700" onClick={() => { setShowAddForm(false); setTitle(''); setContent('') }}>取消</button>
            </div>

            {mode === 'persona' && (
              <select className="w-full border rounded-lg px-3 py-2 text-sm" value={addForPersona} onChange={e => setAddForPersona(e.target.value)}>
                <option value="">选择达人...</option>
                {personas.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
              </select>
            )}

            <input type="text" className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="脚本标题" value={title} onChange={e => setTitle(e.target.value)} />

            {/* 文件上传 */}
            <div className="flex items-center gap-3">
              <label className="cursor-pointer bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition inline-flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                上传文件（Word / PDF / TXT）
                <input ref={fileInputRef} type="file" accept=".docx,.pdf,.txt,.md" className="hidden" onChange={handleFileUpload} />
              </label>
              <span className="text-xs text-gray-400">或直接在下方粘贴内容</span>
            </div>

            <textarea className="w-full border rounded-lg p-3 text-sm h-64 resize-y" placeholder="脚本内容..." value={content} onChange={e => setContent(e.target.value)} />

            <button
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              disabled={!title.trim() || !content.trim() || (mode === 'persona' && !addForPersona) || !!loading}
              onClick={handleAddScript}
            >
              保存脚本
            </button>
          </div>
        )}

        {mode === 'persona' && !selectedPersona && !showAddForm && (
          <div className="bg-white rounded-lg border p-8 text-center"><p className="text-gray-400 text-sm">请在上方选择一个达人</p></div>
        )}

        {/* 脚本列表 */}
        {showList && displayScripts.length > 0 && (
          <div className="space-y-2">
            {displayScripts.map(s => {
              const expandKey = (s.pool === 'global' ? 'g/' : s.persona + '/') + s.id
              const isExpanded = expandedId === expandKey
              const isDeleting = deleteTarget?.id === s.id && deleteTarget?.pool === s.pool
              return (
                <div key={expandKey} className="bg-white rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 cursor-pointer flex-1 min-w-0" onClick={() => setExpandedId(isExpanded ? null : expandKey)}>
                      <span className="text-xs text-gray-400 flex-shrink-0">{isExpanded ? '▼' : '▶'}</span>
                      <span className="font-medium text-gray-800 text-sm truncate">{s.title}</span>
                      {s.likes && <span className="text-xs text-orange-500 flex-shrink-0">{formatLikes(s.likes)}</span>}
                      <span className="text-xs text-gray-300 flex-shrink-0">{s.date}</span>
                    </div>
                    <div className="flex-shrink-0">
                      {isDeleting ? (
                        <div className="flex gap-2">
                          <button className="text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700" onClick={() => handleDeleteScript(s.id, s.pool, s.persona)}>确认</button>
                          <button className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded hover:bg-gray-300" onClick={() => setDeleteTarget(null)}>取消</button>
                        </div>
                      ) : (
                        <button className="text-xs text-red-500 hover:text-red-700" onClick={() => setDeleteTarget({ id: s.id, pool: s.pool, persona: s.persona })}>删除</button>
                      )}
                    </div>
                  </div>
                  {isExpanded ? (
                    <div className="mt-2 border-t pt-2">
                      <div className="flex gap-2 mb-2">
                        <button className="text-xs px-2.5 py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 transition" onClick={() => copyText(s.content)}>复制文案</button>
                        <button className="text-xs px-2.5 py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 transition" onClick={() => downloadScript(s)}>下载 TXT</button>
                      </div>
                      <div className="text-sm text-gray-600 whitespace-pre-wrap max-h-96 overflow-y-auto leading-relaxed">{s.content}</div>
                    </div>
                  ) : (
                    <div className="mt-1 text-xs text-gray-400 truncate">{s.content.slice(0, 100)}{s.content.length > 100 ? '...' : ''}</div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {showList && displayScripts.length === 0 && !showAddForm && (
          <div className="bg-white rounded-lg border p-8 text-center"><p className="text-gray-400 text-sm">{searchQuery ? '没有匹配的脚本' : '还没有收录脚本，点击「添加脚本」开始收集'}</p></div>
        )}
      </main>
    </div>
  )
}
