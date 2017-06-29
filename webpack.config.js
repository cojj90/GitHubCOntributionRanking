var webpack = require('webpack');

module.exports = function () {
  return {
    entry: {
      bundle: './src/main.ts'
    },
    output: {
      filename: './build/[name].js'
      // library: "GitHubRank",
      // libraryTarget: "commonjs2"
    },
    resolve: {
      extensions: ['*', '.ts', '.js']
    },
    module: {
      loaders: [
        { test: /.ts$/, loader: 'awesome-typescript-loader' }
      ]
    },
    target: 'node'
  };
}