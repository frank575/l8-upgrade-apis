const { appConfig } = require('./config')
require('./src/database/init-mongodb')
const fastify = require('fastify')({ logger: false })

const PORT = appConfig[process.env.NODE_ENV].PORT

fastify.register(require('fastify-cors'), {})

// Declare a route
fastify.get('/', async (request, reply) => {
	return {
		DB_USERNAME: process.env.DB_USERNAME,
		DB_PASSWORD: process.env.DB_PASSWORD,
	}
})

// Run the server!
const start = async () => {
	try {
		await fastify.listen(PORT)
		console.log(`Server is running in http://localhost:${PORT}`)
	} catch (err) {
		fastify.log.error(err)
		process.exit(1)
	}
}

start()
