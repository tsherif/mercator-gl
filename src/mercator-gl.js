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

// transformMat4 rom gl-matrix https://github.com/toji/gl-matrix/blob/master/src/vec4.js
// Used under MIT licence

const PI = Math.PI;
const PI_4 = PI / 4;
const DEGREES_TO_RADIANS = PI / 180;
const TILE_SIZE = 512;
const EARTH_CIRCUMFERENCE = 40.03e6;

const PROJECTION_GLSL = `
#define MERCATOR_GL_TILE_SIZE 512.0
#define MERCATOR_GL_PI 3.1415926536
#define MERCATOR_GL_WORLD_SCALE (MERCATOR_GL_TILE_SIZE / (MERCATOR_GL_PI * 2.0))
#define MERCATOR_GL_OFFSET_THRESHOLD 4096.0

uniform vec2 mercator_gl_lngLatCenter;
uniform vec3 mercator_gl_angleDerivatives;
uniform float mercator_gl_scale;
uniform vec4 mercator_gl_clipCenter;
uniform mat4 mercator_gl_viewProjectionMatrix;

vec4 mercator_gl_lngLatToWorld(vec3 lngLatElevation, vec2 lngLatPrecision) {
    vec3 mercatorPosition;
    if (mercator_gl_scale < MERCATOR_GL_OFFSET_THRESHOLD) {
        mercatorPosition.xy = vec2(
            (radians(lngLatElevation.x) + MERCATOR_GL_PI) * MERCATOR_GL_WORLD_SCALE,
            (MERCATOR_GL_PI - log(tan(MERCATOR_GL_PI * 0.25 + radians(lngLatElevation.y) * 0.5))) * MERCATOR_GL_WORLD_SCALE
        ) * mercator_gl_scale;
        mercatorPosition.z = lngLatElevation.z;
    } else {
        mercatorPosition.xy = (lngLatElevation.xy - mercator_gl_lngLatCenter) + lngLatPrecision;
        float dy = mercatorPosition.y;
        mercatorPosition = vec3(
            mercatorPosition.x * mercator_gl_angleDerivatives.x,
            -mercatorPosition.y * (mercator_gl_angleDerivatives.y - dy * mercator_gl_angleDerivatives.z),
            lngLatElevation.z
        );
    }

    return vec4(mercatorPosition, 1.0);
}

vec4 mercator_gl_lngLatToWorld(vec3 lngLatElevation) {
    return mercator_gl_lngLatToWorld(lngLatElevation, vec2(0.0));
}

vec4 mercator_gl_lngLatToWorld(vec2 lngLat, vec2 lngLatPrecision) {
    return mercator_gl_lngLatToWorld(vec3(lngLat, 0.0), lngLatPrecision);
}

vec4 mercator_gl_lngLatToWorld(vec2 lngLat) {
    return mercator_gl_lngLatToWorld(vec3(lngLat, 0.0));
}

vec4 mercator_gl_worldToClip(vec4 worldPosition) {
    if (mercator_gl_scale >= MERCATOR_GL_OFFSET_THRESHOLD) {
        worldPosition.w = 0.0;
    }
    vec4 clipPosition = mercator_gl_viewProjectionMatrix * worldPosition;
    if (mercator_gl_scale >= MERCATOR_GL_OFFSET_THRESHOLD) {
        clipPosition += mercator_gl_clipCenter;
    }

    return clipPosition;
}

vec4 mercator_gl_lngLatToClip(vec3 lngLatElevation, vec2 lngLatPrecision) {
    return mercator_gl_worldToClip(mercator_gl_lngLatToWorld(lngLatElevation, lngLatPrecision));
}

vec4 mercator_gl_lngLatToClip(vec3 lngLatElevation) {
    return mercator_gl_lngLatToClip(lngLatElevation, vec2(0.0));
}

vec4 mercator_gl_lngLatToClip(vec2 lngLat, vec2 lngLatPrecision) {
    return mercator_gl_lngLatToClip(vec3(lngLat, 0.0), lngLatPrecision);
}

vec4 mercator_gl_lngLatToClip(vec2 lngLat) {
    return mercator_gl_lngLatToClip(vec3(lngLat, 0.0));
}

`;

// High-precision for intermediate calculations
let tempCenter64 = new Float64Array(4);

// Low-precision for uniforms and to avoid instability
let lngLat32 = new Float32Array(2);

export function highPrecisionLngLat(lngLat, offset = 0, stride = 2) {
    let numElements = Math.ceil((lngLat.length - offset) / stride);
    let precisionData = new Float32Array(numElements * 2);
    for (let i = 0; i < numElements; ++i) {
        let lli = offset + i * stride;
        let pi = i * 2;

        precisionData[pi]     = lngLat[lli]     - Math.fround(lngLat[lli]);
        precisionData[pi + 1] = lngLat[lli + 1] - Math.fround(lngLat[lli + 1]);
    }

    return precisionData;
}

export function injectMercatorGLSL(vsSource) {
    let versionMatch = vsSource.match(/#version \d+(\s+es)?\s*\n/);
    let versionLine = versionMatch ? versionMatch[0] : "";

    return vsSource.replace(versionLine, versionLine + PROJECTION_GLSL);
}

export function allocateMercatorUniforms(uniforms = {}) {
    uniforms.mercator_gl_lngLatCenter = new Float32Array(2);
    uniforms.mercator_gl_angleDerivatives = new Float32Array(3);
    uniforms.mercator_gl_clipCenter = new Float32Array(4);
    uniforms.mercator_gl_viewProjectionMatrix = new Float32Array(16);
    uniforms.mercator_gl_scale = 0;

    return uniforms;
}

export function updateMercatorUniforms(uniforms, lngLat, zoom, viewProjectionMatrix) {
    let longitude = lngLat[0];
    let latitude = lngLat[1];

    uniforms.mercator_gl_scale = Math.pow(2, zoom);

    uniforms.mercator_gl_lngLatCenter[0] = longitude;
    uniforms.mercator_gl_lngLatCenter[1] = latitude;

    let latCosine = Math.cos(latitude * DEGREES_TO_RADIANS);
    let latCosine2 = DEGREES_TO_RADIANS * Math.tan(latitude * DEGREES_TO_RADIANS) / latCosine;
    angleDerivatives(uniforms.mercator_gl_angleDerivatives, latitude, zoom, latCosine, latCosine2);

    lngLat32[0] = longitude;
    lngLat32[1] = latitude;
    lngLatToClip(uniforms.mercator_gl_clipCenter, lngLat32, zoom, viewProjectionMatrix);

    uniforms.mercator_gl_viewProjectionMatrix.set(viewProjectionMatrix);
 
    return uniforms;
}

export function pixelsPerMeter(latitude, zoom, latCosine = Math.cos(latitude * DEGREES_TO_RADIANS)) {
    let scale = Math.pow(2, zoom);
    
    // Number of pixels occupied by one meter around current lat/lon
    return scale * TILE_SIZE / EARTH_CIRCUMFERENCE / latCosine;
}

export function pixelsPerDegree(out, latitude, zoom, latCosine = Math.cos(latitude * DEGREES_TO_RADIANS)) {
    let scale = Math.pow(2, zoom);
    
    // Number of pixels occupied by one degree around current lat/lon
    out[0] = scale * TILE_SIZE / 360;
    out[1] = out[0] / latCosine;

    return out;
}

export function lngLatToWorld(out, lngLat, zoom) {
    let longitude = lngLat[0];
    let latitude = lngLat[1];
    let scale = Math.pow(2, zoom);

    let lambda2 = longitude * DEGREES_TO_RADIANS;
    let phi2 = latitude * DEGREES_TO_RADIANS;
    let x = scale * TILE_SIZE * (lambda2 + PI) / (2 * PI);
    let y = scale * TILE_SIZE * (PI - Math.log(Math.tan(PI_4 + phi2 * 0.5))) / (2 * PI);

    out[0] = x;
    out[1] = y;
    out[2] = 0;
    out[3] = 1;

    return out;
}

export function worldToClip(out, worldPosition, viewProjectionMatrix) {
    transformMat4(out, worldPosition, viewProjectionMatrix);

    return out;
}

export function lngLatToClip(out, lngLat, zoom, viewProjectionMatrix) {
    lngLatToWorld(tempCenter64, lngLat, zoom);
    worldToClip(out, tempCenter64, viewProjectionMatrix);

    return out;
}

function angleDerivatives(out, latitude, zoom, latCosine, latCosine2) {
    pixelsPerDegree(out, latitude, zoom, latCosine);
    out[2] = out[0] * latCosine2 / 2;
}

function transformMat4(out, a, m) {
  let x = a[0];
  let y = a[1];
  let z = a[2];
  let w = a[3];
  out[0] = m[0] * x + m[4] * y + m[8] * z + m[12] * w;
  out[1] = m[1] * x + m[5] * y + m[9] * z + m[13] * w;
  out[2] = m[2] * x + m[6] * y + m[10] * z + m[14] * w;
  out[3] = m[3] * x + m[7] * y + m[11] * z + m[15] * w;
  return out;
}
