'use client'

import { useState, useEffect } from 'react'

const BASE = '/material-library'

interface Intake { submittedAt: string; answers: Record<string, string>; report?: string }
interface Persona { name: string; soul: string; contentPlan: string; references: string[]; intake?: Intake }

const uploadGroups = [
  {
    label: '人设仿写素材',
    items: [
      { type: '红人爆款文案', desc: '达人数据好的视频文案', icon: '🔥' },
      { type: '红人喜欢的内容', desc: '达人觉得好、想参考的内容', icon: '❤️' },
      { type: '风格参考', desc: '达人的语气、表达方式参考', icon: '🎨' },
    ],
  },
  {
    label: '千川仿写素材',
    items: [
      { type: '千川爆款文案', desc: '跑量好的千川素材脚本', icon: '📣' },
      { type: '千川喜欢的内容', desc: '觉得好、想参考的千川内容', icon: '🎯' },
      { type: '千川风格参考', desc: '千川素材的语气、表达方式参考', icon: '⚡' },
    ],
  },
]

const allTypes = uploadGroups.flatMap(g => g.items)

export default function Home() {
  const [personas, setPersonas] = useState<Persona[]>([])
  const [fieldLabels, setFieldLabels] = useState<Record<string, string>>({})
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null)

  // 上传表单
  const [activeType, setActiveType] = useState<string | null>(null)
  const [refTitle, setRefTitle] = useState('')
  const [refLikes, setRefLikes] = useState('')
  const [refContent, setRefContent] = useState('')

  // 达人档案 tab
  const [docTab, setDocTab] = useState<'soul' | 'contentPlan'>('soul')
  const [isEditingDoc, setIsEditingDoc] = useState(false)

  // 编辑档案
  const [editingField, setEditingField] = useState<'soul' | 'contentPlan' | null>(null)
  const [editContent, setEditContent] = useState('')

  const [loading, setLoading] = useState('')
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [deleteIdx, setDeleteIdx] = useState<number | null>(null)
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)
  const [confirmDeletePersona, setConfirmDeletePersona] = useState(false)

  // 手动添加达人
  const [showAddPersona, setShowAddPersona] = useState(false)
  const [newPersonaName, setNewPersonaName] = useState('')
  const [newPersonaSoul, setNewPersonaSoul] = useState('')
  const [newPersonaPlan, setNewPersonaPlan] = useState('')

  useEffect(() => {
    fetch(`${BASE}/api/personas`).then(r => r.json()).then(d => {
      setPersonas(d.personas || [])
      if (d.fieldLabels) setFieldLabels(d.fieldLabels)
    })
  }, [])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2000)
  }

  async function handleCreatePersona() {
    if (!newPersonaName.trim()) return
    setLoading('创建达人...')
    try {
      const res = await fetch(`${BASE}/api/personas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newPersonaName.trim(),
          soul: newPersonaSoul,
          contentPlan: newPersonaPlan,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: '创建失败' }))
        throw new Error(data.error || '创建失败')
      }
      await reloadPersonas()
      // 选中新创建的达人
      const d = await fetch(`${BASE}/api/personas`).then(r => r.json())
      const list = d.personas || []
      setPersonas(list)
      const created = list.find((p: Persona) => p.name === newPersonaName.trim())
      if (created) setSelectedPersona(created)
      setShowAddPersona(false)
      setNewPersonaName('')
      setNewPersonaSoul('')
      setNewPersonaPlan('')
      showToast('达人已创建')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading('')
    }
  }

  async function handleDeletePersona() {
    if (!selectedPersona) return
    setLoading('删除达人...')
    try {
      const res = await fetch(`${BASE}/api/personas`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona: selectedPersona.name }),
      })
      if (!res.ok) throw new Error(await res.text())
      setSelectedPersona(null)
      setConfirmDeletePersona(false)
      await reloadPersonas()
      showToast('达人已删除')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading('')
    }
  }

  async function reloadPersonas() {
    const d = await fetch(`${BASE}/api/personas`).then(r => r.json())
    const list = d.personas || []
    setPersonas(list)
    if (d.fieldLabels) setFieldLabels(d.fieldLabels)
    if (selectedPersona) {
      const updated = list.find((p: Persona) => p.name === selectedPersona.name)
      if (updated) setSelectedPersona(updated)
    }
  }

  async function handleAddReference() {
    if (!selectedPersona || !activeType || !refTitle.trim() || !refContent.trim()) return
    setLoading('保存素材...')
    try {
      const res = await fetch(`${BASE}/api/personas/references`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          persona: selectedPersona.name,
          title: refTitle,
          likes: refLikes ? Number(refLikes) : undefined,
          source: '抖音',
          type: activeType,
          content: refContent,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      await reloadPersonas()
      setRefTitle('')
      setRefLikes('')
      setRefContent('')
      setActiveType(null)
      showToast('素材已添加')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading('')
    }
  }

  async function handleDeleteReference(idx: number) {
    if (!selectedPersona) return
    setLoading('删除素材...')
    try {
      const res = await fetch(`${BASE}/api/personas/references`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          persona: selectedPersona.name,
          index: idx,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      await reloadPersonas()
      setDeleteIdx(null)
      showToast('素材已删除')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading('')
    }
  }

  async function handleSaveField(field?: 'soul' | 'contentPlan') {
    const saveField = field || editingField
    if (!selectedPersona || !saveField) return
    setLoading('保存中...')
    try {
      const res = await fetch(`${BASE}/api/personas`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          persona: selectedPersona.name,
          field: saveField,
          content: editContent,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      await reloadPersonas()
      setEditingField(null)
      setEditContent('')
      showToast(saveField === 'soul' ? '人格档案已保存' : '内容规划已保存')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading('')
    }
  }

  // 按类型分组素材
  function groupedRefs() {
    if (!selectedPersona) return {}
    const groups: Record<string, { title: string; likes?: string; body: string; idx: number }[]> = {}
    selectedPersona.references.forEach((ref, idx) => {
      const titleMatch = ref.match(/^---[\s\S]*?title:\s*(.+)/m)
      const typeMatch = ref.match(/^---[\s\S]*?type:\s*(.+)/m)
      const likesMatch = ref.match(/^---[\s\S]*?likes:\s*(\d+)/m)
      const bodyMatch = ref.match(/^---[\s\S]*?---\n([\s\S]*)$/m)
      const title = titleMatch?.[1] || `素材 ${idx + 1}`
      const type = typeMatch?.[1] || '未分类'
      const likes = likesMatch?.[1]
      const body = bodyMatch?.[1]?.trim() || ref
      if (!groups[type]) groups[type] = []
      groups[type].push({ title, likes, body, idx })
    })
    return groups
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {toast && (
        <div className="fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-pulse">
          {toast}
        </div>
      )}

      <header className="bg-white border-b px-6 py-4">
        <h1 className="text-xl font-bold text-gray-900">素材库维护</h1>
        <p className="text-sm text-gray-500 mt-1">管理达人档案与参考素材，上传越多 AI 仿写越精准</p>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
            <button className="ml-2 underline" onClick={() => setError('')}>关闭</button>
          </div>
        )}

        {loading && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            {loading}
          </div>
        )}

        {/* 选择达人 */}
        <div className="bg-white rounded-lg border p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">选择达人</label>
          <div className="flex gap-2">
            <select
              className="flex-1 border rounded-lg px-3 py-2 text-sm"
              value={selectedPersona?.name || ''}
              onChange={e => {
                const p = personas.find(p => p.name === e.target.value) || null
                setSelectedPersona(p)
                setActiveType(null)
                setDeleteIdx(null)
                setExpandedIdx(null)
                setConfirmDeletePersona(false)
                setShowAddPersona(false)
              }}
            >
              <option value="">请选择...</option>
              {personas.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
            </select>
            <button
              className="text-xs px-3 py-2 rounded-lg border border-green-200 text-green-600 hover:bg-green-50 transition whitespace-nowrap"
              onClick={() => { setShowAddPersona(!showAddPersona); setSelectedPersona(null) }}
            >
              {showAddPersona ? '取消' : '+ 手动添加'}
            </button>
            {selectedPersona && !confirmDeletePersona && (
              <button
                className="text-xs px-3 py-2 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition"
                onClick={() => setConfirmDeletePersona(true)}
              >
                删除
              </button>
            )}
            {selectedPersona && confirmDeletePersona && (
              <div className="flex gap-1">
                <button
                  className="text-xs px-3 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
                  onClick={handleDeletePersona}
                >
                  确认删除
                </button>
                <button
                  className="text-xs px-3 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300"
                  onClick={() => setConfirmDeletePersona(false)}
                >
                  取消
                </button>
              </div>
            )}
          </div>

          {/* 手动添加达人表单 */}
          {showAddPersona && (
            <div className="mt-4 space-y-3 border-t pt-4">
              <input
                type="text"
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="达人名称（必填）"
                value={newPersonaName}
                onChange={e => setNewPersonaName(e.target.value)}
              />
              <div>
                <label className="block text-xs text-gray-500 mb-1">人格档案（选填，可后续再编辑）</label>
                <textarea
                  className="w-full border rounded-lg p-3 text-sm h-48 font-mono resize-y"
                  placeholder="粘贴人格档案内容..."
                  value={newPersonaSoul}
                  onChange={e => setNewPersonaSoul(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">内容规划（选填，可后续再编辑）</label>
                <textarea
                  className="w-full border rounded-lg p-3 text-sm h-48 font-mono resize-y"
                  placeholder="粘贴内容规划..."
                  value={newPersonaPlan}
                  onChange={e => setNewPersonaPlan(e.target.value)}
                />
              </div>
              <button
                className="w-full bg-green-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                disabled={!newPersonaName.trim() || !!loading}
                onClick={handleCreatePersona}
              >
                创建达人
              </button>
            </div>
          )}
        </div>

        {selectedPersona && !activeType && (() => {
          const groups = groupedRefs()
          const totalCount = selectedPersona.references.length
          const intake = selectedPersona.intake
          return (
            <>
              {/* 红人采集报告 */}
              {intake && (
                <div className="bg-white rounded-lg border p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="font-medium text-gray-900">红人采集信息</h2>
                    <span className="text-xs text-gray-400">提交时间：{intake.submittedAt}</span>
                  </div>
                  <div className="space-y-2 mb-4">
                    {Object.entries(intake.answers)
                      .filter(([, v]) => v && v.trim())
                      .map(([k, v]) => (
                        <div key={k} className="text-sm">
                          <span className="text-gray-500 font-medium">{fieldLabels[k] || k}：</span>
                          <span className="text-gray-700 whitespace-pre-wrap">{v}</span>
                        </div>
                      ))}
                  </div>
                  {intake.report && (
                    <details className="border-t pt-3">
                      <summary className="text-sm font-medium text-blue-600 cursor-pointer hover:text-blue-800">
                        AI 分析报告
                      </summary>
                      <div className="mt-2 text-sm text-gray-700 whitespace-pre-wrap bg-blue-50 rounded-lg p-3 max-h-96 overflow-y-auto">
                        {intake.report}
                      </div>
                    </details>
                  )}
                </div>
              )}

              {/* 达人档案管理 */}
              <div className="bg-white rounded-lg border p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                    <button
                      className={`px-3 py-1.5 text-sm rounded-md transition ${docTab === 'soul' ? 'bg-white shadow-sm font-medium text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                      onClick={() => { setDocTab('soul'); setIsEditingDoc(false) }}
                    >
                      人格档案
                    </button>
                    <button
                      className={`px-3 py-1.5 text-sm rounded-md transition ${docTab === 'contentPlan' ? 'bg-white shadow-sm font-medium text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                      onClick={() => { setDocTab('contentPlan'); setIsEditingDoc(false) }}
                    >
                      内容规划
                    </button>
                  </div>
                  {!isEditingDoc ? (
                    <button
                      className="text-xs px-3 py-1.5 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition"
                      onClick={() => {
                        setIsEditingDoc(true)
                        setEditContent(docTab === 'soul' ? (selectedPersona.soul || '') : (selectedPersona.contentPlan || ''))
                        setEditingField(docTab)
                      }}
                    >
                      {(docTab === 'soul' ? selectedPersona.soul : selectedPersona.contentPlan) ? '编辑' : '添加'}
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                        disabled={!!loading}
                        onClick={async () => {
                          await handleSaveField(docTab)
                          setIsEditingDoc(false)
                        }}
                      >
                        保存
                      </button>
                      <button
                        className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                        onClick={() => { setIsEditingDoc(false); setEditingField(null); setEditContent('') }}
                      >
                        取消
                      </button>
                    </div>
                  )}
                </div>
                {isEditingDoc ? (
                  <textarea
                    className="w-full border rounded-lg p-3 text-sm h-96 font-mono resize-y"
                    placeholder={docTab === 'soul' ? '输入人格档案内容...' : '输入内容规划...'}
                    value={editContent}
                    onChange={e => setEditContent(e.target.value)}
                  />
                ) : (
                  <div className="border rounded-lg p-4 max-h-[500px] overflow-y-auto">
                    {(docTab === 'soul' ? selectedPersona.soul : selectedPersona.contentPlan) ? (
                      <pre className="text-sm text-gray-800 whitespace-pre-wrap font-sans leading-relaxed">
                        {docTab === 'soul' ? selectedPersona.soul : selectedPersona.contentPlan}
                      </pre>
                    ) : (
                      <p className="text-sm text-gray-400 text-center py-8">暂未配置，点击右上角「添加」</p>
                    )}
                  </div>
                )}
              </div>

              {/* 上传入口 - 两组分开 */}
              {uploadGroups.map(group => (
                <div key={group.label} className="bg-white rounded-lg border p-4">
                  <h2 className="font-medium text-gray-900 mb-3">{group.label}</h2>
                  <div className="grid grid-cols-3 gap-3">
                    {group.items.map(item => (
                      <button
                        key={item.type}
                        className="p-3 rounded-lg border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 text-left transition"
                        onClick={() => setActiveType(item.type)}
                      >
                        <div className="text-xl mb-1">{item.icon}</div>
                        <p className="font-medium text-gray-900 text-sm">上传{item.type}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                        {groups[item.type] && (
                          <p className="text-xs text-blue-600 mt-1">已有 {groups[item.type].length} 条</p>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              {/* 已有素材目录 - 按类型分组 */}
              {totalCount > 0 && (
                <div className="bg-white rounded-lg border p-4">
                  <h2 className="font-medium text-gray-900 mb-3">已有素材目录（共 {totalCount} 条）</h2>
                  <div className="space-y-4">
                    {allTypes.map(typeItem => {
                      const items = groups[typeItem.type]
                      if (!items || items.length === 0) return null
                      return (
                        <div key={typeItem.type}>
                          <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5">
                            <span>{typeItem.icon}</span>
                            <span>{typeItem.type}</span>
                            <span className="text-xs text-gray-400">({items.length})</span>
                          </h3>
                          <div className="space-y-1.5 ml-1">
                            {items.map(item => {
                              const isExpanded = expandedIdx === item.idx
                              return (
                                <div key={item.idx} className="bg-gray-50 rounded-lg p-2.5">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 cursor-pointer flex-1" onClick={() => setExpandedIdx(isExpanded ? null : item.idx)}>
                                      <span className="text-xs text-gray-400">{isExpanded ? '▼' : '▶'}</span>
                                      <span className="font-medium text-gray-800 text-sm">{item.title}</span>
                                      {item.likes && <span className="text-xs text-gray-400">{(Number(item.likes) / 10000).toFixed(1)}万赞</span>}
                                    </div>
                                    {deleteIdx === item.idx ? (
                                      <div className="flex gap-2">
                                        <button className="text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700" onClick={() => handleDeleteReference(item.idx)}>确认删除</button>
                                        <button className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded hover:bg-gray-300" onClick={() => setDeleteIdx(null)}>取消</button>
                                      </div>
                                    ) : (
                                      <button className="text-xs text-red-500 hover:text-red-700" onClick={() => setDeleteIdx(item.idx)}>删除</button>
                                    )}
                                  </div>
                                  {isExpanded && (
                                    <div className="mt-2 text-sm text-gray-600 whitespace-pre-wrap border-t pt-2 max-h-64 overflow-y-auto">
                                      {item.body}
                                    </div>
                                  )}
                                  {!isExpanded && (
                                    <div className="mt-1 text-xs text-gray-400 truncate">
                                      {item.body.slice(0, 80)}{item.body.length > 80 ? '...' : ''}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                    {/* 未分类素材 */}
                    {groups['未分类'] && groups['未分类'].length > 0 && (
                      <div>
                        <h3 className="text-sm font-medium text-gray-700 mb-2">📁 未分类 ({groups['未分类'].length})</h3>
                        <div className="space-y-1.5 ml-1">
                          {groups['未分类'].map(item => {
                            const isExpanded = expandedIdx === item.idx
                            return (
                              <div key={item.idx} className="bg-gray-50 rounded-lg p-2.5">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2 cursor-pointer flex-1" onClick={() => setExpandedIdx(isExpanded ? null : item.idx)}>
                                    <span className="text-xs text-gray-400">{isExpanded ? '▼' : '▶'}</span>
                                    <span className="font-medium text-gray-800 text-sm">{item.title}</span>
                                  </div>
                                  {deleteIdx === item.idx ? (
                                    <div className="flex gap-2">
                                      <button className="text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700" onClick={() => handleDeleteReference(item.idx)}>确认删除</button>
                                      <button className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded hover:bg-gray-300" onClick={() => setDeleteIdx(null)}>取消</button>
                                    </div>
                                  ) : (
                                    <button className="text-xs text-red-500 hover:text-red-700" onClick={() => setDeleteIdx(item.idx)}>删除</button>
                                  )}
                                </div>
                                {isExpanded && (
                                  <div className="mt-2 text-sm text-gray-600 whitespace-pre-wrap border-t pt-2 max-h-64 overflow-y-auto">
                                    {item.body}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )
        })()}

        {/* 上传表单 */}
        {selectedPersona && activeType && (
          <div className="bg-white rounded-lg border p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-medium text-gray-900">上传{activeType}</h2>
                <p className="text-sm text-gray-500 mt-1">为 {selectedPersona.name} 添加素材</p>
              </div>
              <button
                className="text-sm text-gray-500 hover:text-gray-700"
                onClick={() => { setActiveType(null); setRefTitle(''); setRefLikes(''); setRefContent('') }}
              >
                ← 返回
              </button>
            </div>

            <input
              type="text"
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="标题（必填）"
              value={refTitle}
              onChange={e => setRefTitle(e.target.value)}
            />
            <input
              type="text"
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="点赞数（选填）"
              value={refLikes}
              onChange={e => setRefLikes(e.target.value)}
            />
            <textarea
              className="w-full border rounded-lg p-3 text-sm h-64"
              placeholder="粘贴素材内容（必填）..."
              value={refContent}
              onChange={e => setRefContent(e.target.value)}
            />
            <button
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              disabled={!refTitle.trim() || !refContent.trim() || !!loading}
              onClick={handleAddReference}
            >
              保存素材
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
