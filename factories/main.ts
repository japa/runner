/*
 * @japa/runner
 *
 * (c) Japa
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { RunnerFactory } from './runner.js'

/**
 * Create an instance of the runner factory
 */
export const runner = () => new RunnerFactory()
