import { describe, it, expect } from 'vitest'
import * as Knex from 'knex'
import { knexTests } from './shared-tests/test-knex'
import { cast } from '../../core/src/isOfType.js'

describe('Sql Lite', () => {
  knexTests(
    Knex.default({
      client: 'better-sqlite3',
      connection: {
        filename: ':memory:',
      },
    }),
    ({ getDb }) => {
      it('test ddl', async () => {
        try {
          await cast(getDb(), 'execute').execute('drop table test')
        } catch {}
        await getDb().transaction(async (db1) => {
          const db = cast(db1, 'execute')

          await db.execute(
            'create table test (id integer primary key, val integer)',
          )
          await db.execute('insert into test (id,val) values (1,2)')
          const result = await db.execute('select * from test')
          expect(result.rows).toMatchInlineSnapshot(`
          [
            {
              "id": 1,
              "val": 2,
            },
          ]
        `)
        })
      })
    },
  )
})
