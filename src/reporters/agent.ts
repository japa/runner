/*
 * @japa/runner
 *
 * (c) Japa
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { closeSync, mkdirSync, openSync, writeSync } from 'node:fs'
import { dirname, relative } from 'node:path'

import { BaseReporter } from '../../modules/core/main.js'
import type {
  BaseReporterOptions,
  TestEndNode,
  SuiteEndNode,
  GroupEndNode,
} from '../../modules/core/types.js'
import { getAgentContext } from './context.js'

/** Hard cap per emitted line, so one pathological stack cannot flood a reader. */
export const MAX_LINE_CHARS = 4000
/** Lines kept from a failure message and each stacked error. */
const MAX_MESSAGE_LINES = 6
const MAX_STACK_LINES = 4

export type AgentReporterOptions = BaseReporterOptions & {
  /** Emit only failing, skipped and todo tests, plus the summary. Defaults to true. */
  onlyFailures?: boolean
  /** Collapse repeated identical errors and omit their stacks after the first. */
  compact?: boolean
  /** Write JSON lines here instead of stdout, keeping application output apart. */
  file?: string
}

function clip(value: string, lines: number) {
  const parts = value.split('\n')
  if (parts.length <= lines) return value
  return `${parts.slice(0, lines).join('\n')}\n… ${parts.length - lines} more lines`
}

function oneLine(value: unknown) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** First stack frame that is not a Node internal, as a relative file and line. */
function locationOf(error: unknown, cwd: string): { file: string; line: number } | undefined {
  if (!(error instanceof Error) || !error.stack) return undefined
  for (const raw of error.stack.split('\n').slice(1)) {
    const match = /\(?((?:file:\/\/)?[^()\s]+):(\d+):(\d+)\)?$/.exec(raw.trim())
    if (!match) continue
    const path = match[1].replace(/^file:\/\//, '')
    if (path.startsWith('node:') || path.includes('/node_modules/')) continue
    return { file: relative(cwd, path), line: Number(match[2]) }
  }
  return undefined
}

function errorKey(error: unknown) {
  if (error instanceof Error) return `${error.name}\u0000${oneLine(error.message)}`
  return `Error\u0000${oneLine(error)}`
}

/**
 * Shrink a record while keeping it valid JSON. Truncating an already serialized
 * line would turn a pathological failure into unparseable output.
 */
function shrinkLine(record: Record<string, unknown>) {
  const minimal: Record<string, unknown> = { event: record.event, truncated: true }
  for (const key of ['status', 'file', 'group', 'title', 'suite', 'durationMs']) {
    if (record[key] !== undefined) minimal[key] = record[key]
  }
  if (record.event === 'summary') {
    for (const key of [
      'total',
      'passed',
      'failed',
      'skipped',
      'todo',
      'regression',
      'ok',
      'knownOnly',
      'processError',
      'selection',
      'phases',
      'baseline',
    ]) {
      if (record[key] !== undefined) minimal[key] = record[key]
    }
    if (Array.isArray(record.errorGroups)) minimal.errorGroups = record.errorGroups.slice(0, 10)
  }
  const first = Array.isArray(record.errors) ? record.errors[0] : undefined
  if (first !== undefined) {
    if (first && typeof first === 'object') {
      const error = first as Record<string, unknown>
      minimal.errors = [
        {
          name: error.name,
          message: clip(oneLine(error.message), 1).slice(0, 500),
        },
      ]
    } else {
      minimal.errors = [{ message: clip(oneLine(first), 1).slice(0, 500) }]
    }
  }

  let line = JSON.stringify(minimal)
  if (line.length > MAX_LINE_CHARS) {
    for (const key of ['status', 'file', 'group', 'title', 'suite']) {
      if (typeof minimal[key] === 'string') minimal[key] = (minimal[key] as string).slice(0, 200)
    }
    if (
      Array.isArray(minimal.errors) &&
      minimal.errors[0] &&
      typeof minimal.errors[0] === 'object'
    ) {
      const error = minimal.errors[0] as Record<string, unknown>
      if (typeof error.message === 'string') error.message = error.message.slice(0, 200)
    }
    line = JSON.stringify(minimal)
  }
  if (line.length > MAX_LINE_CHARS) {
    if (record.event === 'summary') {
      line = JSON.stringify({
        event: 'summary',
        total: record.total,
        failed: record.failed,
        ok: record.ok,
        truncated: true,
      })
    } else {
      line = JSON.stringify({ event: record.event, truncated: true })
    }
  }
  return line
}

/**
 * Machine-readable results for agents and harnesses.
 *
 * One JSON object per line, no ANSI, no progress output, and a bounded size per
 * failure. Unlike the NDJSON reporter this is built to be cheap to read: the
 * reader pays for the fields it receives, so verbose structures are flattened,
 * long messages are clipped, and repeated errors are collapsed.
 */
export class AgentReporter extends BaseReporter {
  #onlyFailures: boolean
  #compact: boolean
  #file: string | undefined
  #fd: number | undefined
  #seen = new Map<string, number>()

  constructor(options: AgentReporterOptions = {}) {
    super(options)
    this.#onlyFailures = options.onlyFailures ?? true
    this.#compact = options.compact ?? false
    this.#file = options.file
  }

  #emit(record: Record<string, unknown>) {
    const serialized = JSON.stringify(record)
    const line = serialized.length > MAX_LINE_CHARS ? shrinkLine(record) : serialized
    const output = `${line}\n`
    if (!this.#file) {
      process.stdout.write(output)
      return
    }
    if (this.#fd === undefined) {
      mkdirSync(dirname(this.#file), { recursive: true })
      this.#fd = openSync(this.#file, 'w')
    }
    writeSync(this.#fd, output)
  }

  #cwd() {
    return this.runner ? (getAgentContext(this.runner).cwd ?? process.cwd()) : process.cwd()
  }

  #serialize(error: unknown, cwd = this.#cwd()) {
    const key = errorKey(error)
    const previous = this.#seen.get(key) ?? 0
    this.#seen.set(key, previous + 1)

    if (this.#compact && previous > 0) {
      return {
        name: error instanceof Error ? error.name : 'Error',
        message: clip(oneLine(error instanceof Error ? error.message : error), 1),
        repeated: true,
      }
    }

    const location = locationOf(error, cwd)
    return {
      name: error instanceof Error ? error.name : 'Error',
      message: clip(oneLine(error instanceof Error ? error.message : error), MAX_MESSAGE_LINES),
      ...(location ? { location } : {}),
      ...(error instanceof Error && error.stack && !this.#compact
        ? { stack: clip(error.stack, MAX_STACK_LINES) }
        : {}),
    }
  }

  protected onTestEnd(payload: TestEndNode): void {
    const file = this.currentFileName
    const status = payload.hasError
      ? 'failed'
      : payload.isTodo
        ? 'todo'
        : payload.isSkipped
          ? 'skipped'
          : 'passed'

    if (this.#onlyFailures && status === 'passed') return

    const cwd = this.#cwd()
    this.#emit({
      event: 'test',
      status,
      file: file ? relative(cwd, file) : undefined,
      suite: payload.meta?.suite?.name,
      group: payload.meta?.group?.title,
      title: payload.title.expanded,
      durationMs: Math.round(payload.duration * 1000) / 1000,
      ...(payload.retryAttempt ? { attempt: payload.retryAttempt } : {}),
      ...(payload.skipReason ? { reason: payload.skipReason } : {}),
      ...(payload.errors.length
        ? { errors: payload.errors.map((e) => this.#serialize(e.error, cwd)) }
        : {}),
    })
  }

  protected onGroupEnd(payload: GroupEndNode): void {
    if (!payload.errors.length) return
    this.#emit({
      event: 'group-error',
      group: payload.title,
      errors: payload.errors.map((e) => this.#serialize(e.error)),
    })
  }

  protected onSuiteEnd(payload: SuiteEndNode): void {
    if (!payload.errors.length) return
    this.#emit({
      event: 'suite-error',
      suite: payload.name,
      errors: payload.errors.map((e) => this.#serialize(e.error)),
    })
  }

  protected async end() {
    // Let late unhandled rejections from runner:end listeners set the process
    // exit code before the final summary is written.
    await new Promise((done) => setImmediate(done))
    const summary = this.runner!.getSummary()
    const context = getAgentContext(this.runner!)
    const repeats = [...this.#seen.entries()].filter(([, count]) => count > 1)
    const processError =
      Boolean(context.nonTestErrors) || process.exitCode === 1 || process.exitCode === 2

    this.#emit({
      event: 'summary',
      ...summary.aggregates,
      durationMs: Math.round(summary.duration * 1000) / 1000,
      ok: !summary.hasError,
      ...(context.selection ? { selection: context.selection } : {}),
      ...(context.phases ? { phases: context.phases } : {}),
      ...(context.baseline ? { baseline: context.baseline } : {}),
      ...(context.baseline &&
      context.baseline.known > 0 &&
      context.baseline.new === 0 &&
      !context.nonTestErrors
        ? { knownOnly: true }
        : {}),
      ...(processError ? { processError: true } : {}),
      ...(repeats.length
        ? {
            errorGroups: repeats.map(([key, count]) => ({
              message: key.split('\u0000')[1],
              count,
            })),
          }
        : {}),
    })

    if (this.#fd !== undefined) closeSync(this.#fd)
    this.#fd = undefined
  }
}
