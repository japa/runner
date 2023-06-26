/*
 * @japa/runner
 *
 * (c) Japa
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { PluginFn } from '../types.js'

export const retryPlugin: PluginFn = function retry({ config }) {
  config.teardown.push(() => {})

  /**
   * Do not activate the filter when test filters are applied
   * explicitly
   */
  if (config.filters.tests && config.filters.tests.length) {
    return
  }
}
