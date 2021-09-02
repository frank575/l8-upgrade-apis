const fastify = require('fastify')({ logger: true })
const { appConfig } = require('./config')

const PORT = appConfig[process.env.NODE_ENV].PORT

// Declare a route
fastify.get('/api/home', async (request, reply) => {
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
