import React from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import {
  BellIcon,
  MagnifyingGlassIcon,
  QuestionMarkCircleIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline'
import Sidebar from './Sidebar'
import { useCurrentUser, initials } from '../../hooks/useCurrentUser'

interface AppLayoutProps {
  children: React.ReactNode
  title?: string
}

// Pages that are top-level nav destinations — no back button needed
const TOP_LEVEL = ['/dashboard', '/anomalies', '/workflows', '/integrations', '/ai-governance', '/audit-logs', '/settings', '/onboarding']

export default function AppLayout({ children, title }: AppLayoutProps) {
  const router = useRouter()
  const user = useCurrentUser()
  const userInitials = user ? initials(user.name || user.email) : '??'
  const displayName  = user?.name  || user?.email || 'Your Account'
  const displayRole  = user?.role  || 'Admin'

  const showBack = !TOP_LEVEL.some(p => router.pathname === p)

  return (
    <>
      <Head>
        <title>{title ? `${title} — Ventura` : 'Ventura — Financial Operations Intelligence'}</title>
      </Head>
      <div className="min-h-screen flex bg-white">
        <Sidebar />

        <div className="flex-1 flex flex-col ml-64 min-h-screen">
          {/* Top bar */}
          <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 xl:px-8 2xl:px-10 flex-shrink-0 sticky top-0 z-20">
            <div className="flex items-center gap-3">
              {showBack && (
                <button
                  onClick={() => router.back()}
                  className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors pr-3 border-r border-slate-200 mr-1"
                  title="Go back"
                >
                  <ArrowLeftIcon className="w-4 h-4" />
                  Back
                </button>
              )}
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 w-64">
                <MagnifyingGlassIcon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Search anomalies, vendors, workflows…"
                  className="bg-transparent text-sm text-slate-700 placeholder-slate-400 outline-none w-full"
                />
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                <BellIcon className="w-4 h-4" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
              </button>
              <button className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                <QuestionMarkCircleIcon className="w-4 h-4" />
              </button>
              <div className="w-px h-5 bg-slate-200 mx-1" />
              <div className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 cursor-pointer transition-colors">
                <div className="w-6 h-6 bg-[#1a2d44] border border-[#2a3d5a] flex items-center justify-center">
                  <span className="text-white text-[10px] font-bold">{userInitials}</span>
                </div>
                <div className="hidden sm:block">
                  <p className="text-xs font-medium text-slate-700 leading-none">{displayName}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{displayRole}</p>
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 p-6 xl:p-8 2xl:p-10 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </>
  )
}
