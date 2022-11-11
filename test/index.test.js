'use strict'

const tap = require('tap')

const Joi = require('joi')
const joiDate = require('@joi/date')
const fastify = require('fastify')

const JoiCompiler = require('../index')

function echo (request, reply) {
  reply.send({
    body: request.body,
    headers: request.headers,
    query: request.query,
    params: request.params
  })
}

tap.test('Basic validation', async t => {
  const factory = JoiCompiler({
    prefs: {
      allowUnknown: true
    }
  })

  t.ok(factory.joi, 'joi is defined')

  const app = fastify({
    schemaController: {
      compilersFactory: {
        buildValidator: factory.buildValidator
      }
    }
  })

  app.get('/', {
    handler: echo,
    schema: {
      headers: Joi.object({
        foo: Joi.string().required()
      })
    }
  })

  {
    const res = await app.inject('/')
    t.equal(res.statusCode, 400)
    t.same(res.json(), {
      statusCode: 400,
      error: 'Bad Request',
      message: '"foo" is required'
    })
  }

  {
    const res = await app.inject({ url: '/', headers: { foo: 'bar' } })
    t.equal(res.statusCode, 200)
    t.equal(res.json().headers.foo, 'bar')
  }
})

tap.test('Bad options', async t => {
  try {
    JoiCompiler({ prefs: { asd: 22 } })
    t.fail('Should throw')
  } catch (error) {
    t.same(error.message, '"asd" is not allowed')
  }
})

tap.test('Should emit a WARNING when using addSchema', t => {
  t.plan(1)
  const factory = JoiCompiler()

  const app = fastify({
    schemaController: {
      compilersFactory: {
        buildValidator: factory.buildValidator
      }
    }
  })

  process.removeAllListeners('warning')
  process.on('warning', onWarning)
  function onWarning (warn) {
    t.equal(warn.code, 'FSTJOI001')
  }
  t.teardown(() => process.removeListener('warning', onWarning))

  app.addSchema({ $id: 'test', type: 'object', properties: {} })
  app.get('/', {
    handler: echo,
    schema: {
      headers: Joi.object({
        foo: Joi.string().required()
      })
    }
  })

  app.ready()
})

tap.test('Should manage the context via bucket context', async t => {
  const factory = JoiCompiler()

  const app = fastify({
    schemaController: {
      bucket: factory.bucket,
      compilersFactory: {
        buildValidator: factory.buildValidator
      }
    }
  })

  process.removeAllListeners('warning')
  process.on('warning', onWarning)
  function onWarning (warn) {
    t.fail('Should not emit warning')
  }
  t.teardown(() => process.removeListener('warning', onWarning))

  app.addSchema({ $id: 'x', value: 42 })
  const schema = app.getSchema('x')
  t.equal(schema, 42)

  try {
    app.addSchema({ $id: 'x', value: 1 })
    t.fail('Should throw')
  } catch (error) {
    t.equal(error.message, 'Schema with id "x" already declared')
  }

  app.post('/', {
    handler: echo,
    schema: {
      body: Joi.object({
        a: Joi.ref('b.c'),
        b: { c: Joi.any() },
        c: Joi.ref('$x')
      })
    }
  })

  {
    const res = await app.inject({
      url: '/',
      method: 'POST',
      body: { a: 5, b: { c: 5 }, c: 42 }
    })
    t.equal(res.statusCode, 200)
  }

  {
    const res = await app.inject({
      url: '/',
      method: 'POST',
      body: { a: 5, b: { c: 5 }, c: 999 }
    })
    t.equal(res.statusCode, 400)
    t.same(res.json(), {
      statusCode: 400,
      error: 'Bad Request',
      message: '"c" must be [ref:global:x]'
    })
  }
})

tap.test('Custom extensions', async t => {
  const factory = JoiCompiler({
    extensions: [
      joiDate,
      {
        type: 'foo',
        base: Joi.string().required(),
        coerce (value, helpers) {
          t.pass('Coerce called')
          if (value === 'foo') {
            return { value: 'bar' }
          }
          return { value }
        },
        validate (value, helpers) {
          t.pass('validate called')
        }
      }
    ],
    prefs: {
      allowUnknown: true
    }
  })

  const joi = factory.joi

  const app = fastify({
    schemaController: {
      compilersFactory: {
        buildValidator: factory.buildValidator
      }
    }
  })

  app.get('/', {
    handler: echo,
    schema: {
      headers: joi.object({
        'x-date': joi.date().format(['YYYY/MM/DD', 'DD-MM-YYYY']).required(),
        'x-name': joi.foo()
      })
    }
  })

  {
    const res = await app.inject('/')
    t.equal(res.statusCode, 400)
    t.same(res.json(), {
      statusCode: 400,
      error: 'Bad Request',
      message: '"x-date" is required'
    })
  }

  {
    const res = await app.inject({ url: '/', headers: { 'x-date': '11-01-1989', 'x-name': 'foo' } })
    t.equal(res.statusCode, 200)
    t.match(res.json().headers['x-date'], '1989-01-10T')
    t.match(res.json().headers['x-name'], 'bar', 'should be coerced')
  }

  {
    const res = await app.inject({ url: '/', headers: { 'x-date': '1989/01/11', 'x-name': 'asd' } })
    t.equal(res.statusCode, 200)
    t.match(res.json().headers['x-date'], '1989-01-10T')
    t.match(res.json().headers['x-name'], 'asd', 'should not coerce')
  }
})
