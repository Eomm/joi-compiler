'use strict'

const { kContextBucket } = require('./symbols')

function contextBucket (parentSchemas) {
  const context = Object.create(null)
  context[kContextBucket] = true

  Object.assign(context, parentSchemas)

  return {
    add (inputSchema) {
      if (Object.hasOwnProperty.call(context, inputSchema.$id)) {
        throw new Error(`Schema with id "${inputSchema.$id}" already declared`)
      }

      context[inputSchema.$id] = inputSchema.$value
    },
    getSchema (schema$id) { return context[schema$id] },
    getSchemas () { return context }
  }
}

module.exports = contextBucket
