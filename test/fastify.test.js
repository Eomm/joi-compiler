'use strict'

const { test } = require('node:test')

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

test('Should manage the context via bucket context', async t => {
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
    t.assert.fail('Should not emit warning')
  }
  t.after(() => process.removeListener('warning', onWarning))

  app.addSchema({ $id: 'x', $value: 42 })
  const schema = app.getSchema('x')
  t.assert.strictEqual(schema, 42)

  try {
    app.addSchema({ $id: 'x', $value: 1 })
    t.assert.fail('Should throw')
  } catch (error) {
    t.assert.strictEqual(error.message, 'Schema with id "x" already declared')
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
    t.assert.strictEqual(res.statusCode, 200)
  }

  {
    const res = await app.inject({
      url: '/',
      method: 'POST',
      body: { a: 5, b: { c: 5 }, c: 999 }
    })
    t.assert.strictEqual(res.statusCode, 400)
    t.assert.deepStrictEqual(res.json(), {
      statusCode: 400,
      code: 'FST_ERR_VALIDATION',
      error: 'Bad Request',
      message: '"c" must be [ref:global:x]'
    })
  }
})

test('Encasulation context', async t => {
  const factory = JoiCompiler()

  const app = fastify({
    schemaController: {
      bucket: factory.bucket,
      compilersFactory: {
        buildValidator: factory.buildValidator
      }
    }
  })

  app.addSchema({ $id: 'x', $value: 42 })

  app.register(async function plugin (instance, opts) {
    instance.addSchema({ $id: 'y', $value: 50 })
    instance.post('/invalid-y', {
      handler: echo,
      schema: {
        body: Joi.object({
          toX: Joi.ref('$x'),
          toY: Joi.ref('$y'),
          toZ: Joi.ref('$z')
        })
      }
    })
    instance.post('/valid-y', {
      handler: echo,
      schema: {
        body: Joi.object({
          toX: Joi.ref('$x'),
          toY: Joi.ref('$y')
        })
      }
    })
  })

  app.register(async function plugin (instance, opts) {
    instance.addSchema({ $id: 'z', $value: 60 })
    instance.post('/invalid-z', {
      handler: echo,
      schema: {
        body: Joi.object({
          toX: Joi.ref('$x'),
          toY: Joi.ref('$y'),
          toZ: Joi.ref('$z')
        })
      }
    })
    instance.post('/valid-z', {
      handler: echo,
      schema: {
        body: Joi.object({
          toX: Joi.ref('$x'),
          toZ: Joi.ref('$z')
        })
      }
    })
  })

  {
    const res = await app.inject({
      url: '/invalid-y',
      method: 'POST',
      body: { toX: 42, toY: 50, toZ: 60 }
    })
    t.assert.strictEqual(res.statusCode, 400)
    t.assert.strictEqual(res.json().message, '"toZ" must be [ref:global:z]')
  }
  {
    const res = await app.inject({
      url: '/valid-y',
      method: 'POST',
      body: { toX: 42, toY: 50 }
    })
    t.assert.strictEqual(res.statusCode, 200, 'valid-y')
  }

  {
    const res = await app.inject({
      url: '/invalid-z',
      method: 'POST',
      body: { toX: 42, toY: 50, toZ: 60 }
    })
    t.assert.strictEqual(res.statusCode, 400)
    t.assert.strictEqual(res.json().message, '"toY" must be [ref:global:y]')
  }
  {
    const res = await app.inject({
      url: '/valid-z',
      method: 'POST',
      body: { toX: 42, toZ: 60 }
    })
    t.assert.strictEqual(res.statusCode, 200)
  }
})

test('Works with AJV', async t => {
  const joiCompilerInstance = JoiCompiler()

  const app = fastify()

  app.post('/ajv', {
    handler: (request) => request.body,
    schema: {
      body: {
        type: 'object',
        properties: {
          toX: { const: 42 },
          toY: { const: 50 }
        }
      }
    }
  })

  app.register(async function pluginJoi (app, opts) {
    app.setSchemaController({
      bucket: joiCompilerInstance.bucket,
      compilersFactory: {
        buildValidator: joiCompilerInstance.buildValidator
      }
    })

    app.addSchema({ $id: 'x', $value: 42 })
    app.addSchema({ $id: 'y', $value: 50 })

    app.post('/joi', {
      handler: (request) => request.body,
      schema: {
        body: Joi.object({
          toX: Joi.ref('$x'),
          toY: Joi.ref('$y')
        })
      }
    })
  })

  {
    const res = await app.inject({
      url: '/joi',
      method: 'POST',
      body: { toX: 42, toY: 51 }
    })
    t.assert.strictEqual(res.statusCode, 400)
    t.assert.strictEqual(res.json().message, '"toY" must be [ref:global:y]')
  }
  {
    const res = await app.inject({
      url: '/joi',
      method: 'POST',
      body: { toX: 42, toY: 50 }
    })
    t.assert.strictEqual(res.statusCode, 200, 'valid-y')
  }

  {
    const res = await app.inject({
      url: '/ajv',
      method: 'POST',
      body: { toX: 42, toY: 51 }
    })
    t.assert.strictEqual(res.statusCode, 400)
    t.assert.strictEqual(res.json().message, 'body/toY must be equal to constant')
  }
  {
    const res = await app.inject({
      url: '/ajv',
      method: 'POST',
      body: { toX: 42, toY: 50 }
    })
    t.assert.strictEqual(res.statusCode, 200)
  }
})
