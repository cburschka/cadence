const UglifyJSPlugin = require('uglify-es-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: './src/main',
  output: {
    path: __dirname + '/dist',
    filename: 'assets/bundle.js',
  },

  devtool: 'source-map',
  plugins: [
    new UglifyJSPlugin(),
    //new HtmlWebpackPlugin({template: 'src/index.ejs'}),
  ],
};
