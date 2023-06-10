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
      code: 'FST_ERR_VALIDATION',
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
      code: 'FST_ERR_VALIDATION',
      error: 'Bad Request',
      message: '"x-date" is required'
    })
  }

  {
    const res = await app.inject({ url: '/', headers: { 'x-date': '11-01-1989', 'x-name': 'foo' } })
    t.equal(res.statusCode, 200)
    t.match(res.json().headers['x-date'], '1989-01-11T')
    t.match(res.json().headers['x-name'], 'bar', 'should be coerced')
  }

  {
    const res = await app.inject({ url: '/', headers: { 'x-date': '1989/01/11', 'x-name': 'asd' } })
    t.equal(res.statusCode, 200)
    t.match(res.json().headers['x-date'], '1989-01-11T')
    t.match(res.json().headers['x-name'], 'asd', 'should not coerce')
  }
})

tap.test('Supports async validation', async t => {
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
          t.pass('external called')
          if (val !== 'lightMyRequest') {
            throw new Error('Invalid user-agent')
          }

          t.equal(val, 'lightMyRequest', 'LMR header is valid')
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
    t.equal(res.statusCode, 200)
    t.same(res.json().headers, {
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
    t.equal(res.statusCode, 400)
    t.same(res.json(), {
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
    t.equal(res.statusCode, 400)
    t.same(res.json(), {
      statusCode: 400,
      code: 'FST_ERR_VALIDATION',
      error: 'Bad Request',
      message: '"hostx" is required'
    })
  }
})
