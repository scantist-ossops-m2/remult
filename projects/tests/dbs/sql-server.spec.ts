import { describe, it, expect } from 'vitest'
import * as Knex from 'knex'
import { knexTests } from './shared-tests/test-knex'
import { createEntity as createEntityClass } from '../tests/dynamic-classes'
import { Entity, Fields, type DataProvider } from '../../core'
import type {
  CanBuildMigrations,
  MigrationBuilder,
} from '../../core/migrations/migration-types.js'
import { cast } from '../../core/src/isOfType.js'
import { testMigrationScript } from '../tests/testHelper.js'

describe.skipIf(!process.env['TESTS_SQL_SERVER'])('Knex Sql Server', () => {
  knexTests(
    Knex.default({
      client: 'mssql',
      connection: {
        server: '127.0.0.1',
        database: 'test2',
        user: 'sa',
        password: 'MASTERKEY',
        options: {
          enableArithAbort: true,
          encrypt: false,
          instanceName: 'sqlexpress',
        },
      }, //,debug: true
    }),
    ({ createEntity, getDb, getRemult }) => {
      it('test knex storage', async () => {
        @Entity('my')
        class MyEntity {
          @Fields.string()
          name = ''
          @Fields.json()
          json = []
          @Fields.object()
          object = []
        }
        const e = getRemult().repo(MyEntity).metadata

        expect(
          await testMigrationScript(getDb(), (m) =>
            m.addColumn(e, e.fields.object),
          ),
        ).toMatchInlineSnapshot(
          '"ALTER TABLE [my] ADD [object] nvarchar(max) not null CONSTRAINT [my_object_default] DEFAULT \'\'"',
        )
        expect(
          await testMigrationScript(getDb(), (m) =>
            m.addColumn(e, e.fields.name),
          ),
        ).toMatchInlineSnapshot(
          '"ALTER TABLE [my] ADD [name] nvarchar(255) not null CONSTRAINT [my_name_default] DEFAULT \'\'"',
        )
      })
      it('test long number', async () => {
        const r = await createEntity(
          createEntityClass('test', {
            id: Fields.integer(),
            val: Fields.number({
              valueConverter: {
                fieldTypeInDb: 'decimal(18,2)',
              },
            }),
          }),
        )
        await r.insert({ id: 1, val: 123456789 })
        expect(await r.find()).toMatchInlineSnapshot(`
          [
            test {
              "id": 1,
              "val": 123456789,
            },
          ]
        `)
      })
    },
  )
})
