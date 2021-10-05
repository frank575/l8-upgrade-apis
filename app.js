const http = require('http')
const { Server: SocketServer } = require('socket.io')
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
const { getImgurPictureId } = require('./utils')

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

const JWT_PROPS = {
	secret: JWT_SECRET,
	algorithms: ['HS256'],
}

;(async () => {
	await mongoose.connect(MONGODB_URI)
	console.log('MongoDB connected...')

	const userSchema = new mongoose.Schema({
		name: String,
		username: { type: String, required: true, unique: true },
		password: { type: String, required: true },
		imgLink: { type: String },
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

	const commonUserUploadPicture = async (req, res, file, isBase64 = false) => {
		if (file) {
			const userId = req.user._id
			const user = await User.findById(userId, 'imgLink')
			if (user == null) throw new Error('找不到使用者')

			const { link: newImgLink } = await uploadImgurAndSave(file, isBase64)

			if (user.imgLink != null) {
				const imgurPictureId = getImgurPictureId(user.imgLink)
				if (imgurPictureId != null) {
					try {
						// 找不到圖片不砍就是了
						await deleteDbAndImgurPicture(imgurPictureId)
					} catch {}
				}
			}

			await User.updateOne({ _id: userId }, { imgLink: newImgLink })

			res.send({
				success: true,
				message: '上傳圖片成功',
				data: newImgLink,
			})
		} else {
			throw new Error('請上傳圖片')
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

	const uploadImgurAndSave = async (file, isBase64 = false) => {
		const base64 = isBase64 ? file : Buffer.from(file.buffer).toString('base64')
		const { id, link, deletehash } = await imgur.uploadBase64(base64)
		return await new File({ id, link, deletehash }).save()
	}

	const deleteDbAndImgurPicture = async id => {
		const file = await File.findOneAndRemove({ id })
		if (file == null) throw new Error('找不到圖片')

		await imgur.deleteImage(file.deletehash)
	}

	const app = express()
	const server = http.createServer(app)
	const io = new SocketServer(server, { cors: { origin: '*' } })

	app.use(cors())
	app.use(bodyParser())

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
			const user = await User.findOne(
				{ username },
				'name username role imgLink',
			)

			if (user == null)
				throw new Error('使用者不存在，請確認帳號或密碼是否正確')

			const token = user.getJwtToken()

			res.send({
				success: true,
				message: '登入成功',
				token,
				data: user,
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

			const user = await User.findOne(
				{ username },
				'name username role imgLink',
			)

			if (user != null) throw new Error('使用者已存在')

			await new User({
				...body,
				password: md5(body.password),
			}).save()

			res.send({
				success: true,
				message: '註冊成功',
				data: null,
			})
		} catch (err) {
			next(err)
		}
	})

	app.get('/api/user', expressJwt(JWT_PROPS), async (req, res, next) => {
		try {
			const userId = req.user._id
			const user = await User.findById(userId, 'name username role imgLink')

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

	app.get('/api/users', expressJwt(JWT_PROPS), async (req, res, next) => {
		try {
			const { page, size } = req.query
			const users = await User.find()
			const content = users.slice(page * size, (Number(page) + 1) * size)

			res.send({
				success: true,
				message: '取得使用者列表成功',
				data: {
					content: content,
					total: users.length,
				},
			})
		} catch (err) {
			next(err)
		}
	})

	app.get(
		'/api/users/:username',
		expressJwt(JWT_PROPS),
		async (req, res, next) => {
			try {
				const { username } = req.params
				const user = await User.findOne(
					{ username },
					'name username role imgLink',
				)

				if (user == null) throw new Error('使用者不存在')

				res.send({
					success: true,
					message: '取得使用者成功',
					data: user,
				})
			} catch (err) {
				next(err)
			}
		},
	)

	app.put(
		'/api/users/updateName',
		expressJwt(JWT_PROPS),
		async (req, res, next) => {
			try {
				const { name } = req.body
				if (name == null) throw new Error('body.name 為必填')
				if (typeof name !== 'string' || name.trim().length === 0)
					throw new Error('名字不能為空字串')

				const { _id } = req.user
				const user = await User.findOneAndUpdate({ _id }, { name })

				if (user == null) throw new Error('使用者不存在')

				res.send({
					success: true,
					message: '修改使用者名稱成功',
					data: null,
				})
			} catch (err) {
				next(err)
			}
		},
	)

	app.post(
		'/api/users/uploadPicture',
		expressJwt(JWT_PROPS),
		uploadPicture.single('image'),
		async (req, res, next) => {
			try {
				const { file } = req
				await commonUserUploadPicture(req, res, file)
			} catch (err) {
				next(err)
			}
		},
	)

	app.post(
		'/api/users/uploadBase64Picture',
		expressJwt(JWT_PROPS),
		async (req, res, next) => {
			try {
				const { base64Image } = req.body
				await commonUserUploadPicture(req, res, base64Image, true)
			} catch (err) {
				next(err)
			}
		},
	)

	app.post(
		'/api/files/uploadPicture',
		expressJwt(JWT_PROPS),
		uploadPicture.single('image'),
		async (req, res, next) => {
			try {
				const { file } = req
				if (file) {
					const { link } = await uploadImgurAndSave(file)

					res.send({
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

	app.get('/api/files/:id', expressJwt(JWT_PROPS), async (req, res, next) => {
		try {
			const { id } = req.params
			if (id) {
				const file = await File.findOne({ id }, 'link')
				if (file == null) throw new Error('找不到圖片')

				res.send({
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

	app.delete(
		'/api/files/:id',
		expressJwt(JWT_PROPS),
		async (req, res, next) => {
			try {
				const { id } = req.params
				if (id) {
					await deleteDbAndImgurPicture(id)

					res.send({
						success: true,
						message: '刪除圖片成功',
						data: null,
					})
				}
				throw new Error('圖片 id 為必填')
			} catch (err) {
				next(err)
			}
		},
	)

	app.use((req, res, next) => {
		res.status(404).send({
			success: false,
			message: '找不到API',
			data: null,
		})
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

	io.on('connection', s => {
		console.log('a user connected')
		s.on('disconnect', () => {
			console.log('user disconnected')
		})
		s.on('chat message', msg => {
			console.log('message: ' + msg)
			io.emit('chat message', '>> pong')
		})
	})

	server.listen(process.env.PORT || APP_PORT, () => {
		console.log(`Server listening at http://localhost:${APP_PORT}`)
	})
})()
