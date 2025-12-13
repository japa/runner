/*
 * @japa/runner
 *
 * (c) Japa
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { join } from 'node:path'
import string from '@poppinss/string'
import { glob } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import type { TestFiles } from './types.js'

/**
 * The expression to remove file extension and optionally
 * .spec|.test from the test file name
 */
const FILE_SUFFIX_EXPRESSION = /(\.spec|\.test)?\.[js|ts|jsx|tsx|mjs|mts|cjs|cts]+$/

/**
 * Files manager exposes the API to collect, filter and import test
 * files based upon the config
 */
export class FilesManager {
  /**
   * Returns a collection of files from the user defined
   * glob or the implementation function
   */
  async getFiles(cwd: string, files: TestFiles, excludes: string[]): Promise<URL[]> {
    if (Array.isArray(files) || typeof files === 'string') {
      const matchingFiles = glob(files, {
        withFileTypes: false,
        cwd: cwd,
        exclude: excludes,
      })

      const testFiles = await Array.fromAsync(matchingFiles)
      return testFiles
        .sort((current, next) => {
          return current.localeCompare(next, undefined, { numeric: true, sensitivity: 'base' })
        })
        .map((file) => pathToFileURL(join(cwd, file)))
    }

    return await files()
  }

  /**
   * Applies file name filter on a collection of file
   * URLs
   */
  grep(files: URL[], filters: string[]): URL[] {
    return files.filter((file) => {
      const filename = string.toUnixSlash(file.pathname)
      const filenameWithoutTestSuffix = filename.replace(FILE_SUFFIX_EXPRESSION, '')

      return !!filters.find((filter) => {
        if (filename.endsWith(filter)) {
          return true
        }

        const filterSegments = filter.split('/').reverse()
        const fileSegments = filenameWithoutTestSuffix.split('/').reverse()

        return filterSegments.every((segment, index) => {
          return fileSegments[index] && (segment === '*' || fileSegments[index].endsWith(segment))
        })
      })
    })
  }
}
