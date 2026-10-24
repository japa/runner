/*
 * @japa/runner
 *
 * (c) Japa
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

/**
 * Planner-internal state, keyed by the config object.
 *
 * Keeping it out of `NormalizedConfig` means plugins can coordinate with the
 * planner without widening the public configuration type.
 */
export type SelectionPlan = {
  /** Only these relative paths may be imported. */
  only?: readonly string[]
  /** When set, `only` restricts these paths alone; a file outside them is always kept. */
  onlyWithin?: readonly string[]
  /** Relative paths the index has an answer for. */
  skipWithin?: readonly string[]
  /** Relative paths proven unable to match the active filters. */
  skip?: readonly string[]
}

export type SelectionStats = {
  collected: number
  planned: number
  signature?: string
}

const plans = new WeakMap<object, SelectionPlan>()
const stats = new WeakMap<object, SelectionStats>()

export function setSelectionPlan(config: object, plan: SelectionPlan) {
  plans.set(config, plan)
}

export function getSelectionPlan(config: object): SelectionPlan | undefined {
  return plans.get(config)
}

export function setSelectionStats(config: object, value: SelectionStats) {
  stats.set(config, value)
}

export function getSelectionStats(config: object): SelectionStats | undefined {
  return stats.get(config)
}
