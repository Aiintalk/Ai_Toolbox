'use client'

export default function LogoutButton() {
  async function handleLogout() {
    try {
      await fetch('/auth/api/logout', { method: 'POST' })
    } catch {
      // 即使失败也跳到登录页
    }
    window.location.href = '/auth/login'
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
    >
      退出登录
    </button>
  )
}
