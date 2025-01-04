import { ndjson } from '../src/reporters/main.js'
import { createDummyTests, runner } from '../factories/main.js'

await runner()
  .configure({
    files: [],
    reporters: {
      list: [ndjson()],
      activated: ['ndjson'],
    },
  })
  .runSuites(createDummyTests)
