const mongoose = require('mongoose')

// process.env.DB_USERNAME process.env.DB_PASSWORD
const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.hn65m.mongodb.net/test`

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
		const felyne = new Kitten({ name: 'Felyne' })
		felyne.save((err, fluffy) => {
			if (err) return console.error(err)
		})
	})
	.catch(err => console.log(err))
