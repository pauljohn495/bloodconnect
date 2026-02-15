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
      // Debug log to check data structure
      console.log('Historical wastage data:', histData)
      console.log('Wastage by blood type:', histData?.wastageByBloodType)
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

  // Prepare chart data
  const wastageForecastData = predictions
    ? [
        { period: 'Next 7 Days', predicted: predictions.predictedWastage.next7Days },
        { period: 'Next 14 Days', predicted: predictions.predictedWastage.next14Days },
        { period: 'Next 30 Days', predicted: predictions.predictedWastage.next30Days },
      ]
    : []

  const wastageByBloodTypeData = predictions?.wastageByBloodType || []

  const historicalChartData = historicalWastage?.wastageByDate
    ? historicalWastage.wastageByDate
        .reduce((acc, item) => {
          const existing = acc.find((a) => a.date === item.date)
          if (existing) {
            existing.total += item.wasted_units || 0
          } else {
            acc.push({ date: item.date, total: item.wasted_units || 0 })
          }
          return acc
        }, [])
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(-30) // Last 30 days
    : []

  return (
    <AdminLayout pageTitle="Reports & Analytics" pageDescription="View detailed reports and system analytics.">
      {/* Tabs */}
      <div className="mb-4 flex gap-2 border-b border-slate-200">
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
                    {predictions?.summary?.totalAtRisk || 0}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-400">units</p>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
                  <p className="text-[11px] font-medium text-slate-500">High Risk Items</p>
                  <p className="mt-1 text-2xl font-semibold text-red-600">
                    {predictions?.summary?.highRiskItems || 0}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-400">items</p>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
                  <p className="text-[11px] font-medium text-slate-500">Avg Risk Score</p>
                  <p className="mt-1 text-2xl font-semibold text-slate-900">
                    {predictions?.summary?.averageRiskScore || 0}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-400">out of 100</p>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
                  <p className="text-[11px] font-medium text-slate-500">Recommendations</p>
                  <p className="mt-1 text-2xl font-semibold text-blue-600">
                    {prescriptions?.summary?.totalRecommendations || 0}
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

                  {/* Risk by Blood Type */}
                  {wastageByBloodTypeData.length > 0 && (
                    <div className="mb-10">
                      <h3 className="mb-4 text-sm font-semibold text-slate-900">Risk by Blood Type</h3>
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
                            label={({ bloodType, totalAtRisk, percent }) =>
                              `${bloodType}\n${totalAtRisk} units\n(${(percent * 100).toFixed(1)}%)`
                            }
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
                            formatter={(value, name, props) => [
                              `${value} units (${((value / wastageByBloodTypeData.reduce((sum, item) => sum + item.totalAtRisk, 0)) * 100).toFixed(1)}%)`,
                              props.payload.bloodType,
                            ]}
                            labelStyle={{ fontWeight: 600, marginBottom: '5px' }}
                          />
                          <Legend
                            verticalAlign="bottom"
                            height={36}
                            wrapperStyle={{ fontSize: '13px', fontWeight: 500, paddingTop: '15px' }}
                            formatter={(value, entry) => `${value}: ${entry.payload.totalAtRisk} units`}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* High Risk Inventory Table */}
                  <div>
                    <h3 className="mb-3 text-xs font-semibold text-slate-700">High Risk Inventory Items</h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-100 text-xs">
                        <thead className="bg-slate-50/60">
                          <tr>
                            <th className="whitespace-nowrap px-3 py-2 text-left font-medium text-slate-500">
                              Blood Type
                            </th>
                            <th className="whitespace-nowrap px-3 py-2 text-left font-medium text-slate-500">
                              Units
                            </th>
                            <th className="whitespace-nowrap px-3 py-2 text-left font-medium text-slate-500">
                              Days Until Expiry
                            </th>
                            <th className="whitespace-nowrap px-3 py-2 text-left font-medium text-slate-500">
                              Risk Score
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {predictions?.inventoryWithRisk
                            ?.filter((item) => item.riskScore >= 50)
                            .slice(0, 10)
                            .map((item) => (
                              <tr key={item.id} className="hover:bg-slate-50/60">
                                <td className="whitespace-nowrap px-3 py-2 font-semibold text-slate-900">
                                  {item.blood_type}
                                </td>
                                <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                                  {item.available_units}
                                </td>
                                <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                                  {item.days_until_expiry} days
                                </td>
                                <td className="whitespace-nowrap px-3 py-2">
                                  <span
                                    className={`inline-flex items-center rounded-full px-2 py-1 text-[10px] font-semibold ring-1 ${getRiskColor(
                                      item.riskScore,
                                    )}`}
                                  >
                                    {item.riskScore}
                                  </span>
                                </td>
                              </tr>
                            )) || (
                            <tr>
                              <td className="px-3 py-4 text-center text-slate-500" colSpan={4}>
                                No high-risk items found
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </section>

              {/* Prescriptive Analytics Section */}
              <section className="mt-6 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
                <div className="border-b border-slate-100 px-6 py-4">
                  <p className="text-base font-semibold text-slate-900">Prescriptive Analytics</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Actionable recommendations to reduce wastage
                  </p>
                </div>
                <div className="p-6">
                  {/* Priority Actions */}
                  {prescriptions?.priorityActions && prescriptions.priorityActions.length > 0 && (
                    <div className="mb-8">
                      <h3 className="mb-4 text-sm font-semibold text-slate-700">Priority Actions</h3>
                      <div className="space-y-4">
                        {prescriptions.priorityActions.map((action, index) => (
                          <div
                            key={index}
                            className={`rounded-lg border p-5 ring-1 ${getPriorityColor(action.priority)}`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold uppercase ring-1 ${getPriorityColor(
                                      action.priority,
                                    )}`}
                                  >
                                    {action.priority}
                                  </span>
                                  <p className="text-sm font-semibold text-slate-900">{action.title}</p>
                                </div>
                                <p className="mt-2 text-xs text-slate-600">{action.description}</p>
                                <p className="mt-3 text-xs font-medium text-slate-700">
                                  💡 {action.action}
                                </p>
                                {action.bloodTypes && (
                                  <div className="mt-3 flex flex-wrap gap-1.5">
                                    {action.bloodTypes.map((bt) => (
                                      <span
                                        key={bt}
                                        className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                                      >
                                        {bt}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Transfer Recommendations */}
                  {prescriptions?.transferRecommendations &&
                    prescriptions.transferRecommendations.length > 0 && (
                      <div>
                        <h3 className="mb-3 text-xs font-semibold text-slate-700">
                          Transfer Recommendations
                        </h3>
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-slate-100 text-xs">
                            <thead className="bg-slate-50/60">
                              <tr>
                                <th className="whitespace-nowrap px-3 py-2 text-left font-medium text-slate-500">
                                  Priority
                                </th>
                                <th className="whitespace-nowrap px-3 py-2 text-left font-medium text-slate-500">
                                  Blood Type
                                </th>
                                <th className="whitespace-nowrap px-3 py-2 text-left font-medium text-slate-500">
                                  Units
                                </th>
                                <th className="whitespace-nowrap px-3 py-2 text-left font-medium text-slate-500">
                                  Days Until Expiry
                                </th>
                                <th className="whitespace-nowrap px-3 py-2 text-left font-medium text-slate-500">
                                  Transfer To
                                </th>
                                <th className="whitespace-nowrap px-3 py-2 text-left font-medium text-slate-500">
                                  Impact
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                              {prescriptions.transferRecommendations.map((rec, index) => (
                                <tr key={index} className="hover:bg-slate-50/60">
                                  <td className="whitespace-nowrap px-3 py-2">
                                    <span
                                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ring-1 ${getPriorityColor(
                                        rec.priority,
                                      )}`}
                                    >
                                      {rec.priority}
                                    </span>
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-2 font-semibold text-slate-900">
                                    {rec.bloodType}
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-2 text-slate-700">{rec.units}</td>
                                  <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                                    {rec.daysUntilExpiry} days
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                                    {rec.targetHospitalName}
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-2 text-[10px] text-slate-600">
                                    {rec.impact}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
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
                    {historicalWastage?.totalWastage !== undefined
                      ? Number(historicalWastage.totalWastage)
                      : historicalWastage?.wastageByBloodType
                        ? historicalWastage.wastageByBloodType.reduce(
                            (sum, item) => sum + Number(item.total_wasted || 0),
                            0,
                          )
                        : 0}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-400">units wasted</p>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
                  <p className="text-[11px] font-medium text-slate-500">Wastage Reduction Potential</p>
                  <p className="mt-1 text-2xl font-semibold text-blue-600">
                    {prescriptions?.summary?.estimatedWastageReduction || 0}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-400">units if recommendations followed</p>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
                  <p className="text-[11px] font-medium text-slate-500">Critical Actions</p>
                  <p className="mt-1 text-2xl font-semibold text-orange-600">
                    {prescriptions?.summary?.criticalActions || 0}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-400">urgent items</p>
                </div>
              </section>

              {/* Historical Wastage Chart */}
              <section className="mt-6">
                <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
                  <h3 className="mb-5 text-base font-semibold text-slate-900">Historical Wastage Trend (Last 30 Days)</h3>
                  {historicalChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={350}>
                      <LineChart data={historicalChartData} margin={{ top: 20, right: 30, left: 20, bottom: 30 }}>
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

              {/* Wastage by Blood Type */}
              <section className="mt-6 grid gap-6 lg:grid-cols-2">
                <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
                  <h3 className="mb-5 text-base font-semibold text-slate-900">Wastage by Blood Type (90 days)</h3>
                  {historicalWastage?.wastageByBloodType &&
                  historicalWastage.wastageByBloodType.length > 0 ? (
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart data={historicalWastage.wastageByBloodType} margin={{ top: 20, right: 30, left: 20, bottom: 30 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
                        <XAxis
                          dataKey="blood_type"
                          tick={{ fontSize: 13, fill: '#475569', fontWeight: 500 }}
                          stroke="#64748b"
                          tickLine={{ stroke: '#64748b' }}
                        >
                          <Label value="Blood Type" offset={-5} position="insideBottom" style={{ fontSize: 13, fill: '#64748b', fontWeight: 600 }} />
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
                          formatter={(value) => [`${value} units`, 'Wasted']}
                          labelStyle={{ fontWeight: 600, marginBottom: '5px' }}
                        />
                        <Legend
                          wrapperStyle={{ fontSize: '13px', fontWeight: 500, paddingTop: '10px' }}
                        />
                        <Bar
                          dataKey="total_wasted"
                          fill="#dc2626"
                          radius={[6, 6, 0, 0]}
                          name="Wasted Units"
                        >
                          <LabelList
                            dataKey="total_wasted"
                            position="top"
                            style={{ fontSize: 12, fill: '#1e293b', fontWeight: 600 }}
                            formatter={(value) => `${value}`}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-[320px] items-center justify-center">
                      <p className="text-sm text-slate-400">No wastage data by blood type</p>
                    </div>
                  )}
                </div>

                <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
                  <h3 className="mb-5 text-base font-semibold text-slate-900">Wastage Distribution</h3>
                  {historicalWastage?.wastageByBloodType &&
                  Array.isArray(historicalWastage.wastageByBloodType) &&
                  historicalWastage.wastageByBloodType.length > 0 ? (
                    <ResponsiveContainer width="100%" height={320}>
                      <PieChart>
                        <Pie
                          data={historicalWastage.wastageByBloodType}
                          dataKey="total_wasted"
                          nameKey="blood_type"
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          innerRadius={40}
                          label={({ blood_type, total_wasted, percent }) =>
                            `${blood_type}\n${total_wasted} units\n(${(percent * 100).toFixed(1)}%)`
                          }
                          labelLine={{ stroke: '#475569', strokeWidth: 1 }}
                          style={{ fontSize: 12, fontWeight: 500 }}
                        >
                          {historicalWastage.wastageByBloodType.map((entry, index) => (
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
                            const total = historicalWastage.wastageByBloodType.reduce(
                              (sum, item) => sum + (item.total_wasted || 0),
                              0,
                            )
                            return [
                              `${value} units (${total > 0 ? ((value / total) * 100).toFixed(1) : 0}%)`,
                              props.payload.blood_type,
                            ]
                          }}
                          labelStyle={{ fontWeight: 600, marginBottom: '5px' }}
                        />
                        <Legend
                          verticalAlign="bottom"
                          height={36}
                          wrapperStyle={{ fontSize: '13px', fontWeight: 500, paddingTop: '15px' }}
                          formatter={(value, entry) => `${value}: ${entry.payload.total_wasted || 0} units`}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-[320px] items-center justify-center">
                      <div className="text-center">
                        <p className="text-sm font-medium text-slate-600">No wastage distribution data</p>
                        <p className="mt-1 text-xs text-slate-400">
                          {historicalWastage
                            ? 'No expired blood units found in the last 90 days'
                            : 'Loading wastage data...'}
                        </p>
                      </div>
                    </div>
                  )}
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
