const dotenv = require('dotenv')
dotenv.config()
dotenv.config({ path: `.env.${process.env.NODE_ENV}` })

// process.env.MONGODB_URI
const MONGODB_URI = process.env.MONGODB_URI
const PORT = process.env.APP_PORT
const API_BASE_URL = process.env.API_BASE_URL

const fastify = require('fastify')({ logger: false })
const mongoose = require('mongoose')

const slashStr = str => {
	return str ? (/^\//.test(str) ? str : `/${str}`) : ''
}

const loopRegisterRoute = routes => {
	for (const prefixPath in routes) {
		const controllers = routes[prefixPath]
		for (const controllersKey in controllers) {
			const route = controllers[controllersKey]
			fastify.route({
				...route,
				url: `${API_BASE_URL}/${prefixPath}${slashStr(route.url)}`,
			})
		}
	}
}

const start = async () => {
	try {
		fastify.register(require('fastify-cors'), {})

		await mongoose.connect(MONGODB_URI)
		console.log('MongoDB connected...')

		const UserModel = mongoose.model(
			'User',
			new mongoose.Schema({
				name: String,
				username: String,
				password: String,
			}),
		)

		const routes = {
			users: {
				get: {
					method: 'GET',
					url: '',
					handler: async (req, reply) => {
						try {
							return await UserModel.find()
						} catch (error) {
							return error
						}
					},
				},
				add: {
					method: 'POST',
					url: '',
					handler: async (req, reply) => {
						try {
							const user = new UserModel(req.body)
							return user.save()
						} catch (error) {
							return error
						}
					},
				},
			},
		}

		loopRegisterRoute(routes)

		await fastify.listen(PORT)
		fastify.log.info(`server listening on http://localhost:${PORT}/`)
	} catch (err) {
		fastify.log.error(err)
		process.exit(1)
	}
}

console.log(PORT, API_BASE_URL)

start()
