'use strict'

const { test } = require('node:test')

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

test('Basic validation', async t => {
  const factory = JoiCompiler({
    prefs: {
      allowUnknown: true
    }
  })

  t.assert.ok(factory.joi, 'joi is defined')

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
    t.assert.strictEqual(res.statusCode, 400)
    t.assert.deepStrictEqual(res.json(), {
      statusCode: 400,
      code: 'FST_ERR_VALIDATION',
      error: 'Bad Request',
      message: '"foo" is required'
    })
  }

  {
    const res = await app.inject({ url: '/', headers: { foo: 'bar' } })
    t.assert.strictEqual(res.statusCode, 200)
    t.assert.strictEqual(res.json().headers.foo, 'bar')
  }
})

test('Bad options', async t => {
  try {
    JoiCompiler({ prefs: { asd: 22 } })
    t.fail('Should throw')
  } catch (error) {
    t.assert.deepStrictEqual(error.message, '"asd" is not allowed')
  }
})

test('Should emit a WARNING when using addSchema', (t, done) => {
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
    t.assert.strictEqual(warn.code, 'FSTJOI001')
    done()
  }
  t.after(() => process.removeListener('warning', onWarning))

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

test('Custom extensions', async (t) => {
  const factory = JoiCompiler({
    extensions: [
      joiDate,
      {
        type: 'foo',
        base: Joi.string().required(),
        coerce (value, helpers) {
          t.assert.ok('Coerce called')
          if (value === 'foo') {
            return { value: 'bar' }
          }
          return { value }
        },
        validate (value, helpers) {
          t.assert.ok('validate called')
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
    t.assert.strictEqual(res.statusCode, 400)
    t.assert.deepStrictEqual(res.json(), {
      statusCode: 400,
      code: 'FST_ERR_VALIDATION',
      error: 'Bad Request',
      message: '"x-date" is required'
    })
  }

  {
    const res = await app.inject({ url: '/', headers: { 'x-date': '11-01-1989', 'x-name': 'foo' } })
    t.assert.strictEqual(res.statusCode, 200)
    t.assert.match(res.json().headers['x-date'], /^1989-01/)
    t.assert.match(res.json().headers['x-name'], /bar/, 'should be coerced')
  }

  {
    const res = await app.inject({ url: '/', headers: { 'x-date': '1989/01/11', 'x-name': 'asd' } })
    t.assert.strictEqual(res.statusCode, 200)
    t.assert.match(res.json().headers['x-date'], /^1989-01/)
    t.assert.match(res.json().headers['x-name'], /asd/, 'should not coerce')
  }
})

test('Supports async validation', async t => {
  // t.plan(9)

  const factory = JoiCompiler({
    asyncValidation: true
  })

  const app = fastify({
    exposeHeadRoutes: false,
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
        'user-agent': Joi.string().external(async (val) => {
          t.assert.ok('external called')
          if (val !== 'lightMyRequest') {
            throw new Error('Invalid user-agent')
          }

          t.assert.strictEqual(val, 'lightMyRequest', 'LMR header is valid')
          return val
        }),
        hostx: Joi.string().required()
      })
    }
  })

  {
    const res = await app.inject({
      url: '/',
      headers: {
        'user-agent': 'lightMyRequest',
        hostx: 'localhost:80'
      }
    })
    t.assert.strictEqual(res.statusCode, 200)
    t.assert.deepStrictEqual(res.json().headers, {
      'user-agent': 'lightMyRequest',
      hostx: 'localhost:80',
      host: 'localhost:80'
    })
  }

  {
    const res = await app.inject({
      url: '/',
      headers: {
        'user-agent': 'invalid',
        hostx: 'localhost:80'
      }
    })
    t.assert.strictEqual(res.statusCode, 400)
    t.assert.deepStrictEqual(res.json(), {
      statusCode: 400,
      code: 'FST_ERR_VALIDATION',
      error: 'Bad Request',
      message: 'Invalid user-agent (user-agent)'
    })
  }

  {
    const res = await app.inject({
      url: '/',
      headers: {
        'user-agent': 'lightMyRequest'
      }
    })
    t.assert.strictEqual(res.statusCode, 400)
    t.assert.deepStrictEqual(res.json(), {
      statusCode: 400,
      code: 'FST_ERR_VALIDATION',
      error: 'Bad Request',
      message: '"hostx" is required'
    })
  }
})
