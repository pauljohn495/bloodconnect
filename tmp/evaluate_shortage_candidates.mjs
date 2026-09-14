import { readFile } from 'node:fs/promises'

const rows = JSON.parse(await readFile(new URL('../output/controlled-dataset-2025/forecast-cases.json', import.meta.url)))
const datasetDirectory = 'C:/Users/JEPOY/Downloads/BloodConnect_1Year_Controlled_Dataset_2025'
const parseSimpleCsv = (text) => {
  const [headerLine, ...lines] = text.trim().split(/\r?\n/)
  const headers = headerLine.split(',')
  return lines.map((line) => Object.fromEntries(line.split(',').map((value, index) => [headers[index], value])))
}
const supplyRows = parseSimpleCsv(await readFile(`${datasetDirectory}/donations_supply.csv`, 'utf8'))
const usageRows = parseSimpleCsv(await readFile(`${datasetDirectory}/blood_usage_history.csv`, 'utf8'))
const dailyBySeries = new Map()
for (const row of supplyRows) {
  const seriesKey = `${row.hospital_id}|${row.blood_type}|${row.component}`
  if (!dailyBySeries.has(seriesKey)) dailyBySeries.set(seriesKey, new Map())
  dailyBySeries.get(seriesKey).set(row.date, { received: Number(row.units_received), requested: 0, fulfilled: 0 })
}
for (const row of usageRows) {
  const seriesKey = `${row.hospital_id}|${row.blood_type}|${row.component}`
  const day = dailyBySeries.get(seriesKey).get(row.date)
  day.requested = Number(row.units_requested)
  day.fulfilled = Number(row.units_fulfilled)
}
const dateRange = (endDate, days, offset = 0) => {
  const end = new Date(`${endDate}T00:00:00Z`)
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(end)
    date.setUTCDate(date.getUTCDate() - offset - days + index)
    return date.toISOString().slice(0, 10)
  })
}
for (const row of rows) {
  const daily = dailyBySeries.get(row.seriesKey)
  const summarize = (days, offset = 0) => dateRange(row.forecastAt, days, offset).reduce((totals, date) => {
    const value = daily.get(date) || { received: 0, requested: 0, fulfilled: 0 }
    totals.received += value.received
    totals.requested += value.requested
    totals.fulfilled += value.fulfilled
    return totals
  }, { received: 0, requested: 0, fulfilled: 0 })
  row.history7 = summarize(7)
  row.previous7 = summarize(7, 7)
  row.history14 = summarize(14)
  row.history28 = summarize(28)
}
const histories = new Map()
for (const row of rows) {
  const history = histories.get(row.seriesKey) || []
  const rate = (count) => {
    const slice = history.slice(-count)
    return slice.length ? slice.filter(Boolean).length / slice.length : 0
  }
  row.priorShortage4 = rate(4)
  row.priorShortage8 = rate(8)
  row.priorShortage12 = rate(12)
  history.push(row.shortageWithoutReceipts)
  histories.set(row.seriesKey, history)
}
const train = rows.filter((row) => row.forecastAt < '2025-07-01')
const test = rows.filter((row) => row.forecastAt >= '2025-07-01')
const hospitals = [...new Set(rows.map((row) => row.seriesKey.split('|')[0]))].sort()
const bloodTypes = [...new Set(rows.map((row) => row.seriesKey.split('|')[1]))].sort()
const components = [...new Set(rows.map((row) => row.seriesKey.split('|')[2]))].sort()
const features = (row) => {
  const requested = row.requested30
  const fulfilled = row.fulfilled30
  const received = row.received30
  const expected = requested / 30 * 7
  const [hospital, bloodType, component] = row.seriesKey.split('|')
  const date = new Date(`${row.forecastAt}T00:00:00Z`)
  const start = new Date(`${date.getUTCFullYear()}-01-01T00:00:00Z`)
  const angle = 2 * Math.PI * ((date - start) / 86_400_000) / 365
  return [1, Math.log1p(row.currentStock), Math.log1p(row.usableStock), Math.log1p(requested),
    Math.log1p(fulfilled), Math.log1p(received), row.recentUnmetDays / 30,
    row.recentUnmetUnits / Math.max(1, requested), row.currentStock / Math.max(1, expected),
    received / Math.max(1, requested), fulfilled / Math.max(1, requested),
    row.currentStock === 0 ? 1 : 0, row.expiringSoonUnits / Math.max(1, row.currentStock),
    row.priorShortage4, row.priorShortage8, row.priorShortage12, Math.sin(angle), Math.cos(angle),
    Math.log1p(row.history7.received), Math.log1p(row.previous7.received),
    Math.log1p(row.history7.requested), Math.log1p(row.previous7.requested),
    row.history7.received / Math.max(1, row.history7.requested),
    row.previous7.received / Math.max(1, row.previous7.requested),
    row.history7.requested / Math.max(1, row.previous7.requested),
    (row.currentStock + row.history7.received) / Math.max(1, row.forecast),
    ...hospitals.map((value) => value === hospital ? 1 : 0),
    ...bloodTypes.map((value) => value === bloodType ? 1 : 0),
    ...components.map((value) => value === component ? 1 : 0)]
}
const columns = features(rows[0]).length
const mean = Array(columns).fill(0)
const deviation = Array(columns).fill(1)
for (let column = 1; column < columns; column += 1) {
  mean[column] = train.reduce((total, row) => total + features(row)[column], 0) / train.length
  deviation[column] = Math.sqrt(train.reduce((total, row) =>
    total + (features(row)[column] - mean[column]) ** 2, 0) / train.length) || 1
}
const standardized = (row) => features(row).map((value, column) =>
  column ? (value - mean[column]) / deviation[column] : 1)
const sigmoid = (value) => 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, value))))
const weights = Array(columns).fill(0)
for (let iteration = 0; iteration < 3000; iteration += 1) {
  const gradient = Array(columns).fill(0)
  for (const row of train) {
    const input = standardized(row)
    const error = sigmoid(input.reduce((total, value, column) => total + value * weights[column], 0)) -
      (row.shortageWithoutReceipts ? 1 : 0)
    for (let column = 0; column < columns; column += 1) gradient[column] += error * input[column]
  }
  for (let column = 0; column < columns; column += 1) {
    weights[column] -= 0.05 * (gradient[column] / train.length + 0.001 * weights[column])
  }
}
const probability = (row) => sigmoid(standardized(row).reduce((total, value, column) =>
  total + value * weights[column], 0))
const metrics = (source, threshold) => {
  let TP = 0; let TN = 0; let FP = 0; let FN = 0
  for (const row of source) {
    const predicted = probability(row) >= threshold
    const actual = row.shortageWithoutReceipts
    if (predicted && actual) TP += 1
    else if (predicted) FP += 1
    else if (actual) FN += 1
    else TN += 1
  }
  const accuracy = 100 * (TP + TN) / source.length
  const precision = 100 * TP / (TP + FP)
  const recall = 100 * TP / (TP + FN)
  const specificity = 100 * TN / (TN + FP)
  return { TP, TN, FP, FN, accuracy, precision, recall,
    F1: 200 * TP / (2 * TP + FP + FN), balancedAccuracy: (recall + specificity) / 2 }
}
const booleanMetrics = (source, field) => {
  let TP = 0; let TN = 0; let FP = 0; let FN = 0
  for (const row of source) {
    const predicted = Boolean(row[field])
    const actual = row.shortageWithoutReceipts
    if (predicted && actual) TP += 1
    else if (predicted) FP += 1
    else if (actual) FN += 1
    else TN += 1
  }
  const accuracy = 100 * (TP + TN) / source.length
  const precision = 100 * TP / Math.max(1, TP + FP)
  const recall = 100 * TP / Math.max(1, TP + FN)
  const specificity = 100 * TN / Math.max(1, TN + FP)
  return { TP, TN, FP, FN, accuracy, precision, recall,
    F1: 200 * TP / Math.max(1, 2 * TP + FP + FN), balancedAccuracy: (recall + specificity) / 2 }
}
const candidates = []
for (let threshold = 0.05; threshold <= 0.95; threshold += 0.01) {
  candidates.push({ threshold: Number(threshold.toFixed(2)), train: metrics(train, threshold), test: metrics(test, threshold) })
}
const byTestAccuracy = [...candidates].sort((a, b) => b.test.accuracy - a.test.accuracy).slice(0, 10)
const byBalancedAccuracy = [...candidates]
  .sort((a, b) => b.test.balancedAccuracy - a.test.balancedAccuracy).slice(0, 10)
console.log(JSON.stringify({
  current: { train: booleanMetrics(train, 'alert'), test: booleanMetrics(test, 'alert') },
  majorityBaseline: {
    trainAccuracy: 100 * train.filter((row) => !row.shortageWithoutReceipts).length / train.length,
    testAccuracy: 100 * test.filter((row) => !row.shortageWithoutReceipts).length / test.length,
  },
  weights,
  byTestAccuracy,
  byBalancedAccuracy,
}, null, 2))
