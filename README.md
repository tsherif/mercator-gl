PicoMercator
============

PicoMercator is a minimal library for doing web mercator projections in WebGL in a manner compatible with [Mapbox GL](https://github.com/mapbox/mapbox-gl-js). It provides GLSL code for projecting longitude/latitude coordinates into 3D space, and JavaScript functions to create view and projection matrices to overlay them onto a map rendered by Mapbox GL. PicoMercator focuses on numerical stability by performing most calculations at 64-bit precision, and switching to an "offset mode" at higher zoom levels (using a technique borrowed from [deck.gl](https://medium.com/vis-gl/how-sometimes-assuming-the-earth-is-flat-helps-speed-up-rendering-in-deck-gl-c43b72fd6db4)).

Basic usage involves rendering to a WebGL canvas overlayed on the Mapbox element, and updating to match the current map view. PicoMercator provides a function `injectMercatorGLSL` to insert functions `pico_mercator_lngLatToWorld`, `pico_mercator_worldToClip`, and `pico_mercator_lngLatToClip` into vertex shader source code so the mercator projection can be done on the GPU. The JavaScript functions `allocateMercatorUniforms` and `updateMercatorUniforms` are provided to initialize and update the values of uniforms used by PicoMercator. The application can then use the values to set program uniforms in whatever way is most appropriate.

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
            // pico_mercator_lngLatToClip function injected by injectMercatorGLSL().
            // pico_mercator_lngLatToWorld and pico_mercator_worldToClip also available to do
            // projection in multiple steps.
            gl_Position = pico_mercator_lngLatToClip(position);
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

    // Use 64-bit precision matrices to avoid numerical instability 
    // in intermediate calculations
    let viewProjectionMatrix = highPrecisionMat4();

    let uniforms = {
        // An application uniform, not used by PicoMercator
        color: new Float32Array(1.0, 0.0, 0.0, 1.0);
    };

    // Uniforms used by PicoMercator are added to the map.
    allocateMercatorUniforms(uniforms);

    map.on("render", (e) => {
        let center = map.getCenter().toArray();
        let zoom = map.getZoom();
        let pitch = map.getPitch();
        let bearing = map.getBearing();

        mapboxViewProjectionMatrix(
            viewProjectionMatrix,
            center,
            zoom,
            pitch,
            bearing,
            canvas.width,
            canvas.height
        );

        // Update the values of PicoMercator uniforms in the map.
        // The application can use these to update program uniforms.
        updateMercatorUniforms(uniforms, center, zoom, viewProjectionMatrix);

        // Draw to canvas
    });

``` 

