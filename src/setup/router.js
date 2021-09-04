const setupRouter = fastify => {
	fastify.register(require('@routes/user/index'))
}

module.exports = setupRouter
