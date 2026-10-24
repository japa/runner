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

// Reuse the collator rather than resolving locale options for every comparison.
const FILE_COLLATOR = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

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
      return testFiles.sort(FILE_COLLATOR.compare).map((file) => pathToFileURL(join(cwd, file)))
    }

    return await files()
  }

  /**
   * Applies file name filter on a collection of file
   * URLs
   */
  grep(files: URL[], filters: string[]): URL[] {
    const compiledFilters = filters.map((filter) => ({
      value: filter,
      segments: filter.split('/').reverse(),
    }))

    return files.filter((file) => {
      const filename = string.toUnixSlash(file.pathname)
      const filenameWithoutTestSuffix = filename.replace(FILE_SUFFIX_EXPRESSION, '')

      const fileSegments = filenameWithoutTestSuffix.split('/').reverse()

      // Keep find's original truthiness behavior when a filter is an empty string.
      return !!compiledFilters.find(({ value, segments }) => {
        if (filename.endsWith(value)) {
          return true
        }

        return segments.every((segment, index) => {
          return fileSegments[index] && (segment === '*' || fileSegments[index].endsWith(segment))
        })
      })?.value
    })
  }
}
