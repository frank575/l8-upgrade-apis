const { createEnum } = require('./utils')

exports.ERole = createEnum({
	ADMIN: 'ADMIN',
	USER: 'USER',
})
