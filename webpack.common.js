const path = require('path');

module.exports = {
    entry: "./src/mercator-gl.js",
    output: {
        library: "MercatorGL",
        path: path.resolve(__dirname, "build"),
        filename: "mercator-gl.min.js",
        libraryTarget: "umd"
    }
};
