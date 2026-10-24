/*
 * @japa/runner
 *
 * (c) Japa
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

/**
 * Run metadata that only the runner knows (selection size, phase timings,
 * baseline counts). The agent reporter reads it when printing the summary, so a
 * harness can tell a fast, narrow run from a silent fallback to everything.
 */
export type AgentContext = {
  /** Application directory used to keep reported file paths stable. */
  cwd?: string
  selection?: {
    mode: 'all' | 'filtered' | 'changed'
    planned: number
    skipped: number
    signature?: string
    /** A filter was requested but could not narrow the import list. */
    fallback?: boolean
    /** Why `--changed` ran everything, worded as the fix. */
    fallbackReason?: string
    /** Some changed paths were placed by name or rule, not by imports. */
    heuristic?: boolean
    /** Those paths, at most 20. */
    guessed?: string[]
  }
  phases?: {
    bootMs: number
    importMs: number
    testMs: number
  }
  baseline?: {
    known: number
    new: number
    fixed?: number
    /** The failures the baseline does not know, at most 20: what the caller acts on. */
    newFailures?: { file: string; title: string }[]
  }
  /** Setup/teardown errors mean "known failures only" cannot turn the run green. */
  nonTestErrors?: boolean
}

const contexts = new WeakMap<object, AgentContext>()

export function setAgentContext(runner: object, patch: AgentContext) {
  contexts.set(runner, { ...(contexts.get(runner) ?? {}), ...patch })
}

export function getAgentContext(runner: object): AgentContext {
  return contexts.get(runner) ?? {}
}
