import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiRequest } from './api.js'
import { BrandLogo } from './BrandLogo.jsx'

const BLOOD_TYPE_COLORS = {
  'A+': 'bg-red-50 text-red-700 ring-red-200',
  'A-': 'bg-rose-50 text-rose-700 ring-rose-200',
  'B+': 'bg-orange-50 text-orange-700 ring-orange-200',
  'B-': 'bg-amber-50 text-amber-700 ring-amber-200',
  'AB+': 'bg-purple-50 text-purple-700 ring-purple-200',
  'AB-': 'bg-violet-50 text-violet-700 ring-violet-200',
  'O+': 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  'O-': 'bg-teal-50 text-teal-700 ring-teal-200',
}

function rankMedal(rank) {
  if (rank === 1) return { emoji: '🥇', color: 'text-amber-500', bg: 'bg-amber-50 ring-amber-200' }
  if (rank === 2) return { emoji: '🥈', color: 'text-slate-400', bg: 'bg-slate-100 ring-slate-200' }
  if (rank === 3) return { emoji: '🥉', color: 'text-orange-400', bg: 'bg-orange-50 ring-orange-200' }
  return null
}

function RankBadge({ rank }) {
  const medal = rankMedal(rank)
  if (medal) {
    return (
      <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full ring-1 text-base ${medal.bg}`}>
        {medal.emoji}
      </span>
    )
  }
  return (
    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 ring-1 ring-slate-200 text-xs font-extrabold text-slate-500">
      {rank}
    </span>
  )
}

function DonorRow({ donor, rank }) {
  const btColor = BLOOD_TYPE_COLORS[donor.bloodType] || 'bg-slate-50 text-slate-600 ring-slate-200'
  const medal = rankMedal(rank)
  return (
    <li className={`group flex items-center gap-4 rounded-2xl border px-5 py-4 transition duration-200 ${
      rank <= 3
        ? 'border-amber-100 bg-gradient-to-r from-amber-50/60 to-white shadow-sm'
        : 'border-slate-100 bg-white hover:border-red-100 hover:bg-red-50/30'
    }`}>
      <RankBadge rank={rank} />
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {/* Avatar placeholder */}
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold text-sm ${
          rank === 1 ? 'bg-amber-100 text-amber-700' :
          rank === 2 ? 'bg-slate-200 text-slate-600' :
          rank === 3 ? 'bg-orange-100 text-orange-700' :
          'bg-red-50 text-red-600'
        }`}>
          {(donor.donorName || '?')[0].toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-slate-900">{donor.donorName || 'Anonymous'}</p>
        </div>
      </div>
      {donor.bloodType && (
        <span className={`hidden shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide ring-1 sm:inline-flex ${btColor}`}>
          {donor.bloodType}
        </span>
      )}
      <div className="shrink-0 text-right">
        <p className="text-base font-extrabold text-slate-900">{donor.totalUnitsDonated}</p>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">units</p>
      </div>
    </li>
  )
}

function OrgRow({ org, rank }) {
  return (
    <li className={`group flex items-center gap-4 rounded-2xl border px-5 py-4 transition duration-200 ${
      rank <= 3
        ? 'border-amber-100 bg-gradient-to-r from-amber-50/60 to-white shadow-sm'
        : 'border-slate-100 bg-white hover:border-red-100 hover:bg-red-50/30'
    }`}>
      <RankBadge rank={rank} />
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold text-sm ${
          rank === 1 ? 'bg-amber-100 text-amber-700' :
          rank === 2 ? 'bg-slate-200 text-slate-600' :
          rank === 3 ? 'bg-orange-100 text-orange-700' :
          'bg-emerald-50 text-emerald-600'
        }`}>
          {(org.organizationName || '?')[0].toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-slate-900">{org.organizationName || 'Unknown'}</p>
          <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide">Municipality / Organization</p>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-base font-extrabold text-slate-900">{org.totalUnitsDonated}</p>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">units</p>
      </div>
    </li>
  )
}

function EmptyState({ label }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center">
      <svg className="h-10 w-10 text-slate-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
      </svg>
      <p className="text-sm font-semibold text-slate-500">No {label} yet</p>
      <p className="mt-1 text-xs text-slate-400">Rankings will appear once donations are recorded.</p>
    </div>
  )
}

export default function Rankings() {
  const navigate = useNavigate()
  const [donors, setDonors] = useState([])
  const [orgs, setOrgs] = useState([])
  const [donorsLoading, setDonorsLoading] = useState(true)
  const [orgsLoading, setOrgsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('donors') // 'donors' | 'municipalities'

  useEffect(() => {
    let cancelled = false
    setDonorsLoading(true)
    apiRequest('/api/rankings/donors?limit=50')
      .then((data) => { if (!cancelled) setDonors(Array.isArray(data) ? data : []) })
      .catch(() => { if (!cancelled) setDonors([]) })
      .finally(() => { if (!cancelled) setDonorsLoading(false) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    setOrgsLoading(true)
    apiRequest('/api/rankings/organizations?limit=50')
      .then((data) => { if (!cancelled) setOrgs(Array.isArray(data) ? data : []) })
      .catch(() => { if (!cancelled) setOrgs([]) })
      .finally(() => { if (!cancelled) setOrgsLoading(false) })
    return () => { cancelled = true }
  }, [])

  return (
    <div className="relative min-h-screen bg-slate-50 text-slate-900">
      {/* Background glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(239,68,68,0.07)_0%,transparent_45%),radial-gradient(circle_at_85%_65%,rgba(244,63,94,0.05)_0%,transparent_45%)]"
      />

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-200/50 bg-white/85 shadow-sm backdrop-blur-md">
        <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex min-h-10 items-center gap-3 rounded-2xl px-3 py-1.5 text-left transition hover:bg-slate-100/85 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            <BrandLogo tone="light" className="h-9 w-9 shrink-0 rounded-xl" roundedClass="rounded-xl" />
            <span className="leading-tight">
              <span className="block text-base font-extrabold tracking-tight text-slate-900">
                Blood<span className="bg-gradient-to-r from-red-600 to-rose-600 bg-clip-text text-transparent">Connect</span>
              </span>
              <span className="hidden text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:block">
                Always first, always ready
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:-translate-y-0.5"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Home
          </button>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Page header */}
        <div className="mb-10 text-center">
          <span className="inline-flex rounded-full bg-red-50 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-red-600 ring-1 ring-red-100">
            Leaderboard
          </span>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Rankings
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">
            Celebrating our top contributors — donors and municipalities — who make life-saving possible.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="mb-8 flex justify-center">
          <div className="flex items-center gap-1 rounded-2xl bg-slate-100 p-1.5 shadow-inner">
            <button
              type="button"
              onClick={() => setActiveTab('donors')}
              className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition duration-200 ${
                activeTab === 'donors'
                  ? 'bg-white text-red-600 shadow ring-1 ring-slate-200/60'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Top Donors
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('municipalities')}
              className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition duration-200 ${
                activeTab === 'municipalities'
                  ? 'bg-white text-red-600 shadow ring-1 ring-slate-200/60'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              Municipalities
            </button>
          </div>
        </div>

        {/* Donor Rankings */}
        {activeTab === 'donors' && (
          <div>
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">Top Donors</h2>
                <p className="text-xs text-slate-500 mt-0.5">Ranked by total units donated</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                {donors.length} donors
              </span>
            </div>

            {donorsLoading ? (
              <ul className="space-y-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <li key={i} className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white px-5 py-4">
                    <div className="h-8 w-8 animate-pulse rounded-full bg-slate-100" />
                    <div className="h-10 w-10 animate-pulse rounded-full bg-slate-100" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-40 animate-pulse rounded-full bg-slate-100" />
                      <div className="h-2 w-24 animate-pulse rounded-full bg-slate-100" />
                    </div>
                    <div className="h-6 w-10 animate-pulse rounded-lg bg-slate-100" />
                  </li>
                ))}
              </ul>
            ) : donors.length === 0 ? (
              <EmptyState label="donor rankings" />
            ) : (
              <ul className="space-y-3">
                {donors.map((donor, idx) => (
                  <DonorRow key={donor.donorId} donor={donor} rank={idx + 1} />
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Municipality Rankings */}
        {activeTab === 'municipalities' && (
          <div>
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">Top Municipalities</h2>
                <p className="text-xs text-slate-500 mt-0.5">Ranked by total units donated</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                {orgs.length} entries
              </span>
            </div>

            {orgsLoading ? (
              <ul className="space-y-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <li key={i} className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white px-5 py-4">
                    <div className="h-8 w-8 animate-pulse rounded-full bg-slate-100" />
                    <div className="h-10 w-10 animate-pulse rounded-full bg-slate-100" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-48 animate-pulse rounded-full bg-slate-100" />
                      <div className="h-2 w-28 animate-pulse rounded-full bg-slate-100" />
                    </div>
                    <div className="h-6 w-10 animate-pulse rounded-lg bg-slate-100" />
                  </li>
                ))}
              </ul>
            ) : orgs.length === 0 ? (
              <EmptyState label="municipality rankings" />
            ) : (
              <ul className="space-y-3">
                {orgs.map((org, idx) => (
                  <OrgRow key={org.organizationId} org={org} rank={idx + 1} />
                ))}
              </ul>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-20 border-t border-slate-200 bg-white py-8">
        <p className="text-center text-xs font-semibold text-slate-400">
          &copy; {new Date().getFullYear()} BloodConnect Platform. All rights reserved.
        </p>
      </footer>
    </div>
  )
}
