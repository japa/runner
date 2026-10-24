#!/usr/bin/env node

import { runParallel } from '../src/parallel.js'

async function main() {
  const cliArguments = process.argv.slice(2)
  const separator = cliArguments.indexOf('--')
  const options = separator < 0 ? cliArguments : cliArguments.slice(0, separator)
  if (separator < 0 || options.includes('--help')) {
    console.log(
      'Usage: [JAPA_WORKERS=4|auto] japa-parallel [--workers=4|auto] [--history=path] [--cwd=path] -- node bin/test.js unit'
    )
    return options.includes('--help') ? 0 : 1
  }
  // JAPA_WORKERS lets a package script fix the count: arguments after `npm run x --`
  // land after the `--` separator and reach the test command, not the coordinator.
  const fromEnv = process.env.JAPA_WORKERS
  let workers: number | 'auto' | undefined =
    fromEnv === undefined || fromEnv === ''
      ? undefined
      : fromEnv === 'auto'
        ? 'auto'
        : Number(fromEnv)
  let historyFile: string | undefined
  let cwd: string | undefined
  for (let index = 0; index < options.length; index++) {
    const option = options[index]
    if (option.startsWith('--workers=')) {
      const value = option.slice('--workers='.length)
      workers = value === 'auto' ? 'auto' : Number(value)
    } else if (option === '--workers') {
      const value = options[++index]
      workers = value === 'auto' ? 'auto' : Number(value)
    } else if (option.startsWith('--cwd=')) cwd = option.slice('--cwd='.length)
    else if (option === '--cwd') {
      cwd = options[++index]
      if (!cwd) throw new Error('--cwd requires a directory')
    } else if (option.startsWith('--history=')) historyFile = option.slice('--history='.length)
    else if (option === '--history') {
      historyFile = options[++index]
      if (!historyFile) throw new Error('--history requires a path')
    } else throw new Error(`Unknown coordinator option: ${option}`)
  }
  const [command, ...args] = cliArguments.slice(separator + 1)
  const updateBaseline = args.includes('--update-baseline')
  const controller = new AbortController()
  let signalCode: number | undefined
  const interrupt = () => {
    signalCode = 130
    controller.abort()
  }
  const terminate = () => {
    signalCode = 143
    controller.abort()
  }
  process.once('SIGINT', interrupt)
  process.once('SIGTERM', terminate)
  try {
    const result = await runParallel({
      command,
      args,
      workers,
      historyFile,
      cwd,
      updateBaseline,
      signal: controller.signal,
    })
    for (const worker of result.workers) {
      if (worker.error) console.error(`[japa-parallel] worker ${worker.worker}: ${worker.error}`)
    }
    if (updateBaseline && !result.baselineUpdated) {
      console.error(
        `[japa-parallel] baseline not updated: ${result.baselineSkipped ?? 'the run was partial or incomplete'}`
      )
    } else if (updateBaseline && result.baselineChanges?.added && result.baselineChanges.removed) {
      console.error(
        `[japa-parallel] baseline changed in both directions ` +
          `(${result.baselineChanges.added} added, ${result.baselineChanges.removed} removed); ` +
          'rerun on a quiet machine if unexpected'
      )
    }
    const exitCode = signalCode ?? result.exitCode
    console.log(
      `[japa-parallel] workers=${result.workers.length} exit=${exitCode} timings=${result.historyUpdated ? 'updated' : 'unchanged'}${result.baselineUpdated ? ' baseline=updated' : ''}`
    )
    return exitCode
  } finally {
    process.removeListener('SIGINT', interrupt)
    process.removeListener('SIGTERM', terminate)
  }
}

try {
  process.exitCode = await main()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
