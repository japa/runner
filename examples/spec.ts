import { spec } from '../src/reporters/main.js'
import { createDummyTests, runner } from '../factories/main.js'

await runner()
  .configure({
    files: [],
    reporters: {
      list: [spec()],
      activated: ['spec'],
    },
  })
  .runSuites(createDummyTests)
