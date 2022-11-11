'use strict'

const tap = require('tap')

const Joi = require('joi')
const fastify = require('fastify')
const JoiCompiler = require('../index')

tap.test('Fastify integration', async t => {
  const factory = JoiCompiler()

  const app = fastify({
    jsonShorthand: false,
    schemaController: {
      compilersFactory: {
        buildValidator: factory
      }
    }
  })

  app.get('/', {
    schema: {
      headers: Joi.object({
        'user-agent': Joi.string().required(),
        host: Joi.string().required()
      })
    }
  }, (request, reply) => {
    reply.send(request.headers)
  })

  const res = await app.inject('/')

  t.equal(res.statusCode, 200)
  t.same(res.json(), {
    'user-agent': 'lightMyRequest',
    host: 'localhost:80'
  })
})
