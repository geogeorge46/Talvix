export const round = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
export const calculateRate = (numerator, denominator) => denominator ? round((numerator / denominator) * 100) : 0;
export const calculateAverage = (total, count) => count ? round(total / count) : 0;
export const calculatePercentageChange = (current, previous) => previous ? round(((current - previous) / Math.abs(previous)) * 100) : current ? 100 : 0;
export const comparison = (value, previous) => ({ value, previous, changePercent: calculatePercentageChange(value, previous) });
export const analyticsResponse = (range, summary, series = [], breakdowns = {}) => ({ range: { from: range.from.toISOString(), to: range.to.toISOString(), preset: range.preset, interval: range.interval, timezone: range.timezone }, summary, series, breakdowns, generatedAt: new Date().toISOString() });
const csvCell = (value) => { const raw = typeof value === 'object' ? JSON.stringify(value) : String(value ?? ''); const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw; return `"${safe.replaceAll('"', '""')}"`; };
export const reportToCsv = (report) => { const rows = Object.entries(report.summary).map(([metric, value]) => ({ metric, value: typeof value === 'object' && value !== null && 'value' in value ? value.value : value })); return ['metric,value', ...rows.map((row) => `${csvCell(row.metric)},${csvCell(row.value)}`)].join('\n'); };
