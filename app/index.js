const { promisify } = require('util')

// This is an example step function handler. It receives a aws-sdk StepFunctions 
// instance, already configured for use.
module.exports = async (stepFunctions, data) => {
	try {
		const { input, taskToken } = data
		console.log(`Received activity task: ${JSON.stringify(JSON.parse(input), null, 2)}.`)
		await promisify(stepFunctions.sendTaskSuccess).bind(stepFunctions)({
			output: JSON.stringify({ someOutputKey: 'some output value' }),
			taskToken: taskToken
		})
		console.log(`Task success sent.`)
	} catch (err) {
		console.error(`Exception raised, couldn't send task success (${JSON.stringify(err)}).`)
		throw new Error()
	}
}