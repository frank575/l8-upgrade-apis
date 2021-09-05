const Fastify = require('fastify')
const localize = require('ajv-i18n')
const md5 = require('md5')
const mongoose = require('mongoose')
const { Schema } = mongoose

const dotenv = require('dotenv')
dotenv.config()
dotenv.config({ path: `.env.${process.env.NODE_ENV}` })

const { MONGODB_URI, APP_PORT: PORT, API_BASE_URL, JWT_SECRET } = process.env

const fastify = Fastify({
	logger: false,
})

/**
 * @template T
 * @param {T} obj
 * @return {T & {t(val: *): string, key(val: *): string, keys: string[], map: function(callback?: function(*, string): *): *[], reduce: function(callback: function(*, *, string): *, initialValue: *): *}}
 */
const createEnum = obj => {
	const translation = {}
	const reverseEnum = {}
	const $enum = {}
	const keys = []
	const t = val => translation[val]
	const key = val => reverseEnum[val]
	const map = callback =>
		callback ? keys.map((k, i) => callback($enum[k], k, i)) : keys
	const reduce = (callback, initialValue) => {
		let previous = initialValue
		keys.map((k, i) => {
			previous = callback(previous, $enum[k], k, i)
		})
		return previous
	}

	function addEnum(key, val) {
		if (Array.isArray(val)) {
			const [v, t] = val
			translation[v] = t
			$enum[key] = v
			reverseEnum[v] = key
		} else {
			$enum[key] = val
			reverseEnum[val] = key
		}
		keys.push(key)
	}

	for (const k in obj) {
		addEnum(k, obj[k])
	}

	return { ...$enum, t, key, keys, map, reduce }
}

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

const createBaseResponse = (statusCode, message, data = null) => {
	return {
		success: statusCode < 400,
		message,
		data,
	}
}

const setupApp = async () => {
	try {
		fastify.register(require('fastify-cors'), {})

		fastify.register(require('fastify-jwt'), {
			secret: JWT_SECRET,
		})

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

		const ERole = createEnum({
			ADMIN: 'ADMIN',
			USER: 'USER',
		})

		fastify.addSchema({
			$id: '#user',
			type: 'object',
			properties: {
				name: { type: 'string', nullable: true, default: null },
				username: { type: 'string' },
				role: {
					type: 'string',
					default: ERole.USER,
				},
			},
		})

		fastify.decorate('authenticate', async function (req) {
			try {
				await req.jwtVerify()
			} catch (error) {
				return new Error(error)
			}
		})

		await mongoose.connect(MONGODB_URI)
		console.log('MongoDB connected...')

		const userSchema = new Schema({
			name: String,
			username: { type: String, required: true, unique: true },
			password: { type: String, required: true },
			role: {
				type: String,
				enum: {
					values: ERole.map(e => e),
					message: '使用者權限未設定',
				},
				default: ERole.USER,
			},
		})

		userSchema.methods.getJwtToken = function () {
			return fastify.jwt.sign(
				{
					username: this.username,
					name: this.name,
				},
				{ expiresIn: /*86400*/ 60 },
			)
		}

		const User = mongoose.model('User', userSchema)

		if (
			(await User.findOne({ username: 'admin' }, 'name username role')) == null
		) {
			await new User({
				name: '位高權上者',
				username: 'admin',
				password: md5('123456'),
				role: ERole.ADMIN,
			}).save()
		}

		fastify.register(
			(fastify, opt, done) => {
				fastify.route({
					method: 'POST',
					url: '/login',
					schema: {
						tags: ['users'],
						summary: '登入',
						body: {
							type: 'object',
							required: ['username', 'password'],
							properties: {
								username: {
									type: 'string',
									default: 'aa@aa.aa',
									description: '帳號',
								},
								password: {
									type: 'string',
									default: 'a00a',
									description: '密碼',
								},
							},
						},
						response: createBaseSchemaResponse(200, '登入成功', {
							type: 'object',
							properties: {
								user: {
									$ref: '#user',
								},
								token: {
									type: 'string',
								},
							},
						}),
					},
					async handler(req) {
						const { username } = req.body
						const user = await User.findOne({ username }, 'name username role')

						if (user == null)
							return new Error('使用者不存在，請確認帳號或密碼是否正確')

						const token = user.getJwtToken()

						return createBaseResponse(200, '登入成功', {
							user,
							token,
						})
					},
				})

				fastify.route({
					method: 'POST',
					url: '/register',
					schema: {
						tags: ['users'],
						summary: '註冊',
						body: {
							type: 'object',
							required: ['username', 'password'],
							properties: {
								username: {
									type: 'string',
									pattern: '^\\w+@[a-zA-Z_]+?\\.[a-zA-Z]{2,3}$',
									default: 'aa@aa.aa',
									description: '帳號',
								},
								password: {
									type: 'string',
									pattern: '^[A-z]\\d{2,6}[A-z]$',
									default: 'a00a',
									description: '密碼',
								},
								name: {
									type: 'string',
									nullable: true,
									default: 'AA君',
									description: '顯示名稱',
								},
							},
						},
						response: createBaseSchemaResponse(200, '註冊成功', {
							type: 'null',
							default: null,
						}),
					},
					async handler(req) {
						const body = req.body
						const user = await User.findOne(
							{ username: body.username },
							'name username role',
						)

						if (user != null) return new Error('使用者已存在')

						await new User({
							...body,
							password: md5(body.password),
						}).save()

						return createBaseResponse(200, '註冊成功')
					},
				})
				// user routes
				fastify.register(
					(fastify, opt, done) => {
						fastify.route({
							method: 'GET',
							url: '/:username',
							preValidation: [fastify.authenticate],
							schema: {
								tags: ['users'],
								summary: '取得使用者',
								response: createBaseSchemaResponse(200, '取得使用者成功', {
									$ref: '#user',
								}),
								params: {
									type: 'object',
									properties: {
										username: { type: 'string', default: 'aa@aa.aa' },
									},
								},
							},
							async handler(req) {
								console.log(req.user)
								const { username } = req.params
								const user = await User.findOne(
									{ username },
									'name username role',
								)

								if (user == null) return new Error('使用者不存在')

								return createBaseResponse(200, '取得使用者成功', user)
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

		// fastify.addHook('onSend', async (req, reply, payload) => {
		// 	return typeof payload === 'string'
		// 		? payload.replace(/"statusCode":[^12]\d{2}/, '"success":false')
		// 		: payload
		// })

		fastify.setErrorHandler((error, request, reply) => {
			let message = error.message
			if (error.validation) {
				localize['zh-TW'](error.validation)
				message = error.validation[0].message
			}
			request.log.error({ err: error })
			reply.send({
				success: false,
				message,
				data: null,
			})
		})

		await fastify.listen(PORT)
		fastify.swagger()

		console.log(`server listening on http://localhost:${PORT}/`)
		fastify.log.info(`server listening on ${PORT}/`)
	} catch (error) {
		console.log(error)
		fastify.log.error(error)
		process.exit(1)
	}
}

setupApp()
