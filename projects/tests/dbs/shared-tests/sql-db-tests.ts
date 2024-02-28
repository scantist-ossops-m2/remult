import { it, expect } from 'vitest'
import { DbTestProps } from './db-tests-props'
import { createEntity as createEntityClass } from '../../tests/dynamic-classes'
import { Entity, Fields, dbNamesOf, remult } from '../../../core'

export function SqlDbTests({ createEntity, getRemult, getDb }: DbTestProps) {
  it('test dbReadonly ', async () => {
    const e = await createEntity(
      createEntityClass('x', {
        id: Fields.number(),
        a: Fields.number(),
        b: Fields.number({ dbReadOnly: true }),
        c: Fields.number({ sqlExpression: () => 'a+5' }),
      }),
    )
    const result = await e.insert({ id: 1, a: 1, b: 2 })
    expect(result).toMatchInlineSnapshot(`
      x {
        "a": 1,
        "b": 0,
        "c": 6,
        "id": 1,
      }
    `)
  })
  it('test wrap identifier', async () => {
    const dp = remult.dataProvider
    try {
      remult.dataProvider = getDb()
      @Entity('x_aTb')
      class c {
        @Fields.number()
        id = 0
        @Fields.number()
        aTb = 0
        @Fields.number({
          sqlExpression: async (x) => {
            let db = await dbNamesOf(c)
            return `${db.aTb}+2`
          },
        })
        c = 0
      }
      const e = await createEntity(c)
      const result = await e.insert({ id: 2, aTb: 1 })
      expect(result).toMatchInlineSnapshot(`
        c {
          "aTb": 1,
          "c": 3,
          "id": 2,
        }
      `)
    } finally {
      remult.dataProvider = dp
    }
  })

  it('load dbNamesOf', async () => {
    const dp = remult.dataProvider
    try {
      remult.dataProvider = getDb()
      @Entity('e_load_d')
      class d {
        @Fields.number()
        id = 0
      }
      @Entity('e_load_c')
      class c {
        @Fields.number()
        id = 0
        @Fields.number({
          sqlExpression: async (x) => {
            let db = await dbNamesOf(c)
            let db2 = await dbNamesOf(d)
            return `${db.id} + (SELECT ${db2.id} FROM ${db2.$entityName} LIMIT 1) + 1`
          },
        })
        a = 0
        @Fields.number({
          sqlExpression: async (x) => {
            let db = await dbNamesOf(c)
            let db2 = await dbNamesOf(d)
            return `${db.id} + (SELECT ${db2.id} FROM ${db2.$entityName} LIMIT 1) + 2`
          },
        })
        b = 0
      }
      const e = await createEntity(c)
      await e.insert({ id: 1 })
      const f = await createEntity(d)
      await f.insert({ id: 1 })

      const res = await e.find()
      expect(res).toMatchInlineSnapshot(`
        [
          c {
            "a": 3,
            "b": 4,
            "id": 1,
          },
        ]
      `)

      const start = new Date().getTime()
      await Promise.all(
        Array.from({ length: 1000 }).map(async () => await e.count({ id: 1 })),
      )

      const duration = new Date().getTime() - start
      // I don't know what could be a good value... I don't even know if it's a good test to have time involved.
      expect(duration).toBeLessThan(10)
    } finally {
      remult.dataProvider = dp
    }
  })
}
