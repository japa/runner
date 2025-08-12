import assert from 'node:assert'
import { Suite, Emitter, Refiner } from '../modules/core/main.js'
import { createTest, createTestGroup } from '../src/create_test.js'

/**
 * Creates a unit tests suite with bunch of dummy tests
 * reproducing different tests behavior
 */
function createUnitTestsSuite(emitter: Emitter, refiner: Refiner, file?: string) {
  const suite = new Suite('unit', emitter, refiner)
  const group = createTestGroup('Maths#add', emitter, refiner, {
    suite,
    file,
  })

  createTest('A top level test inside a suite', emitter, refiner, new Error(), {
    suite,
    file,
  }).run(() => {})

  createTest('add two numbers', emitter, refiner, new Error(), { group, file }).run(() => {
    assert.equal(2 + 2, 4)
  })
  createTest('add three numbers', emitter, refiner, new Error(), {
    group,
    file,
  }).run(() => {
    assert.equal(2 + 2 + 2, 6)
  })

  createTest('add group of numbers', emitter, refiner, new Error(), { group, file })
  createTest('use math.js lib', emitter, refiner, new Error(), { group, file }).skip(
    true,
    'Library work pending'
  )
  createTest('add multiple numbers', emitter, refiner, new Error(), {
    file,
    group,
  }).run(() => {
    assert.equal(2 + 2 + 2 + 2, 6)
  })
  createTest('add floating numbers', emitter, refiner, new Error(), { group, file })
    .run(() => {
      assert.equal(2 + 2.2 + 2.1, 6)
    })
    .fails('Have to add support for floating numbers')

  createTest('regression test that is passing', emitter, refiner, new Error(), { group, file })
    .run(() => {
      assert.equal(2 + 2.2 + 2.1, 2 + 2.2 + 2.1)
    })
    .fails('Have to add support for floating numbers')

  createTest('A test with an error that is not an AssertionError', emitter, refiner, new Error(), {
    group,
    file,
  }).run(() => {
    throw new Error('This is an error')
  })

  return suite
}

/**
 * Creates a unit functional suite with bunch of dummy tests
 * reproducing different tests behavior
 */
function createFunctionalTestsSuite(emitter: Emitter, refiner: Refiner, file?: string) {
  const suite = new Suite('functional', emitter, refiner)

  const group = createTestGroup('Users/store', emitter, refiner, {
    suite,
    file: file,
  })
  createTest('Validate user data', emitter, refiner, new Error(), {
    group,
    file: file,
  }).run(() => {})
  createTest('Disallow duplicate emails', emitter, refiner, new Error(), {
    group,
    file: file,
  }).run(() => {})
  createTest('Disallow duplicate emails across tenants', emitter, refiner, new Error(), {
    group,
    file: file,
  }).run(() => {
    const users = ['', '']
    assert.equal(users.length, 1)
  })
  createTest('Normalize email before persisting it', emitter, refiner, new Error(), {
    group,
    file: file,
  }).skip(true, 'Have to build a normalizer')
  createTest('Send email verification mail', emitter, refiner, new Error(), {
    group,
    file: file,
  })

  createTest('Test that times out', emitter, refiner, new Error(), {
    group,
    file: file,
  }).run(() => {
    return new Promise((resolve) => {
      setTimeout(resolve, 2100)
    })
  })

  const usersListGroup = createTestGroup('Users/list', emitter, refiner, {
    suite,
    file: file,
  })
  usersListGroup.setup(() => {
    throw new Error('Unable to cleanup database')
  })
  createTest(
    'A test that will never run because the group hooks fails',
    emitter,
    refiner,
    new Error(),
    {
      group: usersListGroup,
    }
  )

  createTest('A top level test inside functional suite', emitter, refiner, new Error(), {
    suite,
    file: file,
  }).run(() => {})

  return suite
}

/**
 * Returns an array of suites with dummy tests reproducting
 * different test behavior
 */
export function createDummyTests(emitter: Emitter, refiner: Refiner, file?: string): Suite[] {
  return [
    createUnitTestsSuite(emitter, refiner, file),
    createFunctionalTestsSuite(emitter, refiner, file),
  ]
}
