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
import { colors } from './helpers.js'
import type { CLIArgs } from './types.js'

/**
 * Known commandline options. The user can still define additional flags and they
 * will be parsed aswell, but without any normalization
 */
const OPTIONS = {
  string: ['tests', 'groups', 'tags', 'files', 'timeout', 'retries', 'reporters', 'failed'],
  boolean: ['help', 'matchAll', 'failed'],
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
${colors.yellow('@japa/runner v2.3.0')}

${colors.green('--tests')}                     ${colors.dim('Filter tests by the test title')}
${colors.green('--groups')}                    ${colors.dim('Filter tests by the group title')}
${colors.green('--tags')}                      ${colors.dim('Filter tests by tags')}
${colors.green('--files')}                     ${colors.dim('Filter tests by the file name')}
${colors.green('--force-exit')}                ${colors.dim('Forcefully exit the process')}
${colors.green('--timeout')}                   ${colors.dim('Define default timeout for all tests')}
${colors.green('--retries')}                   ${colors.dim('Define default retries for all tests')}
${colors.green('--reporters')}                 ${colors.dim('Activate one or more test reporters')}
${colors.green('--failed')}                    ${colors.dim('Run tests failed during the last run')}
${colors.green('-h, --help')}                  ${colors.dim('View help')}

${colors.yellow('Examples:')}
${colors.dim('node bin/test.js --tags="@github"')}
${colors.dim('node bin/test.js --tags="~@github"')}
${colors.dim('node bin/test.js --tags="@github,@slow,@integration" --match-all')}
${colors.dim('node bin/test.js --force-exit')}
${colors.dim('node bin/test.js --files="user"')}
${colors.dim('node bin/test.js --files="functional/user"')}
${colors.dim('node bin/test.js --files="unit/user"')}

${colors.yellow('Notes:')}
- When groups and tests filters are applied together. We will first filter the
  tests by group title and then apply the tests title filter.
- The timeout defined on test object takes precedence over the ${colors.green('--timeout')} flag.
- The retries defined on test object takes precedence over the ${colors.green('--retries')} flag.
- The ${colors.green('--files')} flag checks for the file names ending with the filter substring.
`

/**
 * CLI Parser is used to parse the commandline argument
 */
export class CliParser {
  /**
   * Parses command-line arguments
   */
  parse(argv: string[]): CLIArgs {
    return getopts(argv, OPTIONS)
  }

  /**
   * Returns the help string
   */
  getHelp() {
    return GET_HELP()
  }
}
