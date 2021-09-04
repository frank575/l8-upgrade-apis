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

const createBaseSchemaResponse = (
	statusCode,
	message,
	dataSchema = {
		nullable: true,
		default: null,
	},
) => ({
	[statusCode]: {
		type: 'object',
		properties: {
			success: {
				type: 'boolean',
				default: statusCode === 200,
			},
			message: {
				type: 'string',
				default: message,
			},
			data: dataSchema,
		},
	},
})

const createBaseResponse = (message, data = null) => {
	return {
		message,
		data,
	}
}

const start = async () => {
	try {
		fastify.register(require('fastify-cors'), {})
		fastify.register(require('fastify-swagger'), {
			routePrefix: '/doc/api',
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
				schemes: 'https',
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
								response: createBaseSchemaResponse(200, '取得使用者列表成功', {
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
								}),
							},
							async handler(req, reply) {
								return createBaseResponse(
									'取得使用者列表成功',
									await UserModel.find(),
								)
							},
						})

						fastify.route({
							method: 'POST',
							url: '/',
							schema: {
								tags: ['users'],
								summary: '新增使用者',
								body: {
									type: 'object',
									required: ['username', 'password'],
									properties: {
										username: {
											type: 'string',
											pattern: '^\\w+@[a-zA-Z_]+?\\.[a-zA-Z]{2,3}$',
										},
										password: {
											type: 'string',
											pattern: '^[A-z]\\d{2,6}[A-z]$',
										},
										name: {
											type: 'string',
											nullable: true,
										},
									},
								},
							},
							async handler(req) {
								return new UserModel(req.body).save()
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

		fastify.addHook('onSend', async (req, reply, payload) => {
			return typeof payload === 'string'
				? payload.replace(/"statusCode":[^12]\d{2}/, '"success":false')
				: payload
		})

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
