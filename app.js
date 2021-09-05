const express = require('express')
const expressJwt = require('express-jwt')
const jwt = require('jsonwebtoken')
const cors = require('cors')
const bodyParser = require('body-parser')
const multer = require('multer')
const dotenv = require('dotenv')
const md5 = require('md5')
const mongoose = require('mongoose')
const imgur = require('imgur')
const { ERole } = require('./enums')

dotenv.config()
dotenv.config({ path: `.env.${process.env.NODE_ENV}` })

const {
	MONGODB_URI,
	APP_PORT,
	JWT_SECRET,
	IMGUR_CLIENT_ID,
	IMGUR_CLIENT_SECRET,
	IMGUR_AUTH_ACCESS_TOKEN,
} = process.env

imgur.setClientId(IMGUR_CLIENT_ID)

const uploadPicture = multer({
	limit: {
		fileSize: 1000000, // 10MB
	},
	fileFilter(req, file, cb) {
		const fileType = file.mimetype
		if (/^image\/[A-z]+$/.test(fileType)) {
			return cb(null, true)
		}
		cb(new Error('僅接受 gif, png, jpg, jpeg 格式'))
	},
})

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
				_id: this._id,
				username: this.username,
			},
			JWT_SECRET,
			{ expiresIn: 86400, algorithm: 'HS256' },
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

	const fileSchema = new mongoose.Schema({
		id: { type: String, required: true, unique: true },
		link: String,
		deletehash: String,
	})
	const File = mongoose.model('File', fileSchema)

	const app = express()

	app.use(cors())
	app.use(bodyParser())
	app.use(
		expressJwt({
			secret: JWT_SECRET,
			algorithms: ['HS256'],
		}).unless({
			path: ['/', '/api/login', '/api/register'],
		}),
	)

	app.get('/', async (req, res) => {
		res.send({
			success: true,
			message: '您好，接口！',
			data: '\\frank/\\frank/\\frank/',
		})
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

	app.post(
		'/api/files/uploadPicture',
		uploadPicture.single('image'),
		async (req, res, next) => {
			try {
				const { file } = req
				if (file) {
					// await imgur.deleteImage('0mZ5RrJSTNWawJY')
					const { id, link, deletehash } = await imgur.uploadBase64(
						Buffer.from(file.buffer).toString('base64'),
					)
					await new File({ id, link, deletehash }).save()
					return res.send({
						success: true,
						message: '上傳圖片成功',
						data: link,
					})
				}
				throw new Error('請上傳圖片')
			} catch (err) {
				next(err)
			}
		},
	)

	app.get('/api/files/:id', async (req, res, next) => {
		try {
			const { id } = req.params
			if (id) {
				const file = await File.findOne({ id }, 'link')
				if (file == null) throw new Error('找不到圖片')

				return res.send({
					success: true,
					message: '取得圖片路徑成功',
					data: file.link,
				})
			}
			throw new Error('圖片 id 為必填')
		} catch (err) {
			next(err)
		}
	})

	app.delete('/api/files/:id', async (req, res, next) => {
		try {
			const { id } = req.params
			if (id) {
				const { deletedCount } = await File.deleteOne({ id })
				if (deletedCount < 1) throw new Error('找不到圖片')

				return res.send({
					success: true,
					message: '刪除圖片成功',
					data: null,
				})
			}
			throw new Error('圖片 id 為必填')
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
