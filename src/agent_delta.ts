/*
 * @japa/runner
 *
 * (c) Japa
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

/**
 * Compare two agent reports so a harness can show only what changed.
 *
 * A test missing from the current report may simply not have been selected, so
 * "fixed" is only reported when the selection signature and total are identical.
 */
export type AgentTestRow = {
  suite?: string
  group?: string
  file?: string
  title: string
  /** First error's message and line, for a digest; not part of the row's identity. */
  message?: string
  line?: number
}

export type AgentSelection = {
  mode: string
  planned: number
  skipped: number
  signature?: string
  fallback?: boolean
  fallbackReason?: string
  heuristic?: boolean
  guessed?: string[]
}

export type AgentSummary = {
  total: number
  failed?: number
  durationMs?: number
  knownOnly?: boolean
  selection?: AgentSelection
  phases?: { bootMs?: number; importMs?: number; testMs?: number }
  /** Present with `--allow-known-failures` or `--update-baseline`. */
  baseline?: {
    known: number
    new: number
    fixed: number
    newFailures?: { file: string; title: string }[]
  }
}

export type ParsedAgentReport = {
  summary?: AgentSummary
  failures: AgentTestRow[]
}

export type AgentDelta = {
  comparable: boolean
  newFailures: AgentTestRow[]
  fixed: AgentTestRow[]
  counts: { previous: number; current: number; new: number; fixed: number }
  truncated: boolean
}

const MAX_ROWS = 50
/** Failures a digest spells out; the rest are in the report. */
const DIGEST_ROWS = 10
const DIGEST_MESSAGE_CHARS = 240

function identity({ message: _message, line: _line, ...row }: AgentTestRow): AgentTestRow {
  return row
}

function keyOf(row: AgentTestRow) {
  return `${row.suite ?? ''}\u0000${row.group ?? ''}\u0000${row.file ?? ''}\u0000${row.title}`
}

/** Parse JSON lines produced by the agent reporter. Unknown lines are ignored. */
export function parseAgentReport(text: string): ParsedAgentReport {
  const failures: AgentTestRow[] = []
  let summary: AgentSummary | undefined

  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    let record: Record<string, unknown>
    try {
      record = JSON.parse(line)
    } catch {
      continue
    }
    const kind = record.event
    if (kind === 'summary' && typeof record.total === 'number') {
      summary = {
        total: record.total,
        ...(typeof record.failed === 'number' ? { failed: record.failed } : {}),
        ...(typeof record.durationMs === 'number' ? { durationMs: record.durationMs } : {}),
        ...(typeof record.knownOnly === 'boolean' ? { knownOnly: record.knownOnly } : {}),
        ...(record.selection && typeof record.selection === 'object'
          ? { selection: record.selection as AgentSelection }
          : {}),
        ...(record.phases && typeof record.phases === 'object'
          ? { phases: record.phases as AgentSummary['phases'] }
          : {}),
        ...(record.baseline && typeof record.baseline === 'object'
          ? { baseline: record.baseline as AgentSummary['baseline'] }
          : {}),
      }
    } else if (kind === 'test' && record.status === 'failed' && typeof record.title === 'string') {
      const error = Array.isArray(record.errors) ? firstError(record.errors[0]) : {}
      failures.push({
        ...(typeof record.suite === 'string' ? { suite: record.suite } : {}),
        ...(typeof record.group === 'string' ? { group: record.group } : {}),
        ...(typeof record.file === 'string' ? { file: record.file } : {}),
        title: record.title,
        ...error,
      })
    }
  }

  return summary ? { summary, failures } : { failures }
}

function firstError(value: unknown): { message?: string; line?: number } {
  if (!value || typeof value !== 'object') return {}
  const { message, location } = value as Record<string, unknown>
  const line =
    location && typeof location === 'object'
      ? (location as Record<string, unknown>).line
      : undefined
  return {
    ...(typeof message === 'string' ? { message } : {}),
    ...(typeof line === 'number' ? { line } : {}),
  }
}

function sameSelection(previous: AgentSummary | undefined, current: AgentSummary) {
  if (!previous) return false
  if (previous.total !== current.total) return false
  const a = previous.selection
  const b = current.selection
  if (!a || !b) return !a && !b
  return (
    a.mode === b.mode &&
    a.planned === b.planned &&
    a.skipped === b.skipped &&
    Boolean(a.signature && b.signature) &&
    a.signature === b.signature
  )
}

export function diffReports(
  previous: ParsedAgentReport | undefined,
  current: ParsedAgentReport
): AgentDelta {
  const comparable = Boolean(
    previous?.summary && current.summary && sameSelection(previous.summary, current.summary)
  )
  const before = new Map((previous?.failures ?? []).map((row) => [keyOf(row), row]))
  const after = new Map(current.failures.map((row) => [keyOf(row), row]))

  const newFailures = [...after].filter(([key]) => !before.has(key)).map(([, row]) => identity(row))
  const fixed = comparable
    ? [...before].filter(([key]) => !after.has(key)).map(([, row]) => identity(row))
    : []

  const truncated = newFailures.length > MAX_ROWS || fixed.length > MAX_ROWS
  return {
    comparable,
    newFailures: newFailures.slice(0, MAX_ROWS),
    fixed: fixed.slice(0, MAX_ROWS),
    counts: {
      previous: previous?.failures.length ?? 0,
      current: current.failures.length,
      new: newFailures.length,
      fixed: fixed.length,
    },
    truncated,
  }
}

export type DigestInput = {
  report: ParsedAgentReport | undefined
  exit: number
  runMs: number
  reportPath: string
  logPath?: string
  /** Last lines of the log, shown when the run wrote no summary. */
  logTail?: string
}

function seconds(ms: number) {
  return ms < 60_000
    ? `${(ms / 1000).toFixed(1)}s`
    : `${Math.floor(ms / 60_000)}m${Math.round((ms % 60_000) / 1000)}s`
}

function describeRow(row: AgentTestRow) {
  const where = row.file ? `${row.file}${row.line ? `:${row.line}` : ''}  ` : ''
  const name = row.group ? `${row.group} › ${row.title}` : row.title
  const message = row.message ? `\n    ${row.message.slice(0, DIGEST_MESSAGE_CHARS)}` : ''
  return `  ${where}${name}${message}`
}

/**
 * What a harness reads after a run: outcome, counts, the selection, and the failures to
 * act on, each with its message. Everything else stays in the report and the log.
 */
export function formatDigest(input: DigestInput): string {
  const { report, exit } = input
  const summary = report?.summary
  const lines: string[] = []
  const files = `report=${input.reportPath}${input.logPath ? ` log=${input.logPath}` : ''}`
  if (!summary) {
    lines.push(
      `japa-agent: FAILED exit=${exit}: the run wrote no summary, so it failed before or outside its tests.`
    )
    if (input.logTail) lines.push(input.logTail)
    lines.push(`japa-agent: ${files}`)
    return `${lines.join('\n')}\n`
  }

  const baseline = summary.baseline
  const failed = summary.failed ?? report.failures.length
  const status = exit === 0 ? (failed ? 'PASSED (known failures only)' : 'PASSED') : 'FAILED'
  const counts = baseline
    ? `${failed} failed (${baseline.new} new, ${baseline.known} known)`
    : `${failed} failed`
  lines.push(
    `japa-agent: ${status} exit=${exit} · ${summary.total} tests, ${counts} · ${seconds(input.runMs)}`
  )

  const selection = summary.selection
  if (selection?.fallbackReason) {
    lines.push(`japa-agent: ran every test file: ${selection.fallbackReason}`)
  } else if (selection) {
    const guessed = selection.heuristic ? ' (some guessed by name; confirm with a full run)' : ''
    lines.push(
      `japa-agent: selection ${selection.mode}: ${selection.planned} of ${selection.planned + selection.skipped} test files${guessed}`
    )
  }

  // With a baseline only the new failures are actionable; without one, all are.
  const wanted = baseline?.newFailures
    ? new Set(baseline.newFailures.map((row) => `${row.file}\u0000${row.title}`))
    : undefined
  const actionable = baseline
    ? wanted
      ? report.failures.filter((row) => wanted.has(`${row.file ?? ''}\u0000${row.title}`))
      : []
    : report.failures
  const total = baseline ? baseline.new : actionable.length
  if (actionable.length) {
    lines.push(`japa-agent: ${baseline ? 'new failures' : 'failures'}:`)
    lines.push(...actionable.slice(0, DIGEST_ROWS).map(describeRow))
    if (total > DIGEST_ROWS) lines.push(`  … ${total - DIGEST_ROWS} more in the report`)
  } else if (exit !== 0 && !failed && input.logTail) {
    lines.push(input.logTail)
  }
  lines.push(`japa-agent: ${files}`)
  return `${lines.join('\n')}\n`
}
