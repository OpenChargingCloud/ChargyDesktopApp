const isDevelopment = process.env.NODE_ENV === 'development';
const path                 = require('path');
const webpack              = require('webpack');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const MinimizerPlugin      = require('minimizer-webpack-plugin');
const packageLock          = require('./package-lock.json');

const chargyCoreNpmIntegrity =
  packageLock.packages?.['node_modules/@open-charging-cloud/chargy-core']?.integrity ?? '';

/**
 * pdfjs-dist 6.2.108 uses private fields inside dynamic WASM imports. Terser
 * 5.50.0 renames their declarations inconsistently and produces
 * "Private field '#wasmUrl' must be declared in an enclosing class".
 * Keep only the PDF worker unminified until its minified production chunk
 * passes `node --check`; named chunk IDs keep this matcher stable in production.
 */
const pdfWorkerAssetPattern = /pdf[_-]worker/i;

const sourceMapModuleName = info => {
  let resourcePath = (info.resourcePath || info.absoluteResourcePath || '').replace(/\\/g, '/');

  resourcePath = resourcePath
    .replace(/^ignored\|.*\/node_modules\//, 'ignored|node_modules/')
    .replace(/^.*\/node_modules\//, 'node_modules/')
    .replace(/^\.\//, '');

  return `webpack://chargytransparenzsoftware/${resourcePath}`;
};

module.exports = [
    {
      mode:    isDevelopment ? 'development' : 'production',
      entry:   './src/ts/chargyApp.ts',
      target:  'web',
      devtool: isDevelopment ? "eval-source-map" : "source-map",
      optimization: {
        chunkIds: 'named',
        minimizer: [
          new MinimizerPlugin({
            exclude: pdfWorkerAssetPattern
          })
        ]
      },
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
            test: /\.js$/,
            enforce: 'pre',
            include: path.resolve(__dirname, 'node_modules/@open-charging-cloud/chargy-core'),
            use: ['source-map-loader']
          },
          {
            test: /\.ts$/,
            //include: /src/,
            use: [{
              loader: 'ts-loader',
              options: {
                compilerOptions: {
                  noEmit: false
                }
              }
            }]
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
        new webpack.DefinePlugin({
          __CHARGY_CORE_NPM_INTEGRITY__: JSON.stringify(chargyCoreNpmIntegrity)
        }),
        new webpack.NormalModuleReplacementPlugin(/^node:buffer$/, 'buffer'),
        new webpack.ProvidePlugin({
          Buffer: ['buffer', 'Buffer']
        }),
        new MiniCssExtractPlugin({
          filename: '../css/chargy.css'
        })
      ],
      output: {
        path:                          path.resolve(__dirname, 'src/build'),
        filename:                      'chargyApp-bundle.js',
        // Remove stale numeric worker chunks, but retain the tracked empty directory.
        clean: {
          keep: '.gitkeep'
        },
        devtoolModuleFilenameTemplate: sourceMapModuleName
      }
    }
  ];
