PicoMercator
============

PicoMercator is a minimal library for doing web mercator projections in WebGL in a manner compatible with [Mapbox GL](https://github.com/mapbox/mapbox-gl-js). It provides GLSL code for projecting longitude/latitude coordinates into 3D space, and JavaScript functions to create view and projection matrices to overlay them onto a map rendered by Mapbox GL. PicoMercator focuses on numerical stability by performing most calculations at 64-bit precision, and switching to an "offset mode" at higher zoom levels (using a technique borrowed from [deck.gl](https://medium.com/vis-gl/how-sometimes-assuming-the-earth-is-flat-helps-speed-up-rendering-in-deck-gl-c43b72fd6db4)).

Basic usage involves rendering to a WebGL canvas overlayed on the Mapbox element, and updating to match the current map view. PicoMercator provides a function `pico_mercator_injectGLSLProjection` to insert functions `pico_mercator_lngLatToWorld`, `pico_mercator_worldToClip`, and `pico_mercator_lngLatToClip` into vertex shader source code so the mercator projection can be done on the GPU. The JavaScript function `pico_mercator_forEachUniform` provides names and values of uniforms used by the PicoMercator shader functions so they can be set in whatever manner is appropriate for the application.

```JavaScript

    let map = new mapboxgl.Map({
        container: mapboxContainer,
        style: "mapbox://styles/mapbox/streets-v9",
        center: [-73.982130, 40.762896],
        zoom: 15
    });

    let vs = `
        #version 300 es
        layout(location=0) in vec2 lngLatPosition;
        void main() {
            // pico_mercator_lngLatToClip function injected by injectGLSLProjection().
            // pico_mercator_lngLatToWorld and pico_mercator_worldToClip also available to do
            // projection in multiple steps.
            gl_Position = pico_mercator_lngLatToClip(position);
        }
    `;

    let fs = `
        #version 300 es
        precision highp float;
        out vec4 fragColor;
        void main() {
            fragColor = vec4(1.0);
        }
    `;


    // Insert projection functions into vertex shader
    let vertexShaderSource = pico_mercator_injectGLSLProjection(vs);
    let fragmentShaderSource =  fs;
    // Create WebGL program from vertexShaderSource and fragmentShaderSource

    // Use 64-bit precision matrices to avoid numerical instability 
    // in intermediate calculations
    let viewProjectionMatrix = pico_mercator_highPrecisionMat4();

    map.on("render", (e) => {
        let center = map.getCenter().toArray();
        let zoom = map.getZoom();
        let pitch = map.getPitch();
        let bearing = map.getBearing();

        pico_mercator_mapboxViewProjectionMatrix(
            viewProjectionMatrix,
            center,
            zoom,
            pitch,
            bearing,
            canvas.width,
            canvas.height
        );

        pico_mercator_uniforms(lng, lat, zoom, viewProjectionMatrix, (uniforms) => {
            // `uniforms` is a map of uniform names to values, that the application
            // can use to update uniforms however it likes.
            // NOTE: uniform values are only valid for the duration 
            // of the callback.
        });

        // Draw to canvas
    });

``` 

