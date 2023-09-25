import { ndjson } from '../src/reporters/main.js'
import { createDiverseTests, runner } from '../factories/main.js'

await runner()
  .configure({
    files: [],
    reporters: {
      list: [ndjson()],
      activated: ['ndjson'],
    },
  })
  .runSuites(createDiverseTests)
