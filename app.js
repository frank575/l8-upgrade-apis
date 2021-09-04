require('module-alias/register')
const setupMongodb = require('@model/setup-mongodb')

setupMongodb.then(({ models }) => {
	const { appConfig } = require('./config')
	const fastify = require('fastify')({ logger: false })

	const PORT = appConfig[process.env.NODE_ENV].PORT

	fastify.register(require('fastify-cors'), {})

	// Declare a route
	fastify.get('/', async (request, reply) => {
		const felyne = new models.Kitten({
			name: 'Felyne' + Math.floor(Math.random() * 100),
		})

		try {
			await felyne.save()
		} catch (error) {
			return {
				saveError: error,
				success: false,
			}
		}

		return {
			success: true,
		}
	})

	fastify.listen(PORT, function (err, address) {
		if (err) {
			fastify.log.error(err)
			process.exit(1)
		}
		fastify.log.info(`server listening on ${address}`)
	})
})
