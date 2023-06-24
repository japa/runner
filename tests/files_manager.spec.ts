/*
 * @japa/runner
 *
 * (c) Japa
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { assert } from 'chai'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { FilesManager } from '../src/files_manager.js'
import { wrapAssertions } from '../tests_helpers/main.js'

const FILTERING_DATASET: { files: URL[]; filters: string[]; output: URL[] }[] = [
  {
    files: [
      pathToFileURL('tests/unit/create_user.spec.js'),
      pathToFileURL('tests/unit/list_user.spec.js'),
      pathToFileURL('tests/unit/edit_user.spec.js'),
      pathToFileURL('tests/functional/user.spec.js'),
      pathToFileURL('tests/functional/register_user.spec.js'),
    ],
    filters: ['user'],
    output: [
      pathToFileURL('tests/unit/create_user.spec.js'),
      pathToFileURL('tests/unit/list_user.spec.js'),
      pathToFileURL('tests/unit/edit_user.spec.js'),
      pathToFileURL('tests/functional/user.spec.js'),
      pathToFileURL('tests/functional/register_user.spec.js'),
    ],
  },
  {
    files: [
      pathToFileURL('tests/unit/create_user.spec.js'),
      pathToFileURL('tests/unit/list_user.spec.js'),
      pathToFileURL('tests/unit/edit_user.spec.js'),
      pathToFileURL('tests/functional/user.spec.js'),
      pathToFileURL('tests/functional/register_user.spec.js'),
    ],
    filters: ['unit/user'],
    output: [
      pathToFileURL('tests/unit/create_user.spec.js'),
      pathToFileURL('tests/unit/list_user.spec.js'),
      pathToFileURL('tests/unit/edit_user.spec.js'),
    ],
  },
  {
    files: [
      pathToFileURL('tests/unit/create_user.spec.js'),
      pathToFileURL('tests/unit/list_user.spec.js'),
      pathToFileURL('tests/unit/edit_user.spec.js'),
      pathToFileURL('tests/functional/user.spec.js'),
      pathToFileURL('tests/functional/register_user.spec.js'),
    ],
    filters: ['onal/user'],
    output: [
      pathToFileURL('tests/functional/user.spec.js'),
      pathToFileURL('tests/functional/register_user.spec.js'),
    ],
  },
  {
    files: [
      pathToFileURL('tests/unit/users/create.spec.js'),
      pathToFileURL('tests/unit/users/edit.spec.js'),
      pathToFileURL('tests/unit/users/delete.spec.js'),
      pathToFileURL('tests/functional/users.spec.js'),
      pathToFileURL('tests/functional/register_user.spec.js'),
    ],
    filters: ['unit/users/*'],
    output: [
      pathToFileURL('tests/unit/users/create.spec.js'),
      pathToFileURL('tests/unit/users/edit.spec.js'),
      pathToFileURL('tests/unit/users/delete.spec.js'),
    ],
  },
]

test.describe('Files manager | grep', () => {
  test('apply filter on the file name', async () => {
    for (let { files, filters, output } of FILTERING_DATASET) {
      await wrapAssertions(() => {
        assert.deepEqual(new FilesManager().grep(files, filters), output)
      })
    }
  })
})

test.describe('Files manager | getFiles', () => {
  test('get files for the glob pattern', async () => {
    const cwd = new URL('../', import.meta.url)
    const files = await new FilesManager().getFiles(fileURLToPath(cwd), ['tests/**/*.spec.ts'])

    await wrapAssertions(() => {
      assert.deepEqual(files, [
        new URL('tests/cli_parser.spec.ts', cwd),
        new URL('tests/config_manager.spec.ts', cwd),
        new URL('tests/core.spec.ts', cwd),
        new URL('tests/files_manager.spec.ts', cwd),
        new URL('tests/planner.spec.ts', cwd),
        new URL('tests/runner.spec.ts', cwd),
      ])
    })
  })

  test('get files from multiple glob patterns', async () => {
    const cwd = new URL('../', import.meta.url)
    const files = await new FilesManager().getFiles(fileURLToPath(cwd), [
      'tests/**/*.spec.ts',
      'modules/**/*.ts',
    ])

    await wrapAssertions(() => {
      assert.deepEqual(files, [
        new URL('tests/cli_parser.spec.ts', cwd),
        new URL('tests/config_manager.spec.ts', cwd),
        new URL('tests/core.spec.ts', cwd),
        new URL('tests/files_manager.spec.ts', cwd),
        new URL('tests/planner.spec.ts', cwd),
        new URL('tests/runner.spec.ts', cwd),
        new URL('modules/core/main.ts', cwd),
      ])
    })
  })

  test('get files from a custom implementation', async () => {
    const cwd = new URL('../', import.meta.url)
    const files = await new FilesManager().getFiles(fileURLToPath(cwd), () => {
      return [
        new URL('tests/cli_parser.spec.ts', cwd),
        new URL('tests/config_manager.spec.ts', cwd),
        new URL('tests/files_manager.spec.ts', cwd),
        new URL('modules/core/main.ts', cwd),
      ]
    })

    await wrapAssertions(() => {
      assert.deepEqual(files, [
        new URL('tests/cli_parser.spec.ts', cwd),
        new URL('tests/config_manager.spec.ts', cwd),
        new URL('tests/files_manager.spec.ts', cwd),
        new URL('modules/core/main.ts', cwd),
      ])
    })
  })
})
