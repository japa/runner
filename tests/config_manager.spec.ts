/*
 * @japa/runner
 *
 * (c) Japa
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from 'node:test'
import chaiSubset from 'chai-subset'
import { Refiner } from '@japa/core'
import { assert, default as chai } from 'chai'

import { CliParser } from '../src/cli_parser.js'
import type { CLIArgs, Config } from '../src/types.js'
import { wrapAssertions } from '../tests_helpers/main.js'
import { ndjson, spec, dot } from '../src/reporters/main.js'
import { ConfigManager, NOOP } from '../src/config_manager.js'

chai.use(chaiSubset)

const USER_DEFINED_CONFIG_DATASET: [Config, Config][] = [
  [
    {
      files: [],
    },
    {
      cwd: process.cwd(),
      files: [],
      filters: {},
      forceExit: false,
      refiner: new Refiner(),
      reporters: {
        activated: ['spec'],
        list: [spec(), ndjson(), dot()],
      },
      setup: [],
      teardown: [],
      plugins: [],
      retries: 0,
      timeout: 2000,
    },
  ],
  [
    {
      files: ['tests/unit/**.spec.ts'],
    },
    {
      cwd: process.cwd(),
      files: ['tests/unit/**.spec.ts'],
      filters: {},
      forceExit: false,
      refiner: new Refiner(),
      reporters: {
        activated: ['spec'],
        list: [spec(), ndjson(), dot()],
      },
      plugins: [],
      setup: [],
      teardown: [],
      retries: 0,
      timeout: 2000,
    },
  ],
  [
    {
      files: ['tests/unit/**.spec.ts'],
      timeout: 4000,
    },
    {
      cwd: process.cwd(),
      files: ['tests/unit/**.spec.ts'],
      filters: {},
      forceExit: false,
      refiner: new Refiner(),
      reporters: {
        activated: ['spec'],
        list: [spec(), ndjson(), dot()],
      },
      plugins: [],
      setup: [],
      teardown: [],
      retries: 0,
      timeout: 4000,
    },
  ],
  [
    {
      files: ['tests/unit/**.spec.ts'],
      timeout: 4000,
      retries: 2,
    },
    {
      cwd: process.cwd(),
      files: ['tests/unit/**.spec.ts'],
      filters: {},
      forceExit: false,
      refiner: new Refiner(),
      reporters: {
        activated: ['spec'],
        list: [spec(), ndjson(), dot()],
      },
      plugins: [],
      setup: [],
      teardown: [],
      retries: 2,
      timeout: 4000,
    },
  ],
  [
    {
      files: ['tests/unit/**.spec.ts'],
      timeout: 4000,
      retries: 2,
    },
    {
      cwd: process.cwd(),
      files: ['tests/unit/**.spec.ts'],
      filters: {},
      forceExit: false,
      refiner: new Refiner(),
      reporters: {
        activated: ['spec'],
        list: [spec(), ndjson(), dot()],
      },
      plugins: [],
      setup: [],
      teardown: [],
      retries: 2,
      timeout: 4000,
    },
  ],
  [
    {
      files: ['tests/unit/**.spec.ts'],
      timeout: 4000,
      retries: 2,
      filters: {
        tags: ['@integration', '~@slow'],
        tests: ['users list'],
      },
    },
    {
      cwd: process.cwd(),
      files: ['tests/unit/**.spec.ts'],
      filters: {
        tags: ['@integration', '~@slow'],
        tests: ['users list'],
      },
      forceExit: false,
      refiner: new Refiner(),
      reporters: {
        activated: ['spec'],
        list: [spec(), ndjson(), dot()],
      },
      plugins: [],
      setup: [],
      teardown: [],
      retries: 2,
      timeout: 4000,
    },
  ],
  [
    {
      files: ['tests/unit/**.spec.ts'],
      timeout: 4000,
      retries: 2,
      filters: {
        tags: ['@integration', '~@slow'],
        tests: ['users list'],
      },
      forceExit: true,
    },
    {
      cwd: process.cwd(),
      files: ['tests/unit/**.spec.ts'],
      filters: {
        tags: ['@integration', '~@slow'],
        tests: ['users list'],
      },
      forceExit: true,
      refiner: new Refiner(),
      reporters: {
        activated: ['spec'],
        list: [spec(), ndjson(), dot()],
      },
      plugins: [],
      setup: [],
      teardown: [],
      retries: 2,
      timeout: 4000,
    },
  ],
  [
    {
      files: [],
      reporters: {
        activated: ['dot'],
        list: [],
      },
    },
    {
      cwd: process.cwd(),
      files: [],
      filters: {},
      forceExit: false,
      refiner: new Refiner(),
      reporters: {
        activated: ['dot'],
        list: [],
      },
      plugins: [],
      setup: [],
      teardown: [],
      retries: 0,
      timeout: 2000,
    },
  ],
  [
    {
      files: [],
      reporters: {
        activated: ['dot'],
      },
    },
    {
      cwd: process.cwd(),
      files: [],
      filters: {},
      forceExit: false,
      refiner: new Refiner(),
      reporters: {
        activated: ['dot'],
        list: [spec(), ndjson(), dot()],
      },
      plugins: [],
      setup: [],
      teardown: [],
      retries: 0,
      timeout: 2000,
    },
  ],
]

const USER_DEFINED_CONFIG_DATASET_WITH_CLI_ARGS: [Config, CLIArgs, Config][] = [
  [
    {
      files: [],
    },
    new CliParser().parse([]),
    {
      cwd: process.cwd(),
      files: [],
      filters: {},
      forceExit: false,
      refiner: new Refiner(),
      reporters: {
        activated: ['spec'],
        list: [spec(), ndjson(), dot()],
      },
      plugins: [],
      setup: [],
      teardown: [],
      retries: 0,
      timeout: 2000,
    },
  ],
  [
    {
      files: ['tests/unit/**.spec.ts'],
    },
    new CliParser().parse(['--tags=@slow']),
    {
      cwd: process.cwd(),
      files: ['tests/unit/**.spec.ts'],
      filters: {
        tags: ['@slow'],
      },
      forceExit: false,
      refiner: new Refiner(),
      reporters: {
        activated: ['spec'],
        list: [spec(), ndjson(), dot()],
      },
      plugins: [],
      setup: [],
      teardown: [],
      retries: 0,
      timeout: 2000,
    },
  ],
  [
    {
      files: ['tests/unit/**.spec.ts'],
      timeout: 4000,
    },
    new CliParser().parse(['--timeout=1000']),
    {
      cwd: process.cwd(),
      files: ['tests/unit/**.spec.ts'],
      filters: {},
      forceExit: false,
      refiner: new Refiner(),
      reporters: {
        activated: ['spec'],
        list: [spec(), ndjson(), dot()],
      },
      plugins: [],
      setup: [],
      teardown: [],
      retries: 0,
      timeout: 1000,
    },
  ],
  [
    {
      suites: [
        {
          name: 'unit',
          files: 'tests/unit/**.spec.ts',
          timeout: 3000,
        },
      ],
      timeout: 4000,
    },
    new CliParser().parse(['--timeout=1000']),
    {
      cwd: process.cwd(),
      suites: [
        {
          name: 'unit',
          files: 'tests/unit/**.spec.ts',
          timeout: 1000,
          retries: 0,
          configure: NOOP,
        },
      ],
      filters: {},
      forceExit: false,
      refiner: new Refiner(),
      reporters: {
        activated: ['spec'],
        list: [spec(), ndjson(), dot()],
      },
      plugins: [],
      setup: [],
      teardown: [],
      retries: 0,
      timeout: 1000,
    },
  ],
  [
    {
      files: ['tests/unit/**.spec.ts'],
      timeout: 4000,
      retries: 2,
    },
    new CliParser().parse(['--retries=4']),
    {
      cwd: process.cwd(),
      files: ['tests/unit/**.spec.ts'],
      filters: {},
      forceExit: false,
      refiner: new Refiner(),
      reporters: {
        activated: ['spec'],
        list: [spec(), ndjson(), dot()],
      },
      plugins: [],
      setup: [],
      teardown: [],
      retries: 4,
      timeout: 4000,
    },
  ],
  [
    {
      suites: [
        {
          name: 'unit',
          files: 'tests/unit/**.spec.ts',
          retries: 2,
        },
      ],
      retries: 0,
    },
    new CliParser().parse(['--retries=4']),
    {
      cwd: process.cwd(),
      suites: [
        {
          name: 'unit',
          files: 'tests/unit/**.spec.ts',
          timeout: 2000,
          retries: 4,
          configure: NOOP,
        },
      ],
      filters: {},
      forceExit: false,
      refiner: new Refiner(),
      reporters: {
        activated: ['spec'],
        list: [spec(), ndjson(), dot()],
      },
      plugins: [],
      setup: [],
      teardown: [],
      retries: 4,
      timeout: 2000,
    },
  ],
  [
    {
      files: ['tests/unit/**.spec.ts'],
      timeout: 4000,
      retries: 2,
    },
    new CliParser().parse(['--timeout=1000', '--retries=4']),
    {
      cwd: process.cwd(),
      files: ['tests/unit/**.spec.ts'],
      filters: {},
      forceExit: false,
      refiner: new Refiner(),
      reporters: {
        activated: ['spec'],
        list: [spec(), ndjson(), dot()],
      },
      plugins: [],
      setup: [],
      teardown: [],
      retries: 4,
      timeout: 1000,
    },
  ],
  [
    {
      files: ['tests/unit/**.spec.ts'],
      timeout: 4000,
      retries: 2,
      filters: {
        tags: ['@integration', '~@slow'],
        tests: ['users list'],
      },
    },
    new CliParser().parse(['--tags=@slow']),
    {
      cwd: process.cwd(),
      files: ['tests/unit/**.spec.ts'],
      filters: {
        tags: ['@slow'],
        tests: ['users list'],
      },
      forceExit: false,
      refiner: new Refiner(),
      reporters: {
        activated: ['spec'],
        list: [spec(), ndjson(), dot()],
      },
      plugins: [],
      setup: [],
      teardown: [],
      retries: 2,
      timeout: 4000,
    },
  ],
  [
    {
      files: ['tests/unit/**.spec.ts'],
      timeout: 4000,
      retries: 2,
      filters: {
        tags: ['@integration', '~@slow'],
        tests: ['users list'],
      },
      forceExit: true,
    },
    new CliParser().parse(['--tests=users']),
    {
      cwd: process.cwd(),
      files: ['tests/unit/**.spec.ts'],
      filters: {
        tags: ['@integration', '~@slow'],
        tests: ['users'],
      },
      forceExit: true,
      refiner: new Refiner(),
      reporters: {
        activated: ['spec'],
        list: [spec(), ndjson(), dot()],
      },
      plugins: [],
      setup: [],
      teardown: [],
      retries: 2,
      timeout: 4000,
    },
  ],
  [
    {
      files: ['tests/unit/**.spec.ts'],
      timeout: 4000,
      retries: 2,
      filters: {
        tags: ['@integration', '~@slow'],
        groups: ['user'],
      },
      forceExit: true,
    },
    new CliParser().parse(['--groups=customers']),
    {
      cwd: process.cwd(),
      files: ['tests/unit/**.spec.ts'],
      filters: {
        tags: ['@integration', '~@slow'],
        groups: ['customers'],
      },
      forceExit: true,
      refiner: new Refiner(),
      reporters: {
        activated: ['spec'],
        list: [spec(), ndjson(), dot()],
      },
      plugins: [],
      setup: [],
      teardown: [],
      retries: 2,
      timeout: 4000,
    },
  ],
  [
    {
      files: ['tests/unit/**.spec.ts'],
      timeout: 4000,
      retries: 2,
      filters: {
        tags: ['@integration', '~@slow'],
        files: ['unit/users/*'],
      },
      forceExit: true,
    },
    new CliParser().parse(['--files=*']),
    {
      cwd: process.cwd(),
      files: ['tests/unit/**.spec.ts'],
      filters: {
        tags: ['@integration', '~@slow'],
        files: ['*'],
      },
      forceExit: true,
      refiner: new Refiner(),
      reporters: {
        activated: ['spec'],
        list: [spec(), ndjson(), dot()],
      },
      plugins: [],
      setup: [],
      teardown: [],
      retries: 2,
      timeout: 4000,
    },
  ],
  [
    {
      files: ['tests/unit/**.spec.ts'],
      timeout: 4000,
      retries: 2,
      filters: {
        tags: ['@integration', '~@slow'],
        tests: ['users list'],
        suites: ['unit'],
      },
      forceExit: true,
    },
    new CliParser().parse(['unit', 'functional']),
    {
      cwd: process.cwd(),
      files: ['tests/unit/**.spec.ts'],
      filters: {
        tags: ['@integration', '~@slow'],
        tests: ['users list'],
        suites: ['unit', 'functional'],
      },
      forceExit: true,
      refiner: new Refiner(),
      reporters: {
        activated: ['spec'],
        list: [spec(), ndjson(), dot()],
      },
      plugins: [],
      setup: [],
      teardown: [],
      retries: 2,
      timeout: 4000,
    },
  ],
  [
    {
      files: [],
      reporters: {
        activated: ['dot'],
        list: [spec()],
      },
    },
    new CliParser().parse(['--reporters', 'progress']),
    {
      cwd: process.cwd(),
      files: [],
      filters: {},
      forceExit: false,
      refiner: new Refiner(),
      reporters: {
        activated: ['progress'],
        list: [spec()],
      },
      plugins: [],
      setup: [],
      teardown: [],
      retries: 0,
      timeout: 2000,
    },
  ],
  [
    {
      files: [],
      reporters: {
        activated: ['spec'],
        list: [spec()],
      },
    },
    new CliParser().parse(['--force-exit']),
    {
      cwd: process.cwd(),
      files: [],
      filters: {},
      forceExit: true,
      refiner: new Refiner(),
      reporters: {
        activated: ['spec'],
        list: [spec()],
      },
      plugins: [],
      setup: [],
      teardown: [],
      retries: 0,
      timeout: 2000,
    },
  ],
  [
    {
      files: [],
      reporters: {
        activated: ['spec'],
        list: [spec()],
      },
    },
    new CliParser().parse(['--force-exit=true']),
    {
      cwd: process.cwd(),
      files: [],
      filters: {},
      forceExit: true,
      refiner: new Refiner(),
      reporters: {
        activated: ['spec'],
        list: [spec()],
      },
      plugins: [],
      setup: [],
      teardown: [],
      retries: 0,
      timeout: 2000,
    },
  ],
  [
    {
      files: [],
      reporters: {
        activated: ['spec'],
        list: [spec()],
      },
    },
    new CliParser().parse(['--force-exit=false']),
    {
      cwd: process.cwd(),
      files: [],
      filters: {},
      forceExit: false,
      refiner: new Refiner(),
      reporters: {
        activated: ['spec'],
        list: [spec()],
      },
      plugins: [],
      setup: [],
      teardown: [],
      retries: 0,
      timeout: 2000,
    },
  ],
]

test.describe('Config manager', () => {
  test('hydrate config from user defined config', async () => {
    let index = -1
    for (let [userConfig, output] of USER_DEFINED_CONFIG_DATASET) {
      index++
      const manager = new ConfigManager(userConfig, {})

      const config = manager.hydrate() as Config
      await wrapAssertions(() => {
        const actualReporters = output.reporters
        const expectedReporters = config.reporters
        const actualReportersList = actualReporters?.list?.map((r) => r.name)
        const expectedReportersList = expectedReporters?.list?.map((r) => r.name)

        delete config.importer
        delete config.configureSuite
        delete config.reporters
        delete output.reporters

        assert.deepEqual(config, output)
        assert.deepEqual(actualReporters?.activated, expectedReporters?.activated)
        assert.deepEqual(actualReportersList, expectedReportersList)
      })
    }
  })

  test('hydrate config from user defined config and CLI args', async () => {
    let index = -1
    for (let [userConfig, cliArgs, output] of USER_DEFINED_CONFIG_DATASET_WITH_CLI_ARGS) {
      index++
      const manager = new ConfigManager(userConfig, cliArgs)

      const config = manager.hydrate() as Config
      await wrapAssertions(() => {
        const actualReporters = output.reporters
        const expectedReporters = config.reporters
        const actualReportersList = actualReporters?.list?.map((r) => r.name)
        const expectedReportersList = expectedReporters?.list?.map((r) => r.name)

        delete config.importer
        delete config.configureSuite
        delete config.reporters
        delete output.reporters

        assert.deepEqual(config, output)
        assert.deepEqual(actualReporters?.activated, expectedReporters?.activated)
        assert.deepEqual(actualReportersList, expectedReportersList)
      })
    }
  })
})
