const isDevelopment = process.env.NODE_ENV === 'development';
const webpack       = require('webpack');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = [
    {
      mode:    isDevelopment ? 'development' : 'production',
      entry:   './src/ts/chargyApp.ts',
      target:  'web',
      devtool: isDevelopment ? "eval-source-map" : "source-map",
      resolve: {
        extensions: ["", ".ts", ".js"],
        alias: {
          'node:buffer': require.resolve('buffer/')
        },
        fallback: {
          assert:    false,
          buffer:    require.resolve('buffer/'),
          constants: false,
          crypto:    false,
          events:    false,
          fs:        false,
          path:      false,
          stream:    false,
          util:      false,
          zlib:      false
        }
      },
      module: {
        rules: [
          {
            test: /\.ts$/,
            //include: /src/,
            use: [{ loader: 'ts-loader' }]
          },
          {
            test: /\.css$/,
            use: [MiniCssExtractPlugin.loader, 'css-loader']
          },
          {
            test: /\.scss$/,
            use: [MiniCssExtractPlugin.loader, 'css-loader', 'sass-loader']
          },
          {
            test: /\.(woff|woff2|eot|ttf|otf|svg)$/,
            type: 'asset/resource',
            generator: {
              filename: 'assets/fonts/[name][ext][query]' // Path and naming of your fonts
            }
          },
          {
            test: /\.(png|jpe?g|gif)$/,
            type: 'asset/resource',
            generator: {
              filename: 'assets/images/[name][ext][query]'
            }
          }
        ]
      },
      externals: {
        'asn1':         'asn1.js',
        'base32decode': 'base32-decode'
      },
      plugins: [
        new webpack.NormalModuleReplacementPlugin(/^node:buffer$/, 'buffer'),
        new webpack.ProvidePlugin({
          Buffer: ['buffer', 'Buffer']
        }),
        new MiniCssExtractPlugin({
          filename: '../css/chargy.css'
        })
      ],
      output: {
        path: __dirname + '/src/build',
        filename: 'chargyApp-bundle.js'
      }
    }
  ];
