import { useState, useEffect } from 'react'
import AdminLayout from './AdminLayout.jsx'
import { apiRequest } from './api.js'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Label,
  LabelList,
} from 'recharts'

function AdminReports() {
  const [activeTab, setActiveTab] = useState('analytics') // 'analytics' | 'reports'
  const [predictions, setPredictions] = useState(null)
  const [prescriptions, setPrescriptions] = useState(null)
  const [historicalWastage, setHistoricalWastage] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [componentFilter, setComponentFilter] = useState('all') // 'all', 'whole_blood', 'platelets', 'plasma'

  const loadAnalytics = async () => {
    try {
      setIsLoading(true)
      setError('')
      const [predData, prescData, histData] = await Promise.all([
        apiRequest('/api/admin/analytics/wastage-predictions'),
        apiRequest('/api/admin/analytics/wastage-prescriptions'),
        apiRequest('/api/admin/analytics/historical-wastage?days=90'),
      ])
      setPredictions(predData)
      setPrescriptions(prescData)
      setHistoricalWastage(histData)
    } catch (err) {
      setError(err.message || 'Failed to load analytics')
      console.error('Analytics error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const loadReports = async () => {
    try {
      setIsLoading(true)
      setError('')
      const [prescData, histData] = await Promise.all([
        apiRequest('/api/admin/analytics/wastage-prescriptions'),
        apiRequest('/api/admin/analytics/historical-wastage?days=90'),
      ])
      setPrescriptions(prescData)
      setHistoricalWastage(histData)
    } catch (err) {
      setError(err.message || 'Failed to load reports')
      console.error('Reports error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'analytics') {
      loadAnalytics()
    } else if (activeTab === 'reports') {
      loadReports()
    }
  }, [activeTab])

  // Improved color palette for better distinction
  const COLORS = [
    '#dc2626', // Red - High risk
    '#ea580c', // Orange
    '#f59e0b', // Amber
    '#10b981', // Green
    '#2563eb', // Blue
    '#7c3aed', // Violet
    '#ec4899', // Pink
    '#14b8a6', // Teal
  ]

  const getRiskColor = (score) => {
    if (score >= 70) return 'text-red-600 bg-red-50 ring-red-100'
    if (score >= 50) return 'text-orange-600 bg-orange-50 ring-orange-100'
    return 'text-yellow-600 bg-yellow-50 ring-yellow-100'
  }

  const getPriorityColor = (priority) => {
    if (priority === 'critical' || priority === 'high') return 'text-red-600 bg-red-50 ring-red-100'
    if (priority === 'medium') return 'text-orange-600 bg-orange-50 ring-orange-100'
    return 'text-blue-600 bg-blue-50 ring-blue-100'
  }

  // Prepare chart data - filter predicted wastage by component type if filter is set
  const wastageForecastData = predictions
    ? (() => {
        // If component filter is set, calculate wastage only for that component type
        if (componentFilter !== 'all' && predictions.inventoryWithRisk) {
          const filteredInventory = predictions.inventoryWithRisk.filter(
            (item) => (item.component_type || 'whole_blood') === componentFilter,
          )
          const predictWastage = (days) => {
            const expiringSoon = filteredInventory.filter(
              (item) => item.days_until_expiry <= days && item.days_until_expiry > 0,
            )
            const avgWastageRate = 0.15
            return expiringSoon.reduce((sum, item) => {
              const wastageProbability = item.riskScore / 100
              return sum + Math.round(item.available_units * wastageProbability * avgWastageRate)
            }, 0)
          }
          return [
            { period: 'Next 7 Days', predicted: predictWastage(7) },
            { period: 'Next 14 Days', predicted: predictWastage(14) },
            { period: 'Next 30 Days', predicted: predictWastage(30) },
          ]
        }
        // Otherwise use original predictions
        return [
          { period: 'Next 7 Days', predicted: predictions.predictedWastage.next7Days },
          { period: 'Next 14 Days', predicted: predictions.predictedWastage.next14Days },
          { period: 'Next 30 Days', predicted: predictions.predictedWastage.next30Days },
        ]
      })()
    : []

  // Filter wastage by component type if filter is set
  const wastageByBloodTypeData = (predictions?.wastageByBloodType || []).filter((item) => {
    if (componentFilter === 'all') return true
    return (item.componentType || 'whole_blood') === componentFilter
  })

  // Group historical wastage by date and component type, filter by componentFilter
  const historicalChartData = historicalWastage?.wastageByDate
    ? historicalWastage.wastageByDate
        .filter((item) => {
          if (componentFilter === 'all') return true
          return (item.component_type || 'whole_blood') === componentFilter
        })
        .reduce((acc, item) => {
          const date = item.date
          const existing = acc.find((a) => a.date === date)
          if (existing) {
            existing.total += item.wasted_units || 0
          } else {
            acc.push({ date, total: item.wasted_units || 0 })
          }
          return acc
        }, [])
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(-30) // Last 30 days
    : []

  // Use historicalChartData directly (already aggregated by date)
  const aggregatedChartData = historicalChartData

  return (
    <AdminLayout pageTitle="Reports & Analytics" pageDescription="View detailed reports and system analytics.">
      {/* Tabs and Component Filter */}
      <div className="mb-4 flex items-center justify-between border-b border-slate-200">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('analytics')}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition ${
              activeTab === 'analytics'
                ? 'border-red-600 text-red-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Analytics
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('reports')}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition ${
              activeTab === 'reports'
                ? 'border-red-600 text-red-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Reports
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-600">Filter:</span>
          <button
            type="button"
            onClick={() => setComponentFilter('all')}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              componentFilter === 'all'
                ? 'bg-red-600 text-white'
                : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setComponentFilter('whole_blood')}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              componentFilter === 'whole_blood'
                ? 'bg-red-600 text-white'
                : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            Whole Blood
          </button>
          <button
            type="button"
            onClick={() => setComponentFilter('platelets')}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              componentFilter === 'platelets'
                ? 'bg-red-600 text-white'
                : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            Platelets
          </button>
          <button
            type="button"
            onClick={() => setComponentFilter('plasma')}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              componentFilter === 'plasma'
                ? 'bg-red-600 text-white'
                : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            Plasma
          </button>
        </div>
      </div>

      {/* Analytics content */}
      {activeTab === 'analytics' && (
        <>
          {isLoading ? (
            <div className="mt-4 rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-100">
              <p className="text-sm text-slate-500">Loading analytics...</p>
            </div>
          ) : error ? (
            <div className="mt-4 rounded-2xl bg-red-50 p-4 shadow-sm ring-1 ring-red-100">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
                  <p className="text-[11px] font-medium text-slate-500">Total At Risk</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-900">
                    {componentFilter === 'all'
                      ? predictions?.summary?.totalAtRisk || 0
                      : predictions?.inventoryWithRisk
                          ?.filter((item) => (item.component_type || 'whole_blood') === componentFilter)
                          .reduce((sum, item) => sum + item.available_units, 0) || 0}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-400">units</p>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
                  <p className="text-[11px] font-medium text-slate-500">High Risk Items</p>
                  <p className="mt-1 text-2xl font-semibold text-red-600">
                    {componentFilter === 'all'
                      ? predictions?.summary?.highRiskItems || 0
                      : predictions?.inventoryWithRisk?.filter(
                          (item) => item.riskScore >= 70 && (item.component_type || 'whole_blood') === componentFilter,
                        ).length || 0}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-400">items</p>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
                  <p className="text-[11px] font-medium text-slate-500">Avg Risk Score</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-900">
                    {(() => {
                      if (componentFilter === 'all') return predictions?.summary?.averageRiskScore || 0
                      const filtered = predictions?.inventoryWithRisk?.filter(
                        (item) => (item.component_type || 'whole_blood') === componentFilter,
                      ) || []
                      return filtered.length > 0
                        ? Math.round(filtered.reduce((sum, item) => sum + item.riskScore, 0) / filtered.length)
                        : 0
                    })()}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-400">out of 100</p>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
                  <p className="text-[11px] font-medium text-slate-500">Recommendations</p>
                  <p className="mt-1 text-2xl font-semibold text-blue-600">
                    {componentFilter === 'all'
                      ? prescriptions?.summary?.totalRecommendations || 0
                      : prescriptions?.transferRecommendations?.filter(
                          (rec) => (rec.componentType || 'whole_blood') === componentFilter,
                        ).length || 0}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-400">actions available</p>
                </div>
              </section>

              {/* Predictive Analytics Section */}
              <section className="mt-6 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
                <div className="border-b border-slate-100 px-6 py-4">
                  <p className="text-base font-semibold text-slate-900">Predictive Analytics</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Wastage risk predictions and forecasts based on current inventory
                  </p>
                </div>
                <div className="p-6">
                  {/* Wastage Forecast Chart */}
                  <div className="mb-10">
                    <h3 className="mb-4 text-sm font-semibold text-slate-900">Predicted Wastage Forecast</h3>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={wastageForecastData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
                        <XAxis
                          dataKey="period"
                          tick={{ fontSize: 13, fill: '#475569', fontWeight: 500 }}
                          stroke="#64748b"
                          tickLine={{ stroke: '#64748b' }}
                        >
                          <Label value="Time Period" offset={-5} position="insideBottom" style={{ fontSize: 13, fill: '#64748b', fontWeight: 600 }} />
                        </XAxis>
                        <YAxis
                          tick={{ fontSize: 13, fill: '#475569', fontWeight: 500 }}
                          stroke="#64748b"
                          tickLine={{ stroke: '#64748b' }}
                        >
                          <Label
                            value="Predicted Units"
                            angle={-90}
                            position="insideLeft"
                            style={{ fontSize: 13, fill: '#64748b', fontWeight: 600 }}
                          />
                        </YAxis>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'white',
                            border: '2px solid #e2e8f0',
                            borderRadius: '8px',
                            fontSize: '13px',
                            fontWeight: 500,
                            padding: '10px',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                          }}
                          formatter={(value) => [`${value} units`, 'Predicted Wastage']}
                          labelStyle={{ fontWeight: 600, marginBottom: '5px' }}
                        />
                        <Legend
                          wrapperStyle={{ fontSize: '13px', fontWeight: 500, paddingTop: '10px' }}
                        />
                        <Bar
                          dataKey="predicted"
                          fill="#dc2626"
                          radius={[6, 6, 0, 0]}
                          name="Predicted Wastage (units)"
                        >
                          <LabelList
                            dataKey="predicted"
                            position="top"
                            style={{ fontSize: 12, fill: '#1e293b', fontWeight: 600 }}
                            formatter={(value) => `${value}`}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Risk by Blood Type & Component Type */}
                  {wastageByBloodTypeData.length > 0 && (
                    <div className="mb-10">
                      <h3 className="mb-4 text-sm font-semibold text-slate-900">
                        Risk by Blood Type & Component
                        {componentFilter !== 'all' && (
                          <span className="ml-2 text-xs font-normal text-slate-500">
                            ({componentFilter === 'whole_blood' ? 'Whole Blood' : componentFilter === 'platelets' ? 'Platelets' : 'Plasma'})
                          </span>
                        )}
                      </h3>
                      <ResponsiveContainer width="100%" height={320}>
                        <PieChart>
                          <Pie
                            data={wastageByBloodTypeData}
                            dataKey="totalAtRisk"
                            nameKey="bloodType"
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            innerRadius={40}
                            label={({ bloodType, componentType, totalAtRisk, percent }) => {
                              const componentLabel = componentType === 'whole_blood' ? 'WB' : componentType === 'platelets' ? 'PLT' : 'PLA'
                              return `${bloodType} ${componentLabel}\n${totalAtRisk} units\n(${(percent * 100).toFixed(1)}%)`
                            }}
                            labelLine={{ stroke: '#475569', strokeWidth: 1 }}
                            style={{ fontSize: 12, fontWeight: 500 }}
                          >
                            {wastageByBloodTypeData.map((entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={COLORS[index % COLORS.length]}
                                stroke="#ffffff"
                                strokeWidth={2}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'white',
                              border: '2px solid #e2e8f0',
                              borderRadius: '8px',
                              fontSize: '13px',
                              fontWeight: 500,
                              padding: '10px',
                              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                            }}
                            formatter={(value, name, props) => {
                              const componentLabel = props.payload.componentType === 'whole_blood' ? 'Whole Blood' : props.payload.componentType === 'platelets' ? 'Platelets' : 'Plasma'
                              const total = wastageByBloodTypeData.reduce((sum, item) => sum + item.totalAtRisk, 0)
                              return [
                                `${value} units (${total > 0 ? ((value / total) * 100).toFixed(1) : 0}%)`,
                                `${props.payload.bloodType} ${componentLabel}`,
                              ]
                            }}
                            labelStyle={{ fontWeight: 600, marginBottom: '5px' }}
                          />
                          <Legend
                            verticalAlign="bottom"
                            height={36}
                            wrapperStyle={{ fontSize: '13px', fontWeight: 500, paddingTop: '15px' }}
                            formatter={(value, entry) => {
                              const componentLabel = entry.payload.componentType === 'whole_blood' ? 'Whole Blood' : entry.payload.componentType === 'platelets' ? 'Platelets' : 'Plasma'
                              return `${entry.payload.bloodType} ${componentLabel}: ${entry.payload.totalAtRisk} units`
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* High Risk Inventory Table - prominent card with color */}
                  <div className="rounded-xl border-2 border-red-200 bg-red-50/30 ring-1 ring-red-100">
                    <div className="flex items-center gap-2 border-b border-red-200/60 px-4 py-3 bg-red-100/50">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-600 text-white" aria-hidden>
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </span>
                      <h3 className="text-sm font-bold text-red-900">
                        High Risk Inventory Items
                        {componentFilter !== 'all' && (
                          <span className="ml-2 text-sm font-normal text-red-700">
                            ({componentFilter === 'whole_blood' ? 'Whole Blood' : componentFilter === 'platelets' ? 'Platelets' : 'Plasma'})
                          </span>
                        )}
                      </h3>
                    </div>
                    <div className="overflow-x-auto p-4">
                      <table className="min-w-full divide-y divide-red-200/60 text-sm">
                        <thead>
                          <tr className="bg-red-100/40">
                            <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-red-800">
                              Blood Type
                            </th>
                            <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-red-800">
                              Component Type
                            </th>
                            <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-red-800">
                              Units
                            </th>
                            <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-red-800">
                              Days Until Expiry
                            </th>
                            <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-red-800">
                              Risk Score
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-red-200/40 bg-white/80">
                          {predictions?.inventoryWithRisk
                            ?.filter((item) => {
                              if (item.riskScore < 50) return false
                              if (componentFilter === 'all') return true
                              return (item.component_type || 'whole_blood') === componentFilter
                            })
                            .slice(0, 10)
                            .map((item) => {
                              const isCritical = item.riskScore >= 70
                              const isHigh = item.riskScore >= 50 && item.riskScore < 70
                              const rowBg = isCritical ? 'bg-red-100/50' : isHigh ? 'bg-amber-50/60' : 'bg-white'
                              return (
                                <tr key={item.id} className={`${rowBg} hover:opacity-90 transition`}>
                                  <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">
                                    {item.blood_type}
                                  </td>
                                  <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-700">
                                    {item.component_type === 'whole_blood' ? 'Whole Blood' : item.component_type === 'platelets' ? 'Platelets' : item.component_type === 'plasma' ? 'Plasma' : 'Whole Blood'}
                                  </td>
                                  <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-700">
                                    {item.available_units}
                                  </td>
                                  <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-700">
                                    {item.days_until_expiry} days
                                  </td>
                                  <td className="whitespace-nowrap px-4 py-3">
                                    <span
                                      className={`inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-sm font-bold ring-2 ${getRiskColor(
                                        item.riskScore,
                                      )}`}
                                    >
                                      {item.riskScore}
                                    </span>
                                  </td>
                                </tr>
                              )
                            }) || (
                            <tr>
                              <td className="px-4 py-6 text-center text-sm text-slate-500" colSpan={5}>
                                No high-risk items found
                                {componentFilter !== 'all' && ` for ${componentFilter === 'whole_blood' ? 'Whole Blood' : componentFilter === 'platelets' ? 'Platelets' : 'Plasma'}`}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </section>

              {/* Prescriptive Analytics Section - prominent card with color */}
              <section className="mt-6 overflow-hidden rounded-xl border-2 border-blue-200 bg-blue-50/20 ring-1 ring-blue-100">
                <div className="flex items-center gap-2 border-b border-blue-200/60 px-4 py-3 bg-blue-100/50">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white" aria-hidden>
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </span>
                  <div>
                    <p className="text-sm font-bold text-blue-900">Prescriptive Analytics</p>
                    <p className="text-xs text-blue-700">
                      Actionable recommendations to reduce wastage
                    </p>
                  </div>
                </div>
                <div className="p-6">
                  {/* Priority Actions */}
                  {(() => {
                    const filteredActions = (prescriptions?.priorityActions || []).filter((action) => {
                      if (componentFilter === 'all') return true
                      return !action.componentType || action.componentType === componentFilter
                    })
                    return filteredActions.length > 0 ? (
                      <div className="mb-8">
                        <h3 className="mb-4 text-base font-bold text-blue-900">
                          Priority Actions
                          {componentFilter !== 'all' && (
                            <span className="ml-2 text-sm font-normal text-blue-700">
                              ({componentFilter === 'whole_blood' ? 'Whole Blood' : componentFilter === 'platelets' ? 'Platelets' : 'Plasma'})
                            </span>
                          )}
                        </h3>
                        <div className="space-y-4">
                          {filteredActions.map((action, index) => (
                          <div
                            key={index}
                            className={`rounded-xl border-2 p-5 ring-1 ${getPriorityColor(action.priority)}`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span
                                    className={`inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-bold uppercase ring-2 ${getPriorityColor(
                                      action.priority,
                                    )}`}
                                  >
                                    {action.priority}
                                  </span>
                                  <p className="text-base font-semibold text-slate-900">{action.title}</p>
                                </div>
                                <p className="mt-3 text-sm text-slate-600">{action.description}</p>
                                <p className="mt-3 text-sm font-semibold text-slate-700">
                                  💡 {action.action}
                                </p>
                                {action.bloodTypes && (
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {action.bloodTypes.map((bt) => (
                                      <span
                                        key={bt}
                                        className="inline-flex items-center rounded-lg bg-slate-200/80 px-3 py-1.5 text-sm font-medium text-slate-800"
                                      >
                                        {bt}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                {action.componentType && (
                                  <div className="mt-2">
                                    <span className="inline-flex items-center rounded-lg bg-blue-200 px-3 py-1.5 text-sm font-medium text-blue-800">
                                      Component: {action.componentType === 'whole_blood' ? 'Whole Blood' : action.componentType === 'platelets' ? 'Platelets' : 'Plasma'}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          ))}
                        </div>
                      </div>
                    ) : null
                  })()}

                  {/* Transfer Recommendations */}
                  {(() => {
                    const filteredRecommendations = (prescriptions?.transferRecommendations || []).filter(
                      (rec) => {
                        if (componentFilter === 'all') return true
                        return (rec.componentType || 'whole_blood') === componentFilter
                      },
                    )
                    return filteredRecommendations.length > 0 ? (
                      <div className="rounded-xl border-2 border-blue-200/60 bg-white/60 overflow-hidden">
                        <div className="flex items-center gap-2 border-b border-blue-200/60 px-4 py-3 bg-blue-100/40">
                          <h3 className="text-sm font-bold text-blue-900">
                            Transfer Recommendations
                            {componentFilter !== 'all' && (
                              <span className="ml-2 text-sm font-normal text-blue-700">
                                ({componentFilter === 'whole_blood' ? 'Whole Blood' : componentFilter === 'platelets' ? 'Platelets' : 'Plasma'})
                              </span>
                            )}
                          </h3>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-blue-200/50 text-sm">
                            <thead>
                              <tr className="bg-blue-100/40">
                                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-blue-800">Priority</th>
                                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-blue-800">Blood Type</th>
                                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-blue-800">Component Type</th>
                                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-blue-800">Units</th>
                                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-blue-800">Days Until Expiry</th>
                                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-blue-800">Transfer To</th>
                                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-blue-800">Impact</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-blue-200/40 bg-white/80">
                              {filteredRecommendations.map((rec, index) => {
                                const isCritical = rec.priority === 'critical' || rec.priority === 'high'
                                const isMedium = rec.priority === 'medium'
                                const rowBg = isCritical ? 'bg-red-50/50' : isMedium ? 'bg-amber-50/50' : 'bg-blue-50/30'
                                return (
                                  <tr key={index} className={`${rowBg} hover:opacity-90 transition`}>
                                    <td className="whitespace-nowrap px-4 py-3">
                                      <span
                                        className={`inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-bold uppercase ring-2 ${getPriorityColor(
                                          rec.priority,
                                        )}`}
                                      >
                                        {rec.priority}
                                      </span>
                                    </td>
                                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">
                                      {rec.bloodType}
                                    </td>
                                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-700">
                                      {rec.componentType === 'whole_blood' ? 'Whole Blood' : rec.componentType === 'platelets' ? 'Platelets' : rec.componentType === 'plasma' ? 'Plasma' : 'Whole Blood'}
                                    </td>
                                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-700">{rec.units}</td>
                                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-700">
                                      {rec.daysUntilExpiry} days
                                    </td>
                                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-700">
                                      {rec.targetHospitalName}
                                    </td>
                                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                                      {rec.impact}
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : null
                  })()}
                </div>
              </section>
            </>
          )}
        </>
      )}

      {/* Reports content */}
      {activeTab === 'reports' && (
        <>
          {isLoading ? (
            <div className="mt-4 rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-100">
              <p className="text-sm text-slate-500">Loading reports...</p>
            </div>
          ) : error ? (
            <div className="mt-4 rounded-2xl bg-red-50 p-4 shadow-sm ring-1 ring-red-100">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
                  <p className="text-[11px] font-medium text-slate-500">Total Wastage (90 days)</p>
                  <p className="mt-1 text-2xl font-semibold text-red-600">
                    {(() => {
                      if (componentFilter === 'all') {
                        return historicalWastage?.totalWastage !== undefined
                          ? Number(historicalWastage.totalWastage)
                          : historicalWastage?.wastageByBloodType
                            ? historicalWastage.wastageByBloodType.reduce(
                                (sum, item) => sum + Number(item.total_wasted || 0),
                                0,
                              )
                            : 0
                      }
                      // Filter by component type
                      return (historicalWastage?.wastageByBloodType || [])
                        .filter((item) => (item.component_type || 'whole_blood') === componentFilter)
                        .reduce((sum, item) => sum + Number(item.total_wasted || 0), 0)
                    })()}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-400">units wasted</p>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
                  <p className="text-[11px] font-medium text-slate-500">Wastage Reduction Potential</p>
                  <p className="mt-1 text-2xl font-semibold text-blue-600">
                    {componentFilter === 'all'
                      ? prescriptions?.summary?.estimatedWastageReduction || 0
                      : (prescriptions?.transferRecommendations || [])
                          .filter((rec) => (rec.componentType || 'whole_blood') === componentFilter)
                          .reduce((sum, rec) => sum + (rec.units || 0), 0)}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-400">units if recommendations followed</p>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
                  <p className="text-[11px] font-medium text-slate-500">Critical Actions</p>
                  <p className="mt-1 text-2xl font-semibold text-orange-600">
                    {componentFilter === 'all'
                      ? prescriptions?.summary?.criticalActions || 0
                      : (prescriptions?.priorityActions || []).filter(
                          (action) =>
                            action.priority === 'critical' &&
                            (!action.componentType || action.componentType === componentFilter),
                        ).length}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-400">urgent items</p>
                </div>
              </section>

              {/* Historical Wastage Chart */}
              <section className="mt-6">
                <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
                  <h3 className="mb-5 text-base font-semibold text-slate-900">Historical Wastage Trend (Last 30 Days)</h3>
                  {aggregatedChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={350}>
                      <LineChart data={aggregatedChartData} margin={{ top: 20, right: 30, left: 20, bottom: 30 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 13, fill: '#475569', fontWeight: 500 }}
                          stroke="#64748b"
                          tickLine={{ stroke: '#64748b' }}
                          tickFormatter={(value) => {
                            const date = new Date(value)
                            return `${date.getMonth() + 1}/${date.getDate()}`
                          }}
                        >
                          <Label value="Date" offset={-5} position="insideBottom" style={{ fontSize: 13, fill: '#64748b', fontWeight: 600 }} />
                        </XAxis>
                        <YAxis
                          tick={{ fontSize: 13, fill: '#475569', fontWeight: 500 }}
                          stroke="#64748b"
                          tickLine={{ stroke: '#64748b' }}
                        >
                          <Label
                            value="Wasted Units"
                            angle={-90}
                            position="insideLeft"
                            style={{ fontSize: 13, fill: '#64748b', fontWeight: 600 }}
                          />
                        </YAxis>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'white',
                            border: '2px solid #e2e8f0',
                            borderRadius: '8px',
                            fontSize: '13px',
                            fontWeight: 500,
                            padding: '10px',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                          }}
                          labelFormatter={(value) => {
                            const date = new Date(value)
                            return `Date: ${date.toLocaleDateString()}`
                          }}
                          formatter={(value) => [`${value} units`, 'Wasted']}
                          labelStyle={{ fontWeight: 600, marginBottom: '5px' }}
                        />
                        <Legend
                          wrapperStyle={{ fontSize: '13px', fontWeight: 500, paddingTop: '10px' }}
                        />
                        <Line
                          type="monotone"
                          dataKey="total"
                          stroke="#dc2626"
                          strokeWidth={3}
                          name="Wasted Units"
                          dot={{ r: 5, fill: '#dc2626', strokeWidth: 2, stroke: '#ffffff' }}
                          activeDot={{ r: 7, fill: '#dc2626' }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-[350px] items-center justify-center">
                      <p className="text-sm text-slate-400">No historical wastage data available</p>
                    </div>
                  )}
                </div>
              </section>

              {/* Wastage Distribution - full width */}
              <section className="mt-6">
                <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
                  <h3 className="mb-5 text-base font-semibold text-slate-900">
                    Wastage Distribution (90 days)
                    {componentFilter !== 'all' && (
                      <span className="ml-2 text-sm font-normal text-slate-500">
                        ({componentFilter === 'whole_blood' ? 'Whole Blood' : componentFilter === 'platelets' ? 'Platelets' : 'Plasma'})
                      </span>
                    )}
                  </h3>
                  {(() => {
                    const filteredData = (historicalWastage?.wastageByBloodType || []).filter((item) => {
                      if (componentFilter === 'all') return true
                      return (item.component_type || 'whole_blood') === componentFilter
                    })
                    return Array.isArray(filteredData) && filteredData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={420}>
                      <PieChart>
                        <Pie
                          data={filteredData}
                          dataKey="total_wasted"
                          nameKey="blood_type"
                          cx="50%"
                          cy="50%"
                          outerRadius={140}
                          innerRadius={56}
                          label={({ blood_type, component_type, total_wasted, percent }) => {
                            const componentLabel = component_type === 'whole_blood' ? 'WB' : component_type === 'platelets' ? 'PLT' : 'PLA'
                            return `${blood_type} ${componentLabel}\n${total_wasted} units\n(${(percent * 100).toFixed(1)}%)`
                          }}
                          labelLine={{ stroke: '#475569', strokeWidth: 1 }}
                          style={{ fontSize: 12, fontWeight: 500 }}
                        >
                          {filteredData.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={COLORS[index % COLORS.length]}
                              stroke="#ffffff"
                              strokeWidth={2}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'white',
                            border: '2px solid #e2e8f0',
                            borderRadius: '8px',
                            fontSize: '13px',
                            fontWeight: 500,
                            padding: '10px',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                          }}
                          formatter={(value, name, props) => {
                            const total = filteredData.reduce(
                              (sum, item) => sum + (item.total_wasted || 0),
                              0,
                            )
                            const componentLabel = props.payload.component_type === 'whole_blood' ? 'Whole Blood' : props.payload.component_type === 'platelets' ? 'Platelets' : 'Plasma'
                            return [
                              `${value} units (${total > 0 ? ((value / total) * 100).toFixed(1) : 0}%)`,
                              `${props.payload.blood_type} ${componentLabel}`,
                            ]
                          }}
                          labelStyle={{ fontWeight: 600, marginBottom: '5px' }}
                        />
                        <Legend
                          verticalAlign="bottom"
                          height={36}
                          wrapperStyle={{ fontSize: '13px', fontWeight: 500, paddingTop: '15px' }}
                          formatter={(value, entry) => {
                            const componentLabel = entry.payload.component_type === 'whole_blood' ? 'Whole Blood' : entry.payload.component_type === 'platelets' ? 'Platelets' : 'Plasma'
                            return `${entry.payload.blood_type} ${componentLabel}: ${entry.payload.total_wasted || 0} units`
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-[420px] items-center justify-center">
                      <div className="text-center">
                        <p className="text-sm font-medium text-slate-600">No wastage distribution data</p>
                        <p className="mt-1 text-xs text-slate-400">
                          {historicalWastage
                            ? `No expired ${componentFilter === 'all' ? 'blood units' : componentFilter === 'whole_blood' ? 'whole blood' : componentFilter === 'platelets' ? 'platelets' : 'plasma'} found in the last 90 days`
                            : 'Loading wastage data...'}
                        </p>
                      </div>
                    </div>
                  )
                  })()}
                </div>
              </section>
            </>
          )}
        </>
      )}
    </AdminLayout>
  )
}

export default AdminReports
