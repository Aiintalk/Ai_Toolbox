'use client'

import { useEffect, useState } from 'react'

type User = {
  id: number
  username: string
  role: 'admin' | 'employee' | 'kol'
  created_at: string
}

export default function AdminClient({
  currentUid,
  currentUsername,
}: {
  currentUid: number
  currentUsername: string
}) {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  // 新增表单
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState<User['role']>('employee')
  const [adding, setAdding] = useState(false)

  async function load() {
    setLoading(true)
    setErr('')
    try {
      const res = await fetch('/auth/api/admin/users')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '加载失败')
      setUsers(data.users)
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function onAdd(e: React.FormEvent) {
    e.preventDefault()
    setAdding(true)
    setErr('')
    try {
      const res = await fetch('/auth/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newUsername,
          password: newPassword,
          role: newRole,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '新增失败')
      setNewUsername('')
      setNewPassword('')
      setNewRole('employee')
      await load()
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setAdding(false)
    }
  }

  async function onDelete(u: User) {
    if (!confirm(`确认删除用户 ${u.username}？`)) return
    try {
      const res = await fetch(`/auth/api/admin/users/${u.id}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '删除失败')
      await load()
    } catch (e: any) {
      setErr(e.message)
    }
  }

  async function onResetPassword(u: User) {
    const pwd = prompt(`重置 ${u.username} 的密码（至少 6 位）`)
    if (!pwd) return
    try {
      const res = await fetch(`/auth/api/admin/users/${u.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pwd }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '重置失败')
      alert('密码已重置')
    } catch (e: any) {
      setErr(e.message)
    }
  }

  async function onChangeRole(u: User, role: User['role']) {
    if (u.id === currentUid) {
      alert('不能修改自己的角色')
      return
    }
    try {
      const res = await fetch(`/auth/api/admin/users/${u.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '修改失败')
      await load()
    } catch (e: any) {
      setErr(e.message)
    }
  }

  async function onLogout() {
    await fetch('/auth/api/logout', { method: 'POST' })
    window.location.href = '/auth/login'
  }

  return (
    <div className="min-h-screen p-6 max-w-5xl mx-auto">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">用户管理</h1>
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <span>当前：{currentUsername}（管理员）</span>
          <button
            onClick={onLogout}
            className="rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-100"
          >
            退出登录
          </button>
        </div>
      </header>

      {err && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {err}
        </div>
      )}

      <section className="bg-white rounded-2xl shadow p-5 mb-6">
        <h2 className="font-medium mb-3">新增用户</h2>
        <form onSubmit={onAdd} className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-slate-600 mb-1">用户名</label>
            <input
              type="text"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">密码（≥ 6 位）</label>
            <input
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2"
              minLength={6}
              required
            />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">角色</label>
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as User['role'])}
              className="rounded-lg border border-slate-300 px-3 py-2"
            >
              <option value="employee">员工</option>
              <option value="kol">网红</option>
              <option value="admin">管理员</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={adding}
            className="rounded-lg bg-slate-900 text-white px-4 py-2 hover:bg-slate-800 disabled:opacity-60"
          >
            {adding ? '提交中…' : '新增'}
          </button>
        </form>
      </section>

      <section className="bg-white rounded-2xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left px-4 py-2">ID</th>
              <th className="text-left px-4 py-2">用户名</th>
              <th className="text-left px-4 py-2">角色</th>
              <th className="text-left px-4 py-2">创建时间</th>
              <th className="text-right px-4 py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="text-center text-slate-500 py-6">
                  加载中…
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center text-slate-500 py-6">
                  暂无用户
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="border-t">
                  <td className="px-4 py-2">{u.id}</td>
                  <td className="px-4 py-2 font-medium">{u.username}</td>
                  <td className="px-4 py-2">
                    <select
                      value={u.role}
                      onChange={(e) =>
                        onChangeRole(u, e.target.value as User['role'])
                      }
                      disabled={u.id === currentUid}
                      className="rounded border border-slate-300 px-2 py-1 disabled:opacity-60"
                    >
                      <option value="employee">员工</option>
                      <option value="kol">网红</option>
                      <option value="admin">管理员</option>
                    </select>
                  </td>
                  <td className="px-4 py-2 text-slate-500">{u.created_at}</td>
                  <td className="px-4 py-2 text-right space-x-2">
                    <button
                      onClick={() => onResetPassword(u)}
                      className="text-slate-700 hover:underline"
                    >
                      重置密码
                    </button>
                    <button
                      onClick={() => onDelete(u)}
                      disabled={u.id === currentUid}
                      className="text-red-600 hover:underline disabled:opacity-40 disabled:no-underline"
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  )
}
