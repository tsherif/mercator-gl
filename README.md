PicoMercator
============

PicoMercator is a minimal library for doing web mercator projections in WebGL in a manner compatible with [Mapbox GL](https://github.com/mapbox/mapbox-gl-js). It provides GLSL code for projecting longitude/latitude coordinates into 3D space,
and JavaScript functions to create view and projection matrices to overlay them onto a map rendered by Mapbox GL.

Basic usage involves rendering to a WebGL canvas overlayed on the Mapbox element, and updating to match the view to the current map. PicoMercator provides a function `injectGLSLProjection` to insert a function `PICO_project_mercator` into vertex shader source code so the mercator projection can be done on the GPU.

```JavaScript

    let map = new mapboxgl.Map({
        container: mapboxContainer,
        style: "mapbox://styles/mapbox/streets-v9",
        center: [30.48688963987, 50.44638775297],
        zoom: 15
    });

    let vs = `
        #version 300 es
        layout(location=0) in vec4 position;
        uniform mat4 viewMatrix;        
        uniform mat4 projectionMatrix;        
        void main() {
            // PICO_project_mercator function injected by injectGLSLProjection()
            gl_Position = projectionMatrix * viewMatrix * PICO_project_mercator(position);
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
    let vertexShaderSource =  PicoMercator.injectGLSLProjection(vs);
    let fragmentShaderSource =  fs;
    // Create WebGL program from vertexShaderSource and fragmentShaderSource

    let viewMatrix = new Float32Array(16);
    let projectionMatrix = new Float32Array(16);

    map.on("render", (e) => {
        let {longitude, latitude} = map.getCenter();
        let zoom = map.getZoom();
        let pitch = map.getPitch();
        let bearing = map.getBearing();


        PicoMercator.getViewMatrix({
            longitude,
            latitude,
            zoom,
            pitch,
            bearing,
            canvasHeight: canvas.height,
            out: viewMatrix
        });

        PicoMercator.getProjectionMatrix({
            zoom,
            pitch,
            canvasWidth: canvas.width,
            canvasHeight: canvas.height,
            out: projectionMatrix
        });

        // Draw to canvas
    });

``` 

