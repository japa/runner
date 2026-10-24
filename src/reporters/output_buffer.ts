/*
 * @japa/runner
 *
 * (c) Japa
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

/** Bounded, opt-in batching for human-readable reporter output. */
export class OutputBuffer {
  #pending = ''
  #timer?: NodeJS.Timeout

  constructor(
    private enabled = false,
    private writer: (message: string) => void = (message) => {
      process.stdout.write(message)
    }
  ) {}

  write(message: string, immediate = false) {
    if (!this.enabled) {
      this.writer(message)
      return
    }
    this.#pending += message
    if (immediate || this.#pending.length >= 8192) {
      this.flush()
    } else {
      this.#timer ??= setTimeout(() => this.flush(), 25).unref()
    }
  }

  flush() {
    clearTimeout(this.#timer)
    this.#timer = undefined
    if (!this.#pending) return
    const output = this.#pending
    this.#pending = ''
    this.writer(output)
  }
}
