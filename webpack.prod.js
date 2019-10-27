const merge = require("webpack-merge");
const webpack = require("webpack");
const fs = require('fs');
const common = require("./webpack.common.js");

const license = fs.readFileSync('LICENSE', {encoding: "utf8"});

module.exports = merge(common, {
    mode: "production",
    plugins: [
        new webpack.BannerPlugin({
          banner: license
        })
    ],
    devtool: "source-map"
});
