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

import { spec } from '../src/reporters/main.js'
import { CliParser } from '../src/cli_parser.js'
import type { CLIArgs, Config } from '../src/types.js'
import { ConfigManager } from '../src/config_manager.js'
import { wrapAssertions } from '../tests_helpers/main.js'

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
        list: [spec()],
      },
      setup: [],
      teardown: [],
      plugins: [],
      retries: 1,
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
        list: [spec()],
      },
      plugins: [],
      setup: [],
      teardown: [],
      retries: 1,
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
        list: [spec()],
      },
      plugins: [],
      setup: [],
      teardown: [],
      retries: 1,
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
        list: [spec()],
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
        list: [spec()],
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
        list: [spec()],
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
        list: [spec()],
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
      retries: 1,
      timeout: 2000,
    },
  ],
]

const USER_DEFINED_CONFIG_DATASET_WITH_CLI_ARGS: [Config, CLIArgs, Config][] = [
  [
    {
      files: [],
    },
    new CliParser([]).parse(),
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
      retries: 1,
      timeout: 2000,
    },
  ],
  [
    {
      files: ['tests/unit/**.spec.ts'],
    },
    new CliParser(['--tags=@slow']).parse(),
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
        list: [spec()],
      },
      plugins: [],
      setup: [],
      teardown: [],
      retries: 1,
      timeout: 2000,
    },
  ],
  [
    {
      files: ['tests/unit/**.spec.ts'],
      timeout: 4000,
    },
    new CliParser(['--timeout=1000']).parse(),
    {
      cwd: process.cwd(),
      files: ['tests/unit/**.spec.ts'],
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
      retries: 1,
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
    new CliParser(['--timeout=1000']).parse(),
    {
      cwd: process.cwd(),
      suites: [
        {
          name: 'unit',
          files: 'tests/unit/**.spec.ts',
          timeout: 1000,
          retries: 1,
          configure: undefined,
        },
      ],
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
      retries: 1,
      timeout: 1000,
    },
  ],
  [
    {
      files: ['tests/unit/**.spec.ts'],
      timeout: 4000,
      retries: 2,
    },
    new CliParser(['--retries=4']).parse(),
    {
      cwd: process.cwd(),
      files: ['tests/unit/**.spec.ts'],
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
      retries: 1,
    },
    new CliParser(['--retries=4']).parse(),
    {
      cwd: process.cwd(),
      suites: [
        {
          name: 'unit',
          files: 'tests/unit/**.spec.ts',
          timeout: 2000,
          retries: 4,
          configure: undefined,
        },
      ],
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
    new CliParser(['--timeout=1000', '--retries=4']).parse(),
    {
      cwd: process.cwd(),
      files: ['tests/unit/**.spec.ts'],
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
    new CliParser(['--tags=@slow']).parse(),
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
        list: [spec()],
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
    new CliParser(['--tests=users']).parse(),
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
        list: [spec()],
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
    new CliParser(['--groups=customers']).parse(),
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
        list: [spec()],
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
    new CliParser(['--files=*']).parse(),
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
        list: [spec()],
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
    new CliParser(['unit', 'functional']).parse(),
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
        list: [spec()],
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
    new CliParser(['--reporter', 'progress']).parse(),
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
      retries: 1,
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

        delete config.importer
        delete config.configureSuite
        delete config.reporters
        delete output.reporters

        assert.deepEqual(config, output)
        assert.deepEqual(actualReporters?.activated, expectedReporters?.activated)
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

        delete config.importer
        delete config.configureSuite
        delete config.reporters
        delete output.reporters

        assert.deepEqual(config, output)
        assert.deepEqual(actualReporters?.activated, expectedReporters?.activated)
      })
    }
  })
})
