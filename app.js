const { appConfig } = require('./config')
const fastify = require('fastify')({ logger: false })

const PORT = appConfig[process.env.NODE_ENV].PORT

// mongodb atlas connect tutorial https://zhuanlan.zhihu.com/p/347990778
fastify.register(require('fastify-cors'), {
	origin: (origin, cb) => {
		if (origin === 'frank-handsome') {
			//  Request from localhost will pass
			cb(null, true)
			return
		}
		// Generate an error on other origins, disabling access
		cb(new Error('Not allowed'))
	},
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
