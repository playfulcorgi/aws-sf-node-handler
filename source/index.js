import sourceMapSupport from 'source-map-support'
import { StepFunctions } from 'aws-sdk'
import remapEnv from './remapEnv'
import cluster from 'cluster'
import requiredEnvKeys from './requiredEnvKeys'
import path from 'path'
import clamp from 'lodash/clamp'
import toSafeInteger from 'lodash/toSafeInteger'
import { promisify } from 'util'

sourceMapSupport.install()

const env = remapEnv([
	...requiredEnvKeys,
	{
		key: 'POLL_RESTART_DELAY',
		option: true,
		cast: source => {
			if (/^[0-9]+$/.test(source)) {
				return clamp(toSafeInteger(source), 0, Number.MAX_SAFE_INTEGER)
			} else {
				return 0
			}
		}
	},
	{ key: 'INPUT', option: true },
	{ key: 'TASK_TOKEN', option: true },
	{ key: 'HANDLER_DIR', option: true, cast: source => source || '/app' },
	{ key: 'AWS_HANDLER_NAME', option: true, cast: source => source || 'UNNAMED' },
	{
		key: 'WORKER_TIMEOUT',
		option: true,
		cast: source => {
			if (/^[0-9]+$/.test(source)) {
				return clamp(toSafeInteger(source), 0, Number.MAX_SAFE_INTEGER)
			} else {
				return 60
			}
		}
	},
	{
		key: 'HANDLER_FILENAME',
		option: true,
		cast: source => source || 'index.js'
	},
	{
		key: 'AWS_STEP_FUNCTION_REGION',
		option: true,
		cast: source => source || 'us-east-1'
	}
])

const stepFunctions = new StepFunctions({
	region: env.awsStepFunctionRegion,
	accessKeyId: env.awsKeyId,
	secretAccessKey: env.awsAccessKey
})

if (cluster.isMaster) {
	const poll = (cluster, stepFunctions, env, delaySeconds = 0) => {
		console.log(`Polling activity for tasks.`)
		promisify(stepFunctions.getActivityTask).bind(stepFunctions)({
			activityArn: env.awsActivityArn,
			workerName: env.awsHandlerName
		})
			.then(data => {
				if (!data.taskToken) {
					console.log(`No activities scheduled, polling activity again after ${delaySeconds}s delay.`)
					setTimeout(() => {
						poll(cluster, stepFunctions, env, delaySeconds)
					}, delaySeconds * 1000);
				} else {
					console.log(`Received data: ${JSON.stringify(data, null, 2)}`)
					console.log(`Creating worker to handle activity task. Once it finishes, polling of activity will resume.`)
					cluster.fork({
						...process.env,
						INPUT: data.input,
						TASK_TOKEN: data.taskToken
					})
				}
			}, err => {
				console.error(`An error occured while calling "stepFunctions.getActivityTask".`)
				console.error(err, err.stack);
			})
	}

	const delaySeconds = env.pollRestartDelay

	cluster.on('disconnect', () => {
		console.error(`Fork disconnected (gracefully, was killed or was manually disconnected). Polling of activity will resume in ${delaySeconds}s.`)

		setTimeout(() => {
			poll(cluster, stepFunctions, env, delaySeconds)
		}, delaySeconds * 1000)
	})

	poll(cluster, stepFunctions, env, delaySeconds)
} else {
	process.chdir(path.resolve(env.handlerDir))
	// FIXME: The following line of code is ugly, but import/export only allows 
	// static imports, so require will have to do for now. eval is used to prevent
	// Webpack from trying to parse require - handler files should not be part of 
	// the Docker image package.
	const handlerPath = path.resolve(env.handlerDir, env.handlerFilename)
	console.log(`Running handler at ${handlerPath}.`)
	const handler = eval('require')(handlerPath)
	const handlerSandbox = async (handler, stepFunctions, env) => {
		console.log(`Running activity task handler. Execution timeout is ${env.workerTimeout}s.`)
		const workerTimeout = setTimeout(() => {
			console.log(`Timeout reached. Sending task failure.`)
			promisify(stepFunctions.sendTaskFailure).bind(stepFunctions)({
				taskToken: env.taskToken,
				error: 'Timeout',
				cause: new Error().stack
			})
				.then(data => {
					console.log(`Task failure sent successfully.`)
					process.exit(1)
				}, err => {
					console.error(`Couldn't send task failure after timeout (${JSON.stringify(err)}). Maybe task finished successfully while sending task failure? Or will have to wait for task timeout by AWS Step Functions engine.`)
					process.exit(1)
				})
		}, env.workerTimeout * 1000)

		try {
			await handler(
				stepFunctions,
				{
					input: env.input,
					taskToken: env.taskToken
				}
			)
			console.log(`Activity task handler finished running (with no uncaught exceptions).`)
		} catch (error) {
			// FIXME: Consider changing exception handling here. It may be better to
			// let polling finish instead of polling for tasks again if the handler is 
			// inherently broken(ex.there's a syntax error that will cause the handler 
			// to always fail).This behavior can potentially drain the activity and 
			// fail every task.The best solution may be to have a RETRY_COUNT env 
			// variable which will count the number of consecutive failed handler 
			// executions and stop polling in such case.
			console.error(`Task handler raised exception (name: ${error.name}, message: ${error.message}, stack: ${error.stack}).`)
			try {
				await promisify(stepFunctions.sendTaskFailure).bind(stepFunctions)({
					taskToken: env.taskToken,
					error: error.name,
					cause: error.stack
				})
				console.log(`Task failure sent successfully.`)
			} catch (err) {
				console.error(`Couldn't send task failure after task handler exception (${JSON.stringify(err)}). Will have to wait for task timeout by AWS Step Functions engine.`)
			}
		}
		clearTimeout(workerTimeout)
		console.log(`Task finished before timeout (successfully or not).`)
	}
	handlerSandbox(handler, stepFunctions, env).then(process.exit, process.exit)
}