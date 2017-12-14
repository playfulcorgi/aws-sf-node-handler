// devtool - This option controls if and how source maps are generated.
// https://webpack.js.org/configuration/devtool/
// https://github.com/webpack/webpack/tree/master/examples/source-map

const CleanWebpackPlugin = require('clean-webpack-plugin');
const path = require('path')
const source = './source'
const deploy = './deploy'

module.exports = {
	devtool: 'source-map',
	entry: path.resolve(__dirname, source, 'index.js'),
	target: 'node',
	plugins: [
		new CleanWebpackPlugin([deploy])
	],
	module: {
		rules: [
			{
				test: /\.js$/,
				exclude: /node_modules/,
				use: {
					// https://webpack.js.org/loaders/babel-loader/
					loader: 'babel-loader',
					options: {
						presets: ['babel-preset-env'],
						plugins: [
							'transform-runtime',
							'transform-es2015-modules-commonjs',
							'transform-object-rest-spread'
						],
						cacheDirectory: true
					}
				}
			},
		]
	},
	output: {
		filename: 'index.js',
		path: path.resolve(__dirname, deploy)
	}
}