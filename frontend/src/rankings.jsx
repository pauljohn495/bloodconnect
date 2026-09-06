import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiRequest } from './api.js'
import { BrandLogo } from './BrandLogo.jsx'
import './public-theme.css'

const BLOOD_TYPE_STYLE = 'bg-[#f7eaf0] text-[#59102f] ring-[#e8cbd7]'

function rankMedal(rank) {
  if (rank === 1) return { emoji: '🥇', color: 'text-amber-500', bg: 'bg-amber-50 ring-amber-200' }
  if (rank === 2) return { emoji: '🥈', color: 'text-zinc-400', bg: 'bg-zinc-100 ring-zinc-200' }
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
    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-zinc-50 ring-1 ring-zinc-200 text-xs font-extrabold text-zinc-500">
      {rank}
    </span>
  )
}

function DonorRow({ donor, rank }) {
  const btColor = BLOOD_TYPE_STYLE
  return (
    <li className={`group flex items-center gap-4 rounded-2xl border px-5 py-4 transition duration-200 ${
      rank <= 3
        ? 'border-[#ead2dc] bg-gradient-to-r from-[#f7eaf0] to-white shadow-sm'
        : 'border-zinc-100 bg-white hover:border-[#ead2dc] hover:bg-[#f7eaf0]/40'
    }`}>
      <RankBadge rank={rank} />
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold text-sm ${
          rank === 1 ? 'bg-[#a52f49] text-white' :
          rank === 2 ? 'bg-zinc-200 text-zinc-600' :
          rank === 3 ? 'bg-[#ebd5e0] text-[#59102f]' :
          'bg-[#f7eaf0] text-[#a52f49]'
        }`}>
          {donor.profileImageUrl ? (
            <img
              src={donor.profileImageUrl}
              alt={`${donor.donorName || 'Donor'} profile`}
              className="h-full w-full rounded-full object-cover"
            />
          ) : (
            (donor.donorName || '?')[0].toUpperCase()
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-zinc-900">{donor.donorName || 'Anonymous'}</p>
        </div>
      </div>
      {donor.bloodType && (
        <span className={`hidden shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide ring-1 sm:inline-flex ${btColor}`}>
          {donor.bloodType}
        </span>
      )}
      <div className="shrink-0 text-right">
        <p className="text-base font-extrabold text-zinc-900">{donor.totalUnitsDonated}</p>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">units</p>
      </div>
    </li>
  )
}

function OrgRow({ org, rank }) {
  return (
    <li className={`group flex items-center gap-4 rounded-2xl border px-5 py-4 transition duration-200 ${
      rank <= 3
        ? 'border-[#ead2dc] bg-gradient-to-r from-[#f7eaf0] to-white shadow-sm'
        : 'border-zinc-100 bg-white hover:border-[#ead2dc] hover:bg-[#f7eaf0]/40'
    }`}>
      <RankBadge rank={rank} />
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold text-sm ${
          rank === 1 ? 'bg-[#a52f49] text-white' :
          rank === 2 ? 'bg-zinc-200 text-zinc-600' :
          rank === 3 ? 'bg-[#ebd5e0] text-[#59102f]' :
          'bg-[#f7eaf0] text-[#82203e]'
        }`}>
          {(org.organizationName || '?')[0].toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-zinc-900">{org.organizationName || 'Unknown'}</p>
          <p className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wide">Organization</p>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-base font-extrabold text-zinc-900">{org.totalUnitsDonated}</p>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">units</p>
      </div>
    </li>
  )
}

function MunicipalityRow({ municipality, rank }) {
  return (
    <li className="group flex items-center gap-4 rounded-2xl border border-zinc-100 bg-white px-5 py-4 transition hover:border-[#ead2dc] hover:bg-[#f7eaf0]/40">
      <RankBadge rank={rank} />
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f7eaf0] text-sm font-bold text-[#82203e]">
          {(municipality.municipalityName || '?')[0].toUpperCase()}
        </div>
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-zinc-900">{municipality.municipalityName}</p><p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Municipality</p></div>
      </div>
      <div className="shrink-0 text-right"><p className="text-base font-extrabold text-zinc-900">{municipality.donorCount}</p><p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">donors</p></div>
    </li>
  )
}

function EmptyState({ label }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-200 py-16 text-center">
      <svg className="h-10 w-10 text-zinc-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
      </svg>
      <p className="text-sm font-semibold text-zinc-500">No {label} yet</p>
      <p className="mt-1 text-xs text-zinc-400">Rankings will appear once donations are recorded.</p>
    </div>
  )
}

export default function Rankings() {
  const navigate = useNavigate()
  const [donors, setDonors] = useState([])
  const [orgs, setOrgs] = useState([])
  const [municipalities, setMunicipalities] = useState([])
  const [donorsLoading, setDonorsLoading] = useState(true)
  const [orgsLoading, setOrgsLoading] = useState(true)
  const [municipalitiesLoading, setMunicipalitiesLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('donors')

  useEffect(() => {
    let cancelled = false
    apiRequest('/api/rankings/donors?limit=50')
      .then((data) => { if (!cancelled) setDonors(Array.isArray(data) ? data : []) })
      .catch(() => { if (!cancelled) setDonors([]) })
      .finally(() => { if (!cancelled) setDonorsLoading(false) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    apiRequest('/api/rankings/municipalities?limit=50')
      .then((data) => { if (!cancelled) setMunicipalities(Array.isArray(data) ? data : []) })
      .catch(() => { if (!cancelled) setMunicipalities([]) })
      .finally(() => { if (!cancelled) setMunicipalitiesLoading(false) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    apiRequest('/api/rankings/organizations?limit=50')
      .then((data) => { if (!cancelled) setOrgs(Array.isArray(data) ? data : []) })
      .catch(() => { if (!cancelled) setOrgs([]) })
      .finally(() => { if (!cancelled) setOrgsLoading(false) })
    return () => { cancelled = true }
  }, [])

  return (
    <div className="bc-public-page relative min-h-screen bg-white text-zinc-900">

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-zinc-200/50 bg-white/85 shadow-sm backdrop-blur-md">
        <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex min-h-10 items-center gap-3 rounded-2xl px-3 py-1.5 text-left transition hover:bg-zinc-100/85 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#a52f49]"
          >
            <BrandLogo tone="light" className="h-9 w-9 shrink-0 rounded-xl" roundedClass="rounded-xl" />
            <span className="leading-tight">
              <span className="block text-base font-extrabold tracking-tight text-zinc-900">
                Blood<span className="bg-gradient-to-r from-[#a52f49] to-[#59102f] bg-clip-text text-transparent">Connect</span>
              </span>
              <span className="hidden text-[10px] font-bold uppercase tracking-wider text-zinc-400 sm:block">
                Always first, always ready
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50 hover:-translate-y-0.5"
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
        <div className="bc-ranking-intro mb-10 text-center">
          <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-white ring-1 ring-white/30">
            Leaderboard
          </span>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Rankings
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-sm text-white/85">
            Celebrating our top contributors — donors and organizations — who make life-saving possible.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="mb-8 flex justify-center">
          <div className="bc-ranking-tabs flex items-center gap-1 rounded-2xl bg-zinc-100 p-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('donors')}
              aria-pressed={activeTab === 'donors'}
              className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition duration-200 ${
                activeTab === 'donors'
                  ? 'bg-white text-[#a52f49] shadow ring-1 ring-zinc-200/60'
                  : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Top Donors
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('organizations')}
              aria-pressed={activeTab === 'organizations'}
              className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition duration-200 ${
                activeTab === 'organizations'
                  ? 'bg-white text-[#a52f49] shadow ring-1 ring-zinc-200/60'
                  : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              Organizations
            </button>
            <button type="button" aria-pressed={activeTab === 'municipalities'} onClick={() => setActiveTab('municipalities')} className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition duration-200 ${activeTab === 'municipalities' ? 'bg-white text-[#a52f49] shadow ring-1 ring-zinc-200/60' : 'text-zinc-500 hover:text-zinc-800'}`}>
              Municipalities
            </button>
          </div>
        </div>

        {/* Donor Rankings */}
        {activeTab === 'donors' && (
          <div>
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-extrabold text-zinc-900">Top Donors</h2>
                <p className="text-xs text-zinc-500 mt-0.5">Ranked by total units donated</p>
              </div>
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold text-zinc-600">
                {donors.length} donors
              </span>
            </div>

            {donorsLoading ? (
              <ul className="space-y-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <li key={i} className="flex items-center gap-4 rounded-2xl border border-zinc-100 bg-white px-5 py-4">
                    <div className="h-8 w-8 animate-pulse rounded-full bg-zinc-100" />
                    <div className="h-10 w-10 animate-pulse rounded-full bg-zinc-100" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-40 animate-pulse rounded-full bg-zinc-100" />
                      <div className="h-2 w-24 animate-pulse rounded-full bg-zinc-100" />
                    </div>
                    <div className="h-6 w-10 animate-pulse rounded-lg bg-zinc-100" />
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
        {activeTab === 'organizations' && (
          <div>
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-extrabold text-zinc-900">Top Organizations</h2>
                <p className="text-xs text-zinc-500 mt-0.5">Ranked by total units donated</p>
              </div>
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold text-zinc-600">
                {orgs.length} entries
              </span>
            </div>

            {orgsLoading ? (
              <ul className="space-y-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <li key={i} className="flex items-center gap-4 rounded-2xl border border-zinc-100 bg-white px-5 py-4">
                    <div className="h-8 w-8 animate-pulse rounded-full bg-zinc-100" />
                    <div className="h-10 w-10 animate-pulse rounded-full bg-zinc-100" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-48 animate-pulse rounded-full bg-zinc-100" />
                      <div className="h-2 w-28 animate-pulse rounded-full bg-zinc-100" />
                    </div>
                    <div className="h-6 w-10 animate-pulse rounded-lg bg-zinc-100" />
                  </li>
                ))}
              </ul>
            ) : orgs.length === 0 ? (
              <EmptyState label="organizations rankings" />
            ) : (
              <ul className="space-y-3">
                {orgs.map((org, idx) => (
                  <OrgRow key={org.organizationId} org={org} rank={idx + 1} />
                ))}
              </ul>
            )}
          </div>
        )}

        {activeTab === 'municipalities' && (
          <div>
            <div className="mb-5 flex items-center justify-between"><div><h2 className="text-lg font-extrabold text-zinc-900">Top Municipalities</h2><p className="mt-0.5 text-xs text-zinc-500">Ranked by registered MBD donors</p></div><span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold text-zinc-600">{municipalities.length} entries</span></div>
            {municipalitiesLoading ? <div className="py-12 text-center text-sm text-zinc-500">Loading municipalities...</div> : municipalities.length === 0 ? <EmptyState label="municipality rankings" /> : <ul className="space-y-3">{municipalities.map((municipality, idx) => <MunicipalityRow key={municipality.municipalityId} municipality={municipality} rank={idx + 1} />)}</ul>}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-20 border-t border-zinc-200 bg-white py-8">
        <p className="text-center text-xs font-semibold text-zinc-400">
          &copy; {new Date().getFullYear()} BloodConnect Platform. All rights reserved.
        </p>
      </footer>
    </div>
  )
}
