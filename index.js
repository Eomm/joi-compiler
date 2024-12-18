'use strict'

const Joi = require('joi')
const { createWarning } = require('process-warning')

const { kContextBucket } = require('./src/symbols')
const contextBucket = require('./src/bucket')

const warning = createWarning({
  name: 'JoiCompiler',
  code: 'FSTJOI001',
  message: 'You cannot use external schemas via "fastify.addSchema" with Joi',
  unlimited: false
})

const defaultJoiPrefs = Object.freeze({
  stripUnknown: true
})

function ValidatorSelector (opts = {}) {
  const {
    prefs = defaultJoiPrefs,
    asyncValidation = false,
    extensions
  } = opts

  if (prefs !== defaultJoiPrefs) {
    Joi.checkPreferences(prefs)
  }

  const joiCustom = extensions ? Joi.extend(...extensions) : Joi

  function buildValidator (externalSchemas, options) {
    // ? options is equal to fastify({ ajv }) options

    if (!externalSchemas[kContextBucket] && Object.keys(externalSchemas).length > 0) {
      warning()
    }

    return function validatorCompiler ({ schema /*, method, url, httpPart */ }) {
      return function executeValidation (data) {
        if (asyncValidation === false) {
          return schema.validate(data, {
            ...prefs,
            context: externalSchemas
          })
        } else {
          return schema.validateAsync(data, {
            ...prefs,
            context: externalSchemas
          })
        }
      }
    }
  }

  return {
    bucket: contextBucket,
    buildValidator,
    joi: joiCustom
  }
}

module.exports = ValidatorSelector
