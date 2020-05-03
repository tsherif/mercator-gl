MercatorGL
==========

[![Build Status](https://img.shields.io/travis/com/tsherif/mercator-gl)](https://travis-ci.com/tsherif/mercator-gl) [![Coverage Status](https://img.shields.io/coveralls/github/tsherif/mercator-gl)](https://coveralls.io/github/tsherif/mercator-gl?branch=master) [![GZIP size](https://badge-size.herokuapp.com/tsherif/mercator-gl/master/build/mercator-gl.min.js.svg?compression=gzip)](https://github.com/tsherif/mercator-gl/blob/master/build/mercator-gl.min.js) [![License](https://img.shields.io/github/license/tsherif/mercator-gl.svg)](https://github.com/tsherif/mercator-gl/blob/master/LICENSE) [![NPM](https://img.shields.io/npm/v/mercator-gl.svg)](https://www.npmjs.com/package/mercator-gl)

MercatorGL is a minimal library for calculating web mercator projections on a GPU using WebGL. It provides utilities to inject GLSL code for projecting longitude/latitude coordinates into already exisiting vertex shader code and calculate the uniforms it requires. MercatorGL focuses on numerical stability by performing most calculations at 64-bit precision, and switching to an "offset mode" at higher zoom levels (using a technique borrowed from [deck.gl](https://medium.com/vis-gl/how-sometimes-assuming-the-earth-is-flat-helps-speed-up-rendering-in-deck-gl-c43b72fd6db4)).

Following [Mapbox conventions](https://blog.mapbox.com/512-map-tiles-cb5bfd6e72ba) input coordinates are transformed to a 512x512 Mercator space, with (0, 0) at the top-left and (512, 512) at the bottom-right. Z-coordinates, if provided, are interpreted as meter elevations. The application must provide a projection matrix (via `updateMercatorUniforms`) to map from Mercator space into clip space.

An example of usage with [MapboxGL](https://docs.mapbox.com/mapbox-gl-js/api/) is shown below.

```JavaScript
    let map = new mapboxgl.Map({
        container: mapboxContainer,
        style: "mapbox://styles/mapbox/streets-v9",
        center: [-73.982130, 40.762896],
        zoom: 15
    });

    // NOTE: MercatorGL works with both GLSL 1 and 3 shaders
    let vs = `
        #version 300 es
        layout(location=0) in vec2 lngLatPosition;
        void main() {
            // mercator_gl_lngLatToClip function injected by injectMercatorGLSL().
            // mercator_gl_lngLatToMercator and mercator_gl_mercatorToClip also available to do
            // projection in multiple steps.
            gl_Position = mercator_gl_lngLatToClip(position);
        }
    `;

    let fs = `
        #version 300 es
        precision highp float;
        uniform vec4 color;
        out vec4 fragColor;
        void main() {
            fragColor = color;
        }
    `;


    // Insert projection functions into vertex shader
    let vertexShaderSource = injectMercatorGLSL(vs);
    let fragmentShaderSource =  fs;
    // Create WebGL program from vertexShaderSource and fragmentShaderSource

    let uniforms = {
        // An application uniform, not used by MercatorGL
        color: new Float32Array(1.0, 0.0, 0.0, 1.0);
    };

    // Uniforms used by MercatorGL are added to the map.
    allocateMercatorUniforms(uniforms);

    map.on("render", (e) => {
        let center = map.getCenter().toArray();
        let zoom = map.getZoom();

        // Update the values of MercatorGL uniforms in the map (including projection matrix provided by Mapbox).
        // The application must use the map to update program uniforms used by MercatorGL.
        updateMercatorUniforms(uniforms, center, zoom, map.transform.projMatrix);

        // Draw to canvas
    });
``` 

