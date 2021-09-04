const setupModel = mongoose => {
	const kittySchema = mongoose.Schema({
		name: String,
	})

	return {
		Kitten: mongoose.model('Kitten', kittySchema),
	}
}

module.exports = setupModel
