/*
 * @japa/runner
 *
 * (c) Japa
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

// @ts-ignore-error
import getopts from 'getopts'
import colors from '@poppinss/colors'
import type { CLIArgs } from './types.js'

const ansi = colors.ansi()

/**
 * Known commandline options. The user can still define additional flags and they
 * will be parsed aswell, but without any normalization
 */
const OPTIONS = {
  string: ['tests', 'groups', 'tags', 'files', 'timeout', 'retries', 'reporter'],
  boolean: ['forceExit', 'help', 'matchAll'],
  alias: {
    forceExit: 'force-exit',
    matchAll: 'match-all',
    help: 'h',
  },
}

/**
 * Help string to display when the `--help flag is used`
 */
const GET_HELP = () => `
${ansi.yellow('@japa/runner v2.3.0')}

${ansi.green('--tests')}                     ${ansi.dim('Filter by test titles')}
${ansi.green('--groups')}                    ${ansi.dim('Filter by group titles')}
${ansi.green('--tags')}                      ${ansi.dim('Filter by test tags')}
${ansi.green('--files')}                     ${ansi.dim('Filter by tests file name')}
${ansi.green('--force-exit')}                ${ansi.dim('Forcefully exit the process')}
${ansi.green('--timeout')}                   ${ansi.dim('Define global timeout for tests')}
${ansi.green('--retries')}                   ${ansi.dim('Define global retries for tests')}
${ansi.green('--reporter')}                  ${ansi.dim('Define reporter(s) to use')}
${ansi.green('-h, --help')}                  ${ansi.dim('View commandline help')}

${ansi.yellow('Examples:')}
${ansi.dim('node bin/test.js --tags="@github"')}
${ansi.dim('node bin/test.js --tags="~@github"')}
${ansi.dim('node bin/test.js --tags="@github,@slow,@integration" --match-all')}
${ansi.dim('node bin/test.js --force-exit')}
${ansi.dim('node bin/test.js --files="user"')}
${ansi.dim('node bin/test.js --files="functional/user"')}
${ansi.dim('node bin/test.js --files="unit/user"')}

${ansi.yellow('Notes:')}
- When groups and tests filters are applied together. We will first filter the
  tests by group title and then apply the tests title filter.
- The timeout defined on test object takes precedence over the ${ansi.green('--timeout')} flag.
- The retries defined on test object takes precedence over the ${ansi.green('--retries')} flag.
- The ${ansi.green('--files')} flag checks for the file names ending with the filter substring.
`

/**
 * CLI Parser is used to parse the commandline argument
 */
export class CliParser {
  #argv: string[]

  constructor(argv: string[]) {
    this.#argv = argv
  }

  /**
   * Parses command-line arguments
   */
  parse(): CLIArgs {
    return getopts(this.#argv, OPTIONS)
  }

  /**
   * Returns the help string
   */
  getHelp() {
    return GET_HELP()
  }
}
