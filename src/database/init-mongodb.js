const mongoose = require('mongoose')

// mongodb atlas connect tutorial https://zhuanlan.zhihu.com/p/347990778
const uri = process.env.MONGODB_URI

module.exports = new Promise(resolve => {
	mongoose
		.connect(uri, {
			useNewUrlParser: true,
			useUnifiedTopology: true,
		})
		.then(() => {
			console.log('MongoDB Connected…')
			const kittySchema = mongoose.Schema({
				name: String,
			})
			const Kitten = mongoose.model('Kitten', kittySchema)
			resolve({ db: mongoose, models: { Kitten } })
		})
		.catch(err => console.log(err))
})
