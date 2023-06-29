/*
 * @japa/runner
 *
 * (c) Japa
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import slash from 'slash'
import fastGlob from 'fast-glob'
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
  async getFiles(cwd: string, files: TestFiles): Promise<URL[]> {
    if (Array.isArray(files) || typeof files === 'string') {
      const testFiles = await fastGlob(files, {
        absolute: true,
        onlyFiles: true,
        cwd: cwd,
      })
      return testFiles.map((file) => pathToFileURL(file))
    }

    return await files()
  }

  /**
   * Applies file name filter on a collection of file
   * URLs
   */
  grep(files: URL[], filters: string[]): URL[] {
    return files.filter((file) => {
      const filename = slash(file.pathname)
      const filenameWithoutTestSuffix = filename.replace(FILE_SUFFIX_EXPRESSION, '')
      console.log({ filename })

      return !!filters.find((filter) => {
        if (filename.endsWith(filter)) {
          return true
        }

        const filterSegments = filter.split('/').reverse()
        const fileSegments = filenameWithoutTestSuffix.split('/').reverse()
        console.log({ filterSegments, fileSegments })

        return filterSegments.every((segment, index) => {
          return fileSegments[index] && (segment === '*' || fileSegments[index].endsWith(segment))
        })
      })
    })
  }
}
