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

uniform vec2 PICO_lnglatCenter;
uniform vec2 PICO_pixelsPerDegree;
uniform float PICO_scale;
uniform vec4 PICO_clipCenter;

vec4 PICO_lngLatToWorld(vec2 position) {
    vec2 mercatorPosition;
    if (PICO_scale < 2048.0) {
        mercatorPosition = vec2(
            (radians(position.x) + PICO_PI) * PICO_WORLD_SCALE,
            (PICO_PI + log(tan(PICO_PI * 0.25 + radians(position.y) * 0.5))) * PICO_WORLD_SCALE
        );
    } else {
        mercatorPosition = (position - PICO_lnglatCenter) * PICO_pixelsPerDegree;
    }

    return vec4(mercatorPosition, 0.0, 1.0);
}

vec4 PICO_worldToClip(mat4 viewProjectionMatrix, vec4 worldPosition) {
    if (PICO_scale >= 2048.0) {
        worldPosition.w = 0.0;
    }
    vec4 clipPosition = viewProjectionMatrix * worldPosition;
    if (PICO_scale >= 2048.0) {
        clipPosition += PICO_clipCenter;
    }

    return clipPosition;
}
`;

let tempCenter = new Float64Array(4);
let tempLngLatCenter = new Float32Array(2);
let tempPixelsPerDegree = new Float32Array(2);
let tempClipCenter = new Float32Array(4);

export const PicoMercator = {
    injectGLSLProjection: function(vsSource) {
        let versionMatch = vsSource.match(/#version \d+(\s+es)?\s*\n/);
        let versionLine = versionMatch ? versionMatch[0] : "";

        return vsSource.replace(versionLine, versionLine + PROJECTION_GLSL);
    },

    viewMatrix: function(out, {
        longitude,
        latitude,
        zoom,
        pitch,
        bearing,
        canvasHeight,
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

        this.lngLatToWorld(tempCenter, longitude, latitude);

        mat4.translate(out, out, vec3.negate(tempCenter, tempCenter));

        return out;
    },

    projectionMatrix: function(out, {
        canvasWidth,
        canvasHeight,
        pitch = 0,
        zoom,
        nearZoomZero = canvasHeight,
    }) {
        let scale = Math.pow(2, zoom);
        const altitude = 1.5 * canvasHeight;
        const pitchRadians = pitch * DEGREES_TO_RADIANS;
        const halfFov = Math.atan(1 / 3);   // Math.atan(0.5 * canvasHeight / altitude) => Math.atan(1 / 3)

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

        return out;
    },

    forEachUniform(longitude, latitude, zoom, viewProjectionMatrix, fn) {
        tempLngLatCenter[0] = longitude;
        tempLngLatCenter[1] = latitude;

        fn("PICO_lnglatCenter", tempLngLatCenter);

        this.pixelsPerDegree(tempPixelsPerDegree, latitude);

        fn("PICO_pixelsPerDegree", tempPixelsPerDegree);

        this.lngLatToWorld(tempCenter, longitude, latitude);
        transformMat4(tempClipCenter, tempCenter, viewProjectionMatrix);

        fn("PICO_clipCenter", tempClipCenter);

        fn("PICO_scale", Math.pow(2, zoom));
    },

    pixelsPerMeter: function(latitude) {
      const latCosine = Math.cos(latitude * DEGREES_TO_RADIANS);

      /**
       * Number of pixels occupied by one meter around current lat/lon:
       */
       return TILE_SIZE / EARTH_CIRCUMFERENCE / latCosine;
    },

    pixelsPerDegree: function(out, latitude) {
      const latCosine = Math.cos(latitude * DEGREES_TO_RADIANS);

      out[0] = TILE_SIZE / 360;
      out[1] = out[0] / latCosine;

      return out;
    },

    lngLatToWorld: function(out, longitude, latitude) {
        const lambda2 = longitude * DEGREES_TO_RADIANS;
        const phi2 = latitude * DEGREES_TO_RADIANS;
        const x = TILE_SIZE * (lambda2 + PI) / (2 * PI);
        const y = TILE_SIZE * (PI + Math.log(Math.tan(PI_4 + phi2 * 0.5))) / (2 * PI);

        out[0] = x;
        out[1] = y;
        out[2] = 0;
        out[3] = 1;

        return out;
    },

    lngLatToClip(out, longitude, latitude, viewProjMatrix) {
        let worldCenter = this.lngLatToWorld(tempCenter, longitude, latitude);
        transformMat4(out, worldCenter, viewProjMatrix);

        return out;
    }
};

// From gl-matrix
function transformMat4(out, a, m) {
  let x = a[0], y = a[1], z = a[2], w = a[3];
  out[0] = m[0] * x + m[4] * y + m[8] * z + m[12] * w;
  out[1] = m[1] * x + m[5] * y + m[9] * z + m[13] * w;
  out[2] = m[2] * x + m[6] * y + m[10] * z + m[14] * w;
  out[3] = m[3] * x + m[7] * y + m[11] * z + m[15] * w;
  return out;
}
