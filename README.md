[What is AWS Step Functions][5]

# Building a Docker image
```bash
docker build -t tniezg/aws-step-function-poller .
```

# Running the Docker image with .env variables
Example of running this image on a worker:
```bash
docker run --rm -ti -v "$PWD":/app --env-file=.env tniezg/aws-step-function-poller
```

# How to handle activity tasks from Step Functions
`/app` is the directory where the image will search for index.js. It can be mounted using `-v <host>:/app`, where `<host>` is an absolute path a folder with index.js on the host. index.js can be changed to something else if required by providing `HANDLER_FILENAME` environment variable to Docker.

# Configuration
These values can be provided as environment variables directly to Docker by using `-e` or `--env-file`.

```bash
AWS_KEY_ID # Required.
AWS_ACCESS_KEY # Required.
AWS_ACTIVITY_ARN # Required.
AWS_STEP_FUNCTION_REGION # Required. Default is 'us-east-1'.
POLL_RESTART_DELAY # How many seconds to wait before long polling AWS for activity tasks again, after waiting and/or executing a task. Default is 0 seoncds (restart long polling immediately when ready).
HANDLER_DIR # Directory with the activity tasks handler.
HANDLER_FILENAME # Name of activity task file to execute when an activity task needs to be handled.
AWS_HANDLER_NAME # Activity task handler name used for logging purposes in Step Functions. Default is 'UNNAMED'.
WORKER_TIMEOUT # Maximum time in seconds a handler can consume to handle an activity task. If handler execution takes longer, it will be stopped forcefully. Default timeout is 1 minute.
```

# NPM commands available
```bash
npm run docker-build # Builds the Docker image. Will pull dependencies from NPM and generate files from sources.
npm run docker-run # Runs the Docker image in the foreground with default handler file. Uses .env file (https://www.npmjs.com/package/dotenv) in the project's main directory to provide the image with environment variables.
```
There are also a few more commands inside package.json that can be used for developing the project and running it directly using Node.js, without building a Docker image.

[1]: https://stackoverflow.com/questions/34828722/how-can-i-make-webpack-skip-an-require
[2]: http://webpack.github.io/docs/configuration.html#automatically-created-contexts-defaults-module-xxxcontextxxx
[3]: https://webpack.github.io/docs/context.html
[4]: http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/StepFunctions.html
[5]: https://aws.amazon.com/step-functions/