/*
 * @japa/runner
 *
 * (c) Japa
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
import getopts from 'getopts'
import { logger } from '@poppinss/cliui'
import { Config, Filters } from '../Contracts'

/**
 * Process command line argument into a string value
 */
function processAsString(
  argv: Record<string, any>,
  flagName: string,
  onMatch: (value: string[]) => any
): void {
  const flag = argv[flagName]
  if (flag) {
    onMatch((Array.isArray(flag) ? flag : flag.split(',')).map((tag: string) => tag.trim()))
  }
}

/**
 * Show help output in stdout.
 */
function showHelp() {
  const green = logger.colors.green.bind(logger.colors)
  const grey = logger.colors.grey.bind(logger.colors)

  console.log(`@japa/runner v2.1.1

Options:
  ${green('--tests')}                     ${grey('Specify test titles')}
  ${green('--tags')}                      ${grey('Specify test tags')}
  ${green('--groups')}                    ${grey('Specify group titles')}
  ${green('--ignore-tags')}               ${grey('Specify negated tags')}
  ${green('--files')}                     ${grey('Specify files to match and run')}
  ${green('--force-exit')}                ${grey('Enable/disable force exit')}
  ${green('--timeout')}                   ${grey('Define timeout for all the tests')}
  ${green('-h, --help')}                  ${grey('Display this message')}

Examples:
  ${grey('$ node bin/test.js --tags="@github"')}
  ${grey('$ node bin/test.js --files="example.spec.js" --force-exit')}`)
}

/**
 * Process CLI arguments into configuration options. The following
 * command line arguments are processed.
 *
 * * --tests=Specify test titles
 * * --tags=Specify test tags
 * * --groups=Specify group titles
 * * --ignore-tags=Specify negated tags
 * * --files=Specify files to match and run
 * * --force-exit=Enable/disable force exit
 * * --timeout=Define timeout for all the tests
 * * -h, --help=Show help
 */
export function processCliArgs(argv: string[]): Partial<Config> {
  const parsed = getopts(argv, {
    string: ['tests', 'tags', 'groups', 'ignoreTags', 'files', 'timeout'],
    boolean: ['forceExit', 'help'],
    alias: {
      ignoreTags: 'ignore-tags',
      forceExit: 'force-exit',
      help: 'h',
    },
  })

  const config: {
    filters: Filters
    timeout?: number
    forceExit?: boolean
  } = { filters: {} }

  processAsString(parsed, 'tags', (tags) => (config.filters.tags = tags))
  processAsString(parsed, 'ignoreTags', (tags) => {
    config.filters.tags = config.filters.tags || []
    tags.forEach((tag) => config.filters.tags!.push(`!${tag}`))
  })
  processAsString(parsed, 'groups', (groups) => (config.filters.groups = groups))
  processAsString(parsed, 'tests', (tests) => (config.filters.tests = tests))
  processAsString(parsed, 'files', (files) => (config.filters.files = files))

  /**
   * Show help
   */
  if (parsed.help) {
    showHelp()
    process.exit(0)
  }

  /**
   * Get suites
   */
  if (parsed._.length) {
    processAsString({ suites: parsed._ }, 'suites', (suites) => (config.filters.suites = suites))
  }

  /**
   * Get timeout
   */
  if (parsed.timeout) {
    const value = Number(parsed.timeout)
    if (!isNaN(value)) {
      config.timeout = value
    }
  }

  /**
   * Get forceExit
   */
  if (parsed.forceExit) {
    config.forceExit = true
  }

  return config
}
