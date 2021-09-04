const mongoose = require('mongoose')
const createModel = require('@model/index')

// mongodb atlas connect tutorial https://zhuanlan.zhihu.com/p/347990778
const uri = process.env.MONGODB_URI

const setupMongodb = new Promise(resolve => {
	mongoose
		.connect(uri, {
			useNewUrlParser: true,
			useUnifiedTopology: true,
		})
		.then(() => resolve({ db: mongoose, models: createModel(mongoose) }))
		.catch(err => console.log(err))
})

module.exports = setupMongodb
