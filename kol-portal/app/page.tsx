import { redirect } from 'next/navigation'
import { getServerSession, canSeeAll } from '@ai-toolbox/auth-shared'

type ToolEntry = {
  name: string
  desc: string
  href: string
  group: '我的资料' | '顶层设计' | '内容仿写'
  icon: string
}

function buildKolTools(username: string): ToolEntry[] {
  const persona = encodeURIComponent(username)
  return [
    // 我的资料 — KOL 专属视角
    {
      name: '我的问卷',
      desc: '填写 / 更新我的红人入驻问卷',
      href: '/kol-intake',
      group: '我的资料',
      icon: '📋',
    },
    {
      name: '我的素材库',
      desc: '查看我的人设、内容计划与参考素材',
      href: `/material-library?persona=${persona}`,
      group: '我的资料',
      icon: '🗂️',
    },
    // 顶层设计 — 锁定到自己
    {
      name: '对标分析助手',
      desc: '对标账号系统化拆解，输出我的人格档案与内容规划',
      href: `/benchmark-analyzer?persona=${persona}`,
      group: '顶层设计',
      icon: '🔍',
    },
    {
      name: '人设定位助手',
      desc: '基于对标分析，生成我的人格档案与内容规划',
      href: `/persona-positioning?persona=${persona}`,
      group: '顶层设计',
      icon: '🎯',
    },
    // 内容仿写 — 锁定到自己
    {
      name: '人设脚本仿写助手',
      desc: '三步完成人设内容仿写：加载风格 → 对标验证 → 仿写创作',
      href: `/persona-writer?persona=${persona}`,
      group: '内容仿写',
      icon: '✍️',
    },
    {
      name: '千川脚本仿写助手',
      desc: '千川投流素材的对标仿写',
      href: `/qianchuan-writer?persona=${persona}`,
      group: '内容仿写',
      icon: '📣',
    },
    {
      name: '种草仿写助手',
      desc: '种草内容的对标仿写，快速产出高转化文案',
      href: `/seeding-writer?persona=${persona}`,
      group: '内容仿写',
      icon: '🌱',
    },
  ]
}

const GROUPS: Array<ToolEntry['group']> = ['我的资料', '顶层设计', '内容仿写']

export default async function KolPortalHome() {
  const session = await getServerSession()

  if (!session) {
    redirect('/auth/login?next=/kol-portal')
  }

  if (canSeeAll(session)) {
    redirect('/')
  }

  const tools = buildKolTools(session.username)

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              欢迎，{session.username}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              这里是你的专属工作台。所有工具都已绑定到你的账号。
            </p>
          </div>
          <a
            href="/auth/api/logout"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
          >
            退出登录
          </a>
        </header>

        {GROUPS.map((g) => {
          const groupTools = tools.filter((t) => t.group === g)
          if (groupTools.length === 0) return null
          return (
            <section key={g} className="mb-8">
              <h2 className="mb-3 text-sm font-semibold text-slate-500">{g}</h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {groupTools.map((tool) => (
                  <a
                    key={tool.href}
                    href={tool.href}
                    className="block rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md"
                  >
                    <div className="mb-3 text-2xl">{tool.icon}</div>
                    <h3 className="text-base font-semibold text-slate-900">
                      {tool.name}
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">
                      {tool.desc}
                    </p>
                  </a>
                ))}
              </div>
            </section>
          )
        })}

        <footer className="mt-10 text-xs text-slate-400">
          角色：KOL · 账号：{session.username}
        </footer>
      </div>
    </main>
  )
}
