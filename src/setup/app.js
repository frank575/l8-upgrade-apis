const { appConfig } = require('@root/config')
const setupMongodb = require('@/setup/mongodb')

const setupApp = async () => {
	try {
		await setupMongodb()

		const fastify = require('fastify')({ logger: false })
		const PORT = appConfig[process.env.NODE_ENV].PORT

		fastify.register(require('fastify-cors'), {})

		try {
			await fastify.listen(PORT)
			fastify.log.info(`server listening on http://localhost:${PORT}/`)
		} catch (err) {
			fastify.log.error(err)
			process.exit(1)
		}
	} catch {}
}

module.exports = setupApp
