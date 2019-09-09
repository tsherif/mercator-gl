PicoMercator
============

PicoMercator is a minimal library for doing web mercator projections in WebGL in a manner compatible with [Mapbox GL](https://github.com/mapbox/mapbox-gl-js). It provides GLSL code for projecting longitude/latitude coordinates into 3D space, and JavaScript functions to create view and projection matrices to overlay them onto a map rendered by Mapbox GL. PicoMercator focuses on numerical stability by performing most calculations at 64-bit precision, and switching to an "offset mode" at higher zoom levels (using a technique borrowed from [deck.gl](https://medium.com/vis-gl/how-sometimes-assuming-the-earth-is-flat-helps-speed-up-rendering-in-deck-gl-c43b72fd6db4)).

Basic usage involves rendering to a WebGL canvas overlayed on the Mapbox element, and updating to match the current map view. PicoMercator provides a function `injectGLSLProjection` to insert functions `PICO_lngLatToWorld`, `PICO_worldToClip`, and `PICO_lngLatToClip` into vertex shader source code so the mercator projection can be done on the GPU. The JavaScript function `forEachUniform` provides names and values of uniforms used by the PicoMercator shader functions so they can be set in whatever manner is appropriate for the application.

```JavaScript

    let map = new mapboxgl.Map({
        container: mapboxContainer,
        style: "mapbox://styles/mapbox/streets-v9",
        center: [-122.427, 37.752],
        zoom: 15
    });

    let vs = `
        #version 300 es
        layout(location=0) in vec2 lngLatPosition;
        void main() {
            // PICO_lngLatToClip function injected by injectGLSLProjection().
            // PICO_lngLatToWorld and PICO_worldToClip also available to do
            // projection in multiple steps.
            gl_Position = PICO_lngLatToClip(position);
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


    // Insert function PICO_project_mercator into vertex shader
    let vertexShaderSource = PICO_injectGLSLProjection(vs);
    let fragmentShaderSource =  fs;
    // Create WebGL program from vertexShaderSource and fragmentShaderSource

    // Use 64-bit precision matrices to avoid numerical instability 
    // in intermediate calculations
    let viewMatrix = PICO_highPrecisionMat4();
    let projectionMatrix = PICO_highPrecisionMat4();

    map.on("render", (e) => {
        let {lng, lat} = map.getCenter();
        let zoom = map.getZoom();
        let pitch = map.getPitch();
        let bearing = map.getBearing();


        PICO_mapboxViewMatrix(viewMatrix, {
            longitude: lng,
            latitude: lat,
            zoom,
            pitch,
            bearing,
            canvasHeight: canvas.height
        });

        PICO_mapboxProjectionMatrix(projectionMatrix, {
            zoom,
            pitch,
            near, // Distance to near plane, far is calculated automatically
            canvasWidth: canvas.width,
            canvasHeight: canvas.height
        });

        PICO_forEachUniform(lng, lat, zoom, viewMatrix, projectionMatrix, (name, value) => {
            // Set PicoMercator uniforms
        });

        // Draw to canvas
    });

``` 

