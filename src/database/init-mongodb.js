const mongoose = require('mongoose')

const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.hn65m.mongodb.net/test`

mongoose
	.connect(uri, {
		useNewUrlParser: true,
		useUnifiedTopology: true,
	})
	.then(() => {
		console.log('MongoDB Connected…')
	})
	.catch(err => console.log(err))
