 var CopyWebpackPlugin = require('copy-webpack-plugin');
 
 module.exports = {
     entry: {
         'three-beam-calculator':'./src/three-beam-calc-module.ts'
     },
     output: {
         filename: '[name].js',
         path: __dirname + '/dist',
         library: ['Calculator'],
         libraryTarget: 'umd',
         globalObject: `(typeof self !== 'undefined' ? self : this)`
     },
     mode: 'development',
     resolve: {
         extensions: ['.ts', '.js']
     },
     module: {
         rules: [
             // All files with a '.ts' or '.tsx' extension will be handled by 'awesome-typescript-loader'.
             { test: /\.ts?$/, loader: "awesome-typescript-loader" }
         ]
     },
     devtool: 'eval-source-map',
     plugins: [
         new CopyWebpackPlugin([
             {
                 from: 'src/three-beam-calc-module.d.ts'
             }
         ])
     ]
	 };