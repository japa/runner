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
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { FilesManager } from '../src/files_manager.js'
import { wrapAssertions } from './helpers.js'

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
  {
    files: [
      pathToFileURL('tests/unit/users/create.spec.js'),
      pathToFileURL('tests/unit/users/edit.spec.js'),
      pathToFileURL('tests/unit/users/delete.spec.js'),
      pathToFileURL('tests/functional/users.spec.js'),
      pathToFileURL('tests/functional/register_user.spec.js'),
    ],
    filters: ['users/create.spec.js'],
    output: [pathToFileURL('tests/unit/users/create.spec.js')],
  },
]

test.describe('Files manager | grep', () => {
  test('preserve suffix, wildcard, empty and URL-encoded filter behavior', () => {
    const files = [
      pathToFileURL('/tests/unit/user2.spec.ts'),
      pathToFileURL('/tests/unit/user10.spec.ts'),
      pathToFileURL('/tests/functional/user.spec.ts'),
      pathToFileURL('/tests/unit/café user.spec.ts'),
    ]
    const manager = new FilesManager()
    assert.deepEqual(manager.grep(files, ['unit/user2', 'functional/*']), [files[0], files[2]])
    assert.deepEqual(manager.grep(files, ['user10.spec.ts']), [files[1]])
    assert.deepEqual(manager.grep(files, ['caf%C3%A9%20user']), [files[3]])
    assert.deepEqual(manager.grep(files, []), [])
    assert.deepEqual(manager.grep(files, ['', 'user2']), [])
    assert.deepEqual(manager.grep(files, ['user2', '']), [files[0]])
  })

  test('apply filter on the file name', async () => {
    for (let { files, filters, output } of FILTERING_DATASET) {
      await wrapAssertions(() => {
        assert.deepEqual(new FilesManager().grep(files, filters), output)
      })
    }
  })
})

test.describe('Files manager | getFiles', () => {
  test('preserve locale-aware numeric ordering used by shards', async (context) => {
    const cwd = await mkdtemp(fileURLToPath(new URL('../.files-manager-', import.meta.url)))
    context.after(() => rm(cwd, { recursive: true, force: true }))
    const names = ['test10.spec.ts', 'test2.spec.ts', 'Test1.spec.ts', 'café.spec.ts', 'z.spec.ts']
    await Promise.all(names.map((name) => writeFile(join(cwd, name), '')))
    const expected = [...names]
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
      .map((name) => pathToFileURL(join(cwd, name)))
    assert.deepEqual(await new FilesManager().getFiles(cwd, '*.spec.ts', []), expected)
  })

  test('get files for the glob pattern', async () => {
    const cwd = new URL('../', import.meta.url)
    const files = await new FilesManager().getFiles(fileURLToPath(cwd), ['tests/**/*.spec.ts'], [])

    await wrapAssertions(() => {
      assert.deepEqual(files, [
        new URL('tests/base_reporter.spec.ts', cwd),
        new URL('tests/cli_parser.spec.ts', cwd),
        new URL('tests/config_manager.spec.ts', cwd),
        new URL('tests/core.spec.ts', cwd),
        new URL('tests/files_manager.spec.ts', cwd),
        new URL('tests/github_reporter.spec.ts', cwd),
        new URL('tests/helpers.spec.ts', cwd),
        new URL('tests/planner.spec.ts', cwd),
        new URL('tests/runner.spec.ts', cwd),
      ])
    })
  })

  test('get files from multiple glob patterns', async () => {
    const cwd = new URL('../', import.meta.url)
    const files = await new FilesManager().getFiles(
      fileURLToPath(cwd),
      ['tests/**/*.spec.ts', 'modules/**/*.ts'],
      []
    )

    await wrapAssertions(() => {
      assert.deepEqual(files, [
        new URL('modules/core/main.ts', cwd),
        new URL('modules/core/reporters/base.ts', cwd),
        new URL('modules/core/types.ts', cwd),
        new URL('tests/base_reporter.spec.ts', cwd),
        new URL('tests/cli_parser.spec.ts', cwd),
        new URL('tests/config_manager.spec.ts', cwd),
        new URL('tests/core.spec.ts', cwd),
        new URL('tests/files_manager.spec.ts', cwd),
        new URL('tests/github_reporter.spec.ts', cwd),
        new URL('tests/helpers.spec.ts', cwd),
        new URL('tests/planner.spec.ts', cwd),
        new URL('tests/runner.spec.ts', cwd),
      ])
    })
  })

  test('ignore files using the exclude pattern', async () => {
    const cwd = new URL('../', import.meta.url)
    const files = await new FilesManager().getFiles(
      fileURLToPath(cwd),
      ['tests/**/*.spec.ts', 'modules/**/*.ts'],
      ['modules/**']
    )

    await wrapAssertions(() => {
      assert.deepEqual(files, [
        new URL('tests/base_reporter.spec.ts', cwd),
        new URL('tests/cli_parser.spec.ts', cwd),
        new URL('tests/config_manager.spec.ts', cwd),
        new URL('tests/core.spec.ts', cwd),
        new URL('tests/files_manager.spec.ts', cwd),
        new URL('tests/github_reporter.spec.ts', cwd),
        new URL('tests/helpers.spec.ts', cwd),
        new URL('tests/planner.spec.ts', cwd),
        new URL('tests/runner.spec.ts', cwd),
      ])
    })
  })

  test('get files from a custom implementation', async () => {
    const cwd = new URL('../', import.meta.url)
    const files = await new FilesManager().getFiles(
      fileURLToPath(cwd),
      () => {
        return [
          new URL('tests/cli_parser.spec.ts', cwd),
          new URL('tests/config_manager.spec.ts', cwd),
          new URL('tests/files_manager.spec.ts', cwd),
          new URL('tests/github_reporter.spec.ts', cwd),
          new URL('modules/core/main.ts', cwd),
        ]
      },
      []
    )

    await wrapAssertions(() => {
      assert.deepEqual(files, [
        new URL('tests/cli_parser.spec.ts', cwd),
        new URL('tests/config_manager.spec.ts', cwd),
        new URL('tests/files_manager.spec.ts', cwd),
        new URL('tests/github_reporter.spec.ts', cwd),
        new URL('modules/core/main.ts', cwd),
      ])
    })
  })
})
