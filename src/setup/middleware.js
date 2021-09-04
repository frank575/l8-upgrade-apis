const setupRouter = require('@/setup/router')

const setupMiddleware = fastify => {
	fastify.register(require('fastify-cors'), {})
	setupRouter(fastify)
}

module.exports = setupMiddleware
