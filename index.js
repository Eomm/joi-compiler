'use strict'

const Joi = require('joi')
const warning = require('process-warning')()

const { kContextBucket } = require('./src/symbols')
const contextBucket = require('./src/bucket')

warning.create('JoiCompiler', 'FSTJOI001', 'You cannot use external schemas via "fastify.addSchema" with Joi')

function ValidatorSelector (opts = {}) {
  const { prefs = {} } = opts

  Joi.checkPreferences(prefs)

  function buildValidator (externalSchemas, options) {
    // ? options is equal to fastify({ ajv }) options

    if (!externalSchemas[kContextBucket] && Object.keys(externalSchemas).length > 0) {
      warning.emit('FSTJOI001')
    }

    return function validatorCompiler ({ schema /*, method, url, httpPart */ }) {
      // const schema = Joi.compile(definition)
      return function executeValidation (data) {
        prefs.context = externalSchemas

        return schema.validate(data, prefs)
      }
    }
  }

  return {
    bucket: contextBucket,
    buildValidator,
    joi: Joi
  }
}

module.exports = ValidatorSelector
