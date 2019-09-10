const fs = require('fs');
const path = require('path');
const webpack = require("webpack");
const TerserPlugin = require("terser-webpack-plugin");

const license = fs.readFileSync('LICENSE');

module.exports = {
    entry: "./src/pico-mercator.js",
    mode: "production",
    output: {
        library: "PicoMercator",
        path: path.resolve(__dirname, "build"),
        filename: "pico-mercator.min.js",
        libraryTarget: "umd"
    },
    plugins: [
        // Placeholder for actual license
        new webpack.BannerPlugin({
          banner: 'DUMMY_BANNER'
        })
    ],
    optimization: {
        minimize: true,
        minimizer: [new TerserPlugin({
            sourceMap: true,
            extractComments: {
                condition: true,
                banner: `\n${license}\n`,
            }
        })],
    },
    devtool: "source-map"
};
