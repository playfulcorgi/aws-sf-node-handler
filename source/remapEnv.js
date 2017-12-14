import camelCase from 'lodash/camelCase'

const convertKey = key => camelCase(key)
const unity = originalValue => originalValue

/**
 * Allows environment variables' validation and transformation into an easier to 
 * manage object. Does not modify process.env.
 * @param {array} [managedParameters=[]] Instructions for handling parameters from 
 * process.env. Form: [
 * 	{string} key, // Basic form. Forces key to be present 
 * 		and not an empty string.
 * 	{
 * 		{string} key // Environment variable to search for.
 * 		{boolean} [option] // Whether the variable is optional.
 * 		{function} [cast] // Function called to transform value under key. 
 * 			Receives one parameter - original variable value and returns its
 * 			transformation. If option is true, will receive empty strings when
 * 			variable has no value. If option is false, will only receive non-empty
 * 			strings and for empty-strings the function will fail.
 * 	}
 * ]
 * @param {object} [processEnv=process.env] Source of environment variables.
 * @throws {Error} All required environment variables must exist and be 
 * non-empty strings.
 * @returns {object} Processed environment variables. Each variable key provided
 * in managedParameters will be changed to camelCase.
 */
export default (managedParameters = [], processEnv = process.env) => {
	// processEnv - object with values being only strings or missing.
	const env = {}
	let requiredExist = true
	let checkedParameterIndex = 0
	while (requiredExist && checkedParameterIndex < managedParameters.length) {
		const parameterDefinition = managedParameters[checkedParameterIndex]
		if (typeof parameterDefinition === 'string') {
			const key = parameterDefinition

			if (!processEnv[key]) {
				requiredExist = false
			} else {
				const cast = unity
				env[convertKey(key)] = cast(processEnv[key])
			}
		} else {
			let shouldCast = false
			const key = parameterDefinition.key

			if (parameterDefinition.option) {
				if (!processEnv[key]) {
					env[convertKey(key)] = ''
				}
				shouldCast = true
			} else {
				if (!processEnv[key]) {
					requiredExist = false
				} else {
					shouldCast = true
				}
			}

			if (shouldCast) {
				let cast
				if (typeof parameterDefinition.cast !== 'function') {
					cast = unity
				} else {
					cast = parameterDefinition.cast
				}
				env[convertKey(key)] = cast(processEnv[key])
			}
		}
		checkedParameterIndex++
	}

	if (!requiredExist) {
		throw new Error(`Missing environment variable(s) (${managedParameters[checkedParameterIndex - 1]}).`)
	}

	return env
}