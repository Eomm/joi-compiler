'use strict'

const Joi = require('joi')
const warning = require('process-warning')()

warning.create('JoiCompiler', 'FSTJOI001', 'You cannot use external schemas via "fastify.addSchema" with Joi')

function ValidatorSelector (opts = {}) {
  const { prefs } = opts

  if (prefs) {
    Joi.checkPreferences(prefs)
  }

  return function buildCompiler (externalSchemas, options) {
    // ? options is equal to fastify({ ajv }) options

    if (Object.keys(externalSchemas).length > 0) {
      warning.emit('FSTJOI001')
    }

    return buildValidatorFunction.bind(null, prefs)
  }
}

function buildValidatorFunction (prefs, { schema /*, method, url, httpPart */ }) {
  // const schema = Joi.compile(definition)
  return function executeValidation (data) {
    return schema.validate(data, prefs)
  }
}

module.exports = ValidatorSelector
