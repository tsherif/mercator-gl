const path = require('path');

module.exports = {
    entry: "./src/pico-mercator.js",
    output: {
        library: "PicoMercator",
        path: path.resolve(__dirname, "build"),
        filename: "pico-mercator.min.js",
        libraryTarget: "umd"
    }
};
