import { redirect } from 'next/navigation'
import { getServerSession, canSeeAll } from '@ai-toolbox/auth-shared'

type ToolEntry = {
  name: string
  desc: string
  href: string
}

function buildKolTools(username: string): ToolEntry[] {
  return [
    {
      name: '我的问卷',
      desc: '填写 / 更新我的红人入驻问卷',
      href: '/kol-intake',
    },
    {
      name: '我的素材库',
      desc: `查看我的人设、内容计划与参考素材（${username}）`,
      href: `/material-library?persona=${encodeURIComponent(username)}`,
    },
    {
      name: '人设定位报告',
      desc: '查看自己的 KOL 人设定位分析',
      href: '/persona-positioning',
    },
  ]
}

export default async function KolPortalHome() {
  const session = await getServerSession()

  if (!session) {
    redirect('/auth/login?next=/kol-portal')
  }

  if (canSeeAll(session)) {
    // 员工/admin 不应看到红人门户，回主门户
    redirect('/')
  }

  // 此时 session.role === 'kol'
  const tools = buildKolTools(session.username)

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 px-6 py-12">
      <div className="mx-auto max-w-4xl">
        <header className="mb-10">
          <h1 className="text-3xl font-bold text-slate-900">
            欢迎，{session.username}
          </h1>
          <p className="mt-2 text-slate-600">
            这里是你的专属工作台。下面的工具按你的账号过滤了内容。
          </p>
        </header>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {tools.map((tool) => (
            <a
              key={tool.href}
              href={tool.href}
              className="block rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300 hover:shadow-md"
            >
              <h2 className="text-lg font-semibold text-slate-900">{tool.name}</h2>
              <p className="mt-1 text-sm text-slate-600">{tool.desc}</p>
            </a>
          ))}
        </section>

        <footer className="mt-12 flex items-center justify-between text-sm text-slate-500">
          <span>角色：KOL · 账号：{session.username}</span>
          <a
            href="/auth/logout"
            className="text-slate-600 underline-offset-2 hover:underline"
          >
            退出登录
          </a>
        </footer>
      </div>
    </main>
  )
}
