import { runner } from '../factories/main.js'
import { ndjson } from '../src/reporters/main.js'

await runner()
  .configure({
    files: [],
    reporters: {
      list: [ndjson()],
      activated: ['ndjson'],
    },
  })
  .run()
