const fastify = require('fastify')()
const { appConfig } = require('./config')

const PORT = appConfig[process.env.NODE_ENV].PORT

fastify.register(require('fastify-cors'), {
	origin: ['*'],
	methods: ['GET', 'POST', 'PUT', 'DELETE'],
	allowedHeaders: ['Frank-Handsome'],
})

// Declare a route
fastify.get('/', async (request, reply) => {
	return { hello: 'world' }
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
