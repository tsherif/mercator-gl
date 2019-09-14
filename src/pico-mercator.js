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

import {mat4, vec4, vec3} from "gl-matrix";

export {mat4} from "gl-matrix";

const PI = Math.PI;
const PI_4 = PI / 4;
const DEGREES_TO_RADIANS = PI / 180;
const TILE_SIZE = 512;
const EARTH_CIRCUMFERENCE = 40.03e6;

const PROJECTION_GLSL = `
const float PICO_MERCATOR_TILE_SIZE = 512.0;
const float PICO_MERCATOR_PI = 3.1415926536;
const float PICO_MERCATOR_WORLD_SCALE = PICO_MERCATOR_TILE_SIZE / (PICO_MERCATOR_PI * 2.0);

uniform vec2 pico_mercator_lngLatCenter;
uniform vec3 pico_mercator_angleDerivatives;
uniform vec2 pico_mercator_meterDerivatives;
uniform float pico_mercator_scale;
uniform vec4 pico_mercator_clipCenter;
uniform mat4 pico_mercator_viewProjectionMatrix;

vec4 pico_mercator_lngLatToWorld(vec2 lngLat, vec2 lngLatPrecision) {
    vec2 mercatorPosition;
    if (pico_mercator_scale < 2048.0) {
        mercatorPosition = vec2(
            (radians(lngLat.x) + PICO_MERCATOR_PI) * PICO_MERCATOR_WORLD_SCALE,
            (PICO_MERCATOR_PI + log(tan(PICO_MERCATOR_PI * 0.25 + radians(lngLat.y) * 0.5))) * PICO_MERCATOR_WORLD_SCALE
        ) * pico_mercator_scale;
    } else {
        mercatorPosition = (lngLat.xy - pico_mercator_lngLatCenter) + lngLatPrecision;
        mercatorPosition = vec2(
            mercatorPosition.x * pico_mercator_angleDerivatives.x,
            mercatorPosition.y * (pico_mercator_angleDerivatives.y + mercatorPosition.y * pico_mercator_angleDerivatives.z)
        );
    }

    return vec4(mercatorPosition, 0.0, 1.0);
}

vec4 pico_mercator_lngLatToWorld(vec2 lngLat) {
    return pico_mercator_lngLatToWorld(lngLat, vec2(0.0));
}


vec4 pico_mercator_worldToClip(vec4 worldPosition) {
    if (pico_mercator_scale >= 2048.0) {
        worldPosition.w = 0.0;
    }
    vec4 clipPosition = pico_mercator_viewProjectionMatrix * worldPosition;
    if (pico_mercator_scale >= 2048.0) {
        clipPosition += pico_mercator_clipCenter;
    }

    return clipPosition;
}

vec4 pico_mercator_lngLatToClip(vec2 lngLat, vec2 lngLatPrecision) {
    return pico_mercator_worldToClip(pico_mercator_lngLatToWorld(lngLat, lngLatPrecision));
}

vec4 pico_mercator_lngLatToClip(vec2 lngLat) {
    return pico_mercator_lngLatToClip(lngLat, vec2(0.0));
}

`;

// High-precision for intermediate calculations
let tempCenter64 = new Float64Array(4);
let tempViewTranslation64 = new Float64Array(3);
let tempViewMatrix = new Float64Array(16);
let tempProjectionMatrix = new Float64Array(16);

// Low-precision for uniforms and to avoid instability
let uniforms = {
    pico_mercator_lngLatCenter: new Float32Array(2),
    pico_mercator_angleDerivatives: new Float32Array(3),
    pico_mercator_meterDerivatives: new Float32Array(2),
    pico_mercator_clipCenter: new Float32Array(4),
    pico_mercator_viewProjectionMatrix: new Float32Array(16),
    pico_mercator_scale: 0
};

let lngLat32 = new Float32Array(2);

export function pico_mercator_highPrecisionMat4() {
    return mat4.identity(new Float64Array(16));
}

export function pico_mercator_highPrecisionLngLat(lngLat, stride = 2) {
    let numElements = lngLat.length / stride;
    let precisionData = new Float32Array(numElements * 2);
    for (let i = 0; i < numElements; ++i) {
        let lli = i * stride;
        let pi = i * 2;

        precisionData[pi]     = lngLat[lli]     - Math.fround(lngLat[lli]);
        precisionData[pi + 1] = lngLat[lli + 1] - Math.fround(lngLat[lli + 1]);
    }

    return precisionData;
}

export function pico_mercator_injectGLSLProjection(vsSource) {
    let versionMatch = vsSource.match(/#version \d+(\s+es)?\s*\n/);
    let versionLine = versionMatch ? versionMatch[0] : "";

    return vsSource.replace(versionLine, versionLine + PROJECTION_GLSL);
}


export function pico_mercator_uniforms(lngLat, zoom, viewProjectionMatrix, fn) {
    let longitude = lngLat[0];
    let latitude = lngLat[1];

    uniforms.pico_mercator_scale = Math.pow(2, zoom);

    uniforms.pico_mercator_lngLatCenter[0] = longitude;
    uniforms.pico_mercator_lngLatCenter[1] = latitude;

    let latCosine = Math.cos(latitude * DEGREES_TO_RADIANS);
    let latCosine2 = DEGREES_TO_RADIANS * Math.tan(latitude * DEGREES_TO_RADIANS) / latCosine;
    angleDerivatives(uniforms.pico_mercator_angleDerivatives, latitude, zoom, latCosine, latCosine2);
    meterDerivatives(uniforms.pico_mercator_meterDerivatives, latitude, zoom, latCosine, latCosine2);

    lngLat32[0] = longitude;
    lngLat32[1] = latitude;
    pico_mercator_lngLatToClip(uniforms.pico_mercator_clipCenter, lngLat32, zoom, viewProjectionMatrix);

    uniforms.pico_mercator_viewProjectionMatrix.set(viewProjectionMatrix);

    fn(uniforms);
}

export function pico_mercator_mapboxViewMatrix(out, lngLat, zoom, pitch, bearing, canvasHeight) {
    mat4.identity(out);

    // Camera translation (from view center)
    tempViewTranslation64[2] = -1.5 * canvasHeight;
    mat4.translate(out, out, tempViewTranslation64);

    // Camera rotation
    mat4.rotateX(out, out, -pitch * DEGREES_TO_RADIANS);
    mat4.rotateZ(out, out, bearing * DEGREES_TO_RADIANS);

    // Translation to view center
    pico_mercator_lngLatToWorld(tempCenter64, lngLat, zoom);
    mat4.translate(out, out, vec3.negate(tempCenter64, tempCenter64));

    return out;
}

export function pico_mercator_mapboxProjectionMatrix(out, pitch, canvasWidth, canvasHeight) {
    let altitude = 1.5 * canvasHeight;
    let pitchRadians = pitch * DEGREES_TO_RADIANS;
    let halfFov = Math.atan(1 / 3);   // Math.atan(0.5 * canvasHeight / altitude) => Math.atan(1 / 3)

    let topHalfSurfaceDistance = Math.sin(halfFov) * altitude / Math.sin(Math.PI / 2 - pitchRadians - halfFov);

    // Calculate z value of the farthest fragment that should be rendered (plus an epsilon).
    let fov = 2 * halfFov;
    let aspect = canvasWidth / canvasHeight;
    let near = 0.1 * altitude;
    let far = (Math.cos(Math.PI / 2 - pitchRadians) * topHalfSurfaceDistance + altitude) * 1.01;

    mat4.perspective(
        out,
        fov,      // fov in radians
        aspect,   // aspect ratio
        near,     // near plane
        far       // far plane
    );

    return out;
}

export function pico_mercator_mapboxViewProjectionMatrix(out, lngLat, zoom, pitch, bearing, canvasWidth, canvasHeight) {
    pico_mercator_mapboxViewMatrix(tempViewMatrix, lngLat, zoom, pitch, bearing, canvasHeight);
    pico_mercator_mapboxProjectionMatrix(tempProjectionMatrix, pitch, canvasWidth, canvasHeight);

    mat4.multiply(out, tempProjectionMatrix, tempViewMatrix);

    return out;
}

export function pico_mercator_pixelsPerMeter(latitude, zoom, latCosine = Math.cos(latitude * DEGREES_TO_RADIANS)) {
    let scale = Math.pow(2, zoom);
    
    // Number of pixels occupied by one meter around current lat/lon
    return scale * TILE_SIZE / EARTH_CIRCUMFERENCE / latCosine;
}

export function pico_mercator_pixelsPerDegree(out, latitude, zoom, latCosine = Math.cos(latitude * DEGREES_TO_RADIANS)) {
    let scale = Math.pow(2, zoom);
    
    // Number of pixels occupied by one degree around current lat/lon
    out[0] = scale * TILE_SIZE / 360;
    out[1] = out[0] / latCosine;

    return out;
}

export function pico_mercator_lngLatToWorld(out, lngLat, zoom) {
    let longitude = lngLat[0];
    let latitude = lngLat[1];
    let scale = Math.pow(2, zoom);

    let lambda2 = longitude * DEGREES_TO_RADIANS;
    let phi2 = latitude * DEGREES_TO_RADIANS;
    let x = scale * TILE_SIZE * (lambda2 + PI) / (2 * PI);
    let y = scale * TILE_SIZE * (PI + Math.log(Math.tan(PI_4 + phi2 * 0.5))) / (2 * PI);

    out[0] = x;
    out[1] = y;
    out[2] = 0;
    out[3] = 1;

    return out;
}

export function pico_mercator_worldToClip(out, worldPosition, viewProjectionMatrix) {
    vec4.transformMat4(out, worldPosition, viewProjectionMatrix);

    return out;
}

export function pico_mercator_lngLatToClip(out, lngLat, zoom, viewProjectionMatrix) {
    pico_mercator_lngLatToWorld(tempCenter64, lngLat, zoom);
    pico_mercator_worldToClip(out, tempCenter64, viewProjectionMatrix);

    return out;
}


function angleDerivatives(out, latitude, zoom, latCosine, latCosine2) {
    pico_mercator_pixelsPerDegree(out, latitude, zoom, latCosine);
    out[2] = out[0] * latCosine2 / 2;
}

function meterDerivatives(out, latitude, zoom, latCosine, latCosine2) {
    let scale = Math.pow(2, zoom);

    out[0] = pico_mercator_pixelsPerMeter(latitude, zoom, latCosine);
    out[1] = scale * TILE_SIZE / EARTH_CIRCUMFERENCE * latCosine2;

    return out;
}
