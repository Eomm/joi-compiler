# joi-compiler

[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat)](http://standardjs.com/)
[![Continuous Integration](https://github.com/Eomm/joi-compiler/workflows/Continuous%20Integration/badge.svg)](https://github.com/Eomm/joi-compiler/actions/workflows/ci.yml)

Build and manage the [`joi`](https://joi.dev/) instances for the Fastify framework.

It isolates the `joi` dependency so its version is not tightly coupled to the Fastify version.
This allows the user to decide which version of `joi` to use in their Fastify based application.


## Versions

| `joi-compiler` | `joi` | `fastify` |
|---------------:|------:|----------:|
|           v1.x | v17.x |     ^4.18 |


### JOI Configuration

The `joi`'s default configuration is:

```js
{
  stripUnknown: true
}
```

To know all the possible options, please refer to the [`joi.validate()` documentation](https://joi.dev/api/?v=17.7.0#anyvalidatevalue-options).


## Usage

This module is a Fastify schema compiler, it is used by Fastify to build the schema validator.  
You can configure it by setting the [Schema Controller](https://www.fastify.io/docs/latest/Reference/Server/#schemacontroller), but let's see how to use it directly:

```js
const fastify = require('fastify')
const JoiCompiler = require('joi-compiler')

// Instantiate the compiler
const factory = JoiCompiler()

// Install it to Fastify
const app = fastify({
  schemaController: {
    compilersFactory: {
      buildValidator: factory.buildValidator
    }
  }
})

// Use it!
app.get('/', {
  handler: echo,
  schema: {
    headers: factory.joi.object({
      foo: factory.joi.string().required()
    })
  }
})
```

### Options

The `JoiCompiler` accepts an optional configuration object:

```js
const factory = JoiCompiler({
  // optionally: provide all the JOI options you need
  prefs: {
    allowUnknown: true
  },

// optionally: an array with custom JOI extensions
  extensions: [
    require('@joi/date')
  ],

  // optionally: if you want to use the async validation. Default: false
  // Note that this option is supported ONLY by Fastify since v4.18.0
  asyncValidation: true
})
```

When you instantiate the compiler, the returned object has the following properties:

- `buildValidator`: the function to pass to the `schemaController` option of Fastify
- `bucket`: the object to support `fastify.addSchema()`
- `joi`: a customized `joi` instance that contains the installed `extensions`.

> **Warning**
> The async `joi` extensions are supported by Fastify since [`v4.18.0`](https://github.com/fastify/fastify/pull/4752).


### How to use `ref`

The `joi` module supports the [`ref`](https://joi.dev/api/?v=17.7.0#refkey-options) feature to link the `context` configuration.

You can configure the `context` option by using the [`fastify.addSchema()`](https://www.fastify.io/docs/latest/Reference/Server/#addschema) method.  
Note that, as the Fastify default compiler, this feature is fully encapsulated!

In this case you will need to use a special schema object:

```js
app.addSchema({
  $id: 'x', // the ID you want to use
  $value: 42 // the value you want to store in the context
})
```

Here is an example:

```js
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
```


## License

Licensed under [MIT](./LICENSE).
