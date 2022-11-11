'use strict'

function ValidatorSelector (opts) {
  return function buildCompilerFromPool (externalSchemas, options) {
    return function buildValidatorFunction ({ schema/*, method, url, httpPart */ }) {
      // const schema = Joi.compile(definition);
      return (data) => {
        // validateAsync ?
        const validationResult = schema.validate(data)
        // const { error, value } = validationResult

        return validationResult
      }
    }
  }
}

module.exports = ValidatorSelector
