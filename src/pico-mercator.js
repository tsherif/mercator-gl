///////////////////////////////////////////////////////////////////////////////////
// The MIT License (MIT)
//
// Copyright (c) 2019 Tarek Sherif
//
// Permission is hereby granted, free of charge, to any person obtaining a copy of
// this software and associated documentation files (the "Software"), to deal in
// the Software without restriction, including without limitation the rights to
// use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
// the Software, and to permit persons to whom the Software is furnished to do so,
// subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
// FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
// COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
// IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
// CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
///////////////////////////////////////////////////////////////////////////////////

// GLSL projection code from deck.gl https://github.com/uber/deck.gl
// Used under MIT licence
//
// JavaScript projection functions from view-mercator-project https://github.com/uber-common/viewport-mercator-project
// Used under MIT license

const PI = Math.PI;
const PI_4 = PI / 4;
const DEGREES_TO_RADIANS = PI / 180;
const TILE_SIZE = 512;
const EARTH_CIRCUMFERENCE = 40.03e6;

const PROJECTION_GLSL = `
const float PICO_TILE_SIZE = 512.0;
const float PICO_PI = 3.1415926536;
const float PICO_WORLD_SCALE = PICO_TILE_SIZE / (PICO_PI * 2.0);

vec4 PICO_project_mercator(vec4 position) {
    return vec4(
        (radians(position.x) + PICO_PI) * PICO_WORLD_SCALE, 
        (PICO_PI + log(tan(PICO_PI * 0.25 + radians(position.y) * 0.5))) * PICO_WORLD_SCALE, 
        position.z,
        position.w
    );
}
`;

let tempCenter = new Float32Array(3);

export const PicoMercator = {
    injectGLSLProjection: function(vsSource) {
        let versionMatch = vsSource.match(/#version \d+(\s+es)?\s*\n/);
        let versionLine = versionMatch ? versionMatch[0] : "";

        return vsSource.replace(versionLine, versionLine + PROJECTION_GLSL);
    },

    lngLatToWorld: function(lng, lat, out) {
        const lambda2 = lng * DEGREES_TO_RADIANS;
        const phi2 = lat * DEGREES_TO_RADIANS;
        const x = TILE_SIZE * (lambda2 + PI) / (2 * PI);
        const y = TILE_SIZE * (PI + Math.log(Math.tan(PI_4 + phi2 * 0.5))) / (2 * PI);
        
        out[0] = x;
        out[1] = y;
        out[2] = 0;

        return out;
    },

    getViewMatrix: function({
        longitude,
        latitude,
        zoom,
        pitch,
        bearing,
        canvasHeight,
        out
    }) {
        let scale = Math.pow(2, zoom);
        // VIEW MATRIX: PROJECTS MERCATOR WORLD COORDINATES
        // Note that mercator world coordinates typically need to be flipped
        //
        // Note: As usual, matrix operation orders should be read in reverse
        // since vectors will be multiplied from the right during transformation
        mat4.identity(out);

        // Move camera to scaled position along the pitch & bearing direction
        // (1.5 * screen canvasHeight in pixels at zoom 0)
        mat4.translate(out, out, [0, 0, -1.5 * canvasHeight / scale]);

        // Rotate by bearing, and then by pitch (which tilts the view)
        mat4.rotateX(out, out, -pitch * DEGREES_TO_RADIANS);
        mat4.rotateZ(out, out, bearing * DEGREES_TO_RADIANS);

        this.lngLatToWorld(longitude, latitude, tempCenter);

        mat4.translate(out, out, vec3.negate(tempCenter, tempCenter));
    },

    getProjectionMatrix: function({
        canvasWidth,
        canvasHeight,
        pitch = 0,
        zoom,
        nearZoomZero = canvasHeight,
        out
    }) {
        let scale = Math.pow(2, zoom);
        const altitude = 1.5 * canvasHeight;
        const pitchRadians = pitch * DEGREES_TO_RADIANS;
        const halfFov = Math.atan(0.3217505543966422)   // Math.atan(0.5 * canvasHeight / altitude) => Math.atan(1 / 3)

        const topHalfSurfaceDistance = Math.sin(halfFov) * altitude / Math.sin(Math.PI / 2 - pitchRadians - halfFov);

        // Calculate z value of the farthest fragment that should be rendered (plus an epsilon).
        const fov = 2 * halfFov;
        const aspect = canvasWidth / canvasHeight;
        const near = nearZoomZero / scale;
        const far = (Math.cos(Math.PI / 2 - pitchRadians) * topHalfSurfaceDistance + altitude) * 1.01;

        mat4.perspective(
            out,
            fov,      // fov in radians
            aspect,   // aspect ratio
            near,     // near plane
            far       // far plane
        );
    },

    getPixelsPerMeter: function(latitude, longitude) {
      const latCosine = Math.cos(latitude * DEGREES_TO_RADIANS);

      /**
       * Number of pixels occupied by one meter around current lat/lon:
       */
       return TILE_SIZE / EARTH_CIRCUMFERENCE / latCosine;
    }  
}

