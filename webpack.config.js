const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const { ProvidePlugin, DefinePlugin, IgnorePlugin } = require('webpack');

module.exports = (env) => {
  const isProduction = env.NODE_ENV === 'production';
  return {
    mode: env.NODE_ENV,
    output: {
      publicPath: '/',
      // Production names carry a content hash (OpenConceptLab/ocl_issues#2824),
      // so a changed bundle gets a new URL. nginx caches these files for a year
      // and revalidates index.html on every load, so a returning browser never
      // mixes bundles from two builds. nginx/default.conf.template matches the
      // names by pattern; change the two together. Dev keeps webpack's
      // defaults.
      filename: isProduction ? '[name].[contenthash:8].js' : '[name].js',
      chunkFilename: isProduction ? '[name].[contenthash:8].js' : '[name].js',
    },
    module: {
      rules: [
        {
          test: /\.(js|jsx)$/,
          use: ['babel-loader'],
          exclude: /node_modules/,
        },
        {
          test: /\.(png|jpg|woff|woff2|eot|ttf|svg)$/,
          loader: 'url-loader'
        },
        {
          test: /\.(scss|css)$/,
          use: [{
            loader: 'style-loader', // creates style nodes from JS strings
          }, {
            loader: 'css-loader', // translates CSS into CommonJS
          }, {
            loader: 'sass-loader', // compiles Sass to CSS
          }],
        },
      ],
    },
    optimization: isProduction ? {
      splitChunks: {
        chunks: 'all',
        minSize: 100000,
        minRemainingSize: 0,
        minChunks: 1,
        maxAsyncRequests: 30,
        maxInitialRequests: 30,
        cacheGroups: {
          default: false,
          vendors: false,
          react: {
            chunks: 'all',
            test: /[\\/]node_modules[\\/](react|react-dom|react-router-dom)[\\/]/,
            name: "react"
          },
          lodash: {
            chunks: 'all',
            test: /[\\/]node_modules[\\/](lodash)[\\/]/,
            name: "lodash"
          },
          moment: {
            chunks: 'all',
            test: /[\\/]node_modules[\\/](moment|moment-timezone)[\\/]/,
            name: "moment",
            reuseExistingChunk: true
          },
          material: {
            chunks: 'all',
            test: /[\\/]node_modules[\\/](@material-ui[\\/]core|@material-ui[\\/]icons)[\\/]/,
            name: "material",
            reuseExistingChunk: true
          },
          materialLab: {
            chunks: 'all',
            test: /[\\/]node_modules[\\/](@material-ui[\\/]lab)[\\/]/,
            name: "material-lab",
            reuseExistingChunk: true
          },
          materialPickers: {
            chunks: 'all',
            test: /[\\/]node_modules[\\/](@material-ui[\\/]pickers)[\\/]/,
            name: "material-pickers",
            reuseExistingChunk: true
          },
          vendor: {
            name: 'vendor',
            chunks: 'all',
            test: /[\\/]node_modules[\\/](!react)(!react-dom)(!react-router-dom)(!@material-ui)(!lodash)(!moment)(!moment-timezone)[\\/]/,
            reuseExistingChunk: true,
            priority: 20
          }
        }
      }
    } : {},
    devServer: {
      static: {
        directory: path.join(__dirname, 'public')
      },
      historyApiFallback: {
        index: '/index.html',
        disableDotRule: true,
      }
    },
    devtool: env.NODE_ENV == 'production' ? "source-map" : undefined,
    plugins: [
      new HtmlWebpackPlugin({
        template: './public/index.html',
      }),
      // Emits nothing today: the scss rule uses style-loader, so styles ship
      // inside the JS bundles. Hashed like them in case it is ever used.
      new MiniCssExtractPlugin({filename: isProduction ? '[name].[contenthash:8].css' : 'bundle.css'}),
      new CopyWebpackPlugin(['src/assets']),
      new ProvidePlugin({
        $: 'jquery',
        jQuery: 'jquery',
        'window.jQuery': 'jquery',
        Popper: ['popper.js', 'default'],
      }),
      new DefinePlugin({
        'process.env.API_URL': JSON.stringify(env.API_URL),
        'process.env.NODE_ENV': JSON.stringify(env.NODE_ENV) || 'development',
        'process.env.GA_ACCOUNT_ID': JSON.stringify(env.GA_ACCOUNT_ID),
        'process.env.HOTJAR_ID': JSON.stringify(env.HOTJAR_ID),
        'process.env.ERRBIT_URL': JSON.stringify(env.ERRBIT_URL),
        'process.env.ERRBIT_KEY': JSON.stringify(env.ERRBIT_KEY),
        'process.env.LOGIN_REDIRECT_URL': JSON.stringify(env.LOGIN_REDIRECT_URL),
        'process.env.OIDC_RP_CLIENT_ID': JSON.stringify(env.OIDC_RP_CLIENT_ID),
        'process.env.OCL_ONLINE': JSON.stringify(env.OCL_ONLINE) || 'false',
        'process.env.BRIDGE_MATCH_URL': JSON.stringify(env.BRIDGE_MATCH_URL || '') || '',
        'process.env.AI_ASSISTANT_API_URL': JSON.stringify(env.AI_ASSISTANT_API_URL || '') || '',
        'process.env.SCISPACY_LOINC_API_URL': JSON.stringify(env.SCISPACY_LOINC_API_URL || '') || '',
        'process.env.OCL_ONLINE_API_URL': JSON.stringify(env.OCL_ONLINE_API_URL || '') || ''
      }),
      new IgnorePlugin({ resourceRegExp: /moment\/locale\// })
    ],
    resolve: {
      extensions: ['.js', '.jsx'],
    },
  };
};
