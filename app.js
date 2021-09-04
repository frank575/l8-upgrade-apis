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

const start = async () => {
	try {
		fastify.register(require('fastify-cors'), {})
		fastify.register(require('fastify-swagger'), {
			routePrefix: '/documentation',
			exposeRoute: true,
			swagger: {
				info: {
					title: '您好，接口',
					description: 'by frank575',
					version: '0.0.0',
				},
				externalDocs: {
					url: 'https://hackmd.io/rSdxPsX9QieDwqZGixJ5GA?view',
					description: '查閱題目此點此連結',
				},
				host: 'localhost:9281',
				schemes: ['http'],
				consumes: ['application/json'],
				produces: ['application/json'],
				tags: [{ name: 'users', description: '使用者' }],
			},
		})

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

		fastify.register(
			(fastify, opt, done) => {
				fastify.register(
					(fastify, opt, done) => {
						fastify.route({
							method: 'GET',
							url: '/',
							schema: {
								tags: ['users'],
								summary: '取得使用者列表',
								response: {
									200: {
										type: 'array',
										items: {
											type: 'object',
											properties: {
												name: {
													type: 'string',
													nullable: true,
													default: null,
												},
												username: { type: 'string' },
											},
										},
									},
								},
							},
							async handler() {
								try {
									return await UserModel.find()
								} catch (error) {
									return error
								}
							},
						})

						fastify.route({
							method: 'POST',
							url: '/',
							schema: {
								tags: ['users'],
								summary: '新增使用者',
							},
							async handler(req) {
								try {
									const user = new UserModel(req.body)
									return user.save()
								} catch (error) {
									return error
								}
							},
						})
						done()
					},
					{ prefix: '/users' },
				)
				done()
			},
			{ prefix: API_BASE_URL || '' },
		)

		await fastify.listen(PORT)
		fastify.swagger()

		console.log(`server listening on http://localhost:${PORT}/`)
		fastify.log.info(`server listening on ${PORT}/`)
	} catch (err) {
		fastify.log.error(err)
		process.exit(1)
	}
}

start()
