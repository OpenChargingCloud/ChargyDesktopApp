// webpack.config.js
module.exports = [
    {
      mode:    'development',
      entry:   './src/ts/chargyApp.ts',
      target:  'electron-renderer',
      devtool: "eval-source-map",  // Do not use in production!
      //devtool: "source-map",     // Secure, but very slow: Use in production!
      resolve: {
        extensions: ["", ".ts", ".js"]
      },
      module: {
        rules: [{
          test: /\.ts$/,
          //include: /src/,
          use: [{ loader: 'ts-loader' }]
        }]
      },
      externals: {
        'asn1':         'asn1.js',
        'base32decode': 'base32-decode'
      },
      output: {
        path: __dirname + '/src/build',
        filename: 'chargyApp-bundle.js'
      }
    }
  ];
