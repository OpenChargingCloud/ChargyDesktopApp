// webpack.config.js
module.exports = [
    {
      mode: 'development',
      entry: './src/js/chargyApp.ts',
      target: 'electron-renderer',
      devtool: "source-map",
      module: {
        rules: [{
          test: /\.ts$/,
          include: /src/,
          use: [{ loader: 'ts-loader' }]
        }]
      },
      externals: {
        'asn1': 'asn1.js',
        'base32decode': 'base32-decode'
      },
      output: {
        path: __dirname + '/src/js',
        filename: 'chargyApp2.js'
      }
    }
  ];
