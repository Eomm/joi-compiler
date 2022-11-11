'use strict'

const tap = require('tap')

const Joi = require('joi')
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

  const app = fastify({
    schemaController: {
      compilersFactory: {
        buildValidator: factory
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
        buildValidator: factory
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
