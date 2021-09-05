const express = require('express')
const expressJwt = require('express-jwt')
const jwt = require('jsonwebtoken')
const cors = require('cors')
const bodyParser = require('body-parser')
const dotenv = require('dotenv')
const md5 = require('md5')
const mongoose = require('mongoose')
const { ERole } = require('./enums')

dotenv.config()
dotenv.config({ path: `.env.${process.env.NODE_ENV}` })

const { MONGODB_URI, APP_PORT, API_BASE_URL, JWT_SECRET } = process.env

;(async () => {
	await mongoose.connect(MONGODB_URI)
	console.log('MongoDB connected...')

	const userSchema = new mongoose.Schema({
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
		return jwt.sign(
			{
				username: this.username,
				name: this.name,
			},
			JWT_SECRET,
			{ expiresIn: /*86400*/ 60, algorithm: 'HS256' },
		)
	}

	const User = mongoose.model('User', userSchema)

	const checkUserExistsCreate = async (data = {}) => {
		try {
			if ((await User.findOne({ username: data.username })) == null) {
				await new User(data).save()
			}
		} catch (err) {
			console.log(err)
		}
	}

	checkUserExistsCreate({
		name: '位高權上者',
		username: 'admin',
		password: md5('123456'),
		role: ERole.ADMIN,
	})

	checkUserExistsCreate({
		name: 'AA君',
		username: 'aa@aa.aa',
		password: md5('a00a'),
		role: ERole.USER,
	})

	const app = express()

	app.use(cors())
	app.use(bodyParser())
	app.use(
		expressJwt({
			secret: JWT_SECRET,
			algorithms: ['HS256'],
		}).unless({
			path: ['/api/login', '/api/register'],
		}),
	)

	app.get('/', async (req, res) => {
		res.send('您好，接口！')
	})

	app.post('/api/login', async (req, res, next) => {
		try {
			const { username } = req.body
			const user = await User.findOne({ username }, 'name username role')

			if (user == null)
				throw new Error('使用者不存在，請確認帳號或密碼是否正確')

			const token = user.getJwtToken()

			res.send({
				success: true,
				message: '登入成功',
				data: {
					token,
				},
			})
		} catch (err) {
			next(err)
		}
	})

	app.post('/api/register', async (req, res, next) => {
		try {
			const body = req.body
			const { username, password } = body

			if (username == null || password == null)
				throw new Error('帳號或密碼不得為空')

			if (!/^\w+@[a-zA-Z_]+?\.[a-zA-Z]{2,3}$/.test(username))
				throw new Error('帳號格式錯誤')

			if (!/^[A-z]\d{2,6}[A-z]$/.test(password)) throw new Error('密碼格式錯誤')

			const user = await User.findOne({ username }, 'name username role')

			if (user != null) throw new Error('使用者已存在')

			await new User({
				...body,
				password: md5(body.password),
			}).save()

			return {
				success: true,
				message: '註冊成功',
				data: null,
			}
		} catch (err) {
			next(err)
		}
	})

	// token 驗證
	app.use(async (req, res, next) => {
		console.log('Accessing the secret section ...')
		next() // pass control to the next handler
	})

	app.get('/api/users/:username', async (req, res, next) => {
		try {
			const { username } = req.params
			const user = await User.findOne({ username }, 'name username role')

			if (user == null) throw new Error('使用者不存在')

			res.send({
				success: true,
				message: '取得使用者成功',
				data: user,
			})
		} catch (err) {
			next(err)
		}
	})

	app.use(async (err, req, res, next) => {
		console.error(err)
		if (err.name === 'UnauthorizedError') {
			res.status(401)
		} else {
			res.status(500)
		}
		res.send({
			success: false,
			message: err.message,
			data: null,
		})
	})

	await app.listen(APP_PORT)
	console.log(`Server listening at http://localhost:${APP_PORT}`)
})()
