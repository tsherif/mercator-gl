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

uniform vec2 PICO_lngLatCenter;
uniform vec2 PICO_pixelsPerDegree;
uniform float PICO_scale;
uniform vec4 PICO_clipCenter;
uniform mat4 PICO_viewProjectionMatrix;

vec4 PICO_lngLatToWorld(vec2 lngLatPosition) {
    vec2 mercatorPosition;
    if (PICO_scale < 2048.0) {
        mercatorPosition = vec2(
            (radians(lngLatPosition.x) + PICO_PI) * PICO_WORLD_SCALE,
            (PICO_PI + log(tan(PICO_PI * 0.25 + radians(lngLatPosition.y) * 0.5))) * PICO_WORLD_SCALE
        );
    } else {
        mercatorPosition = (lngLatPosition - PICO_lngLatCenter) * PICO_pixelsPerDegree;
    }

    return vec4(mercatorPosition, 0.0, 1.0);
}

vec4 PICO_worldToClip(vec4 worldPosition) {
    if (PICO_scale >= 2048.0) {
        worldPosition.w = 0.0;
    }
    vec4 clipPosition = PICO_viewProjectionMatrix * worldPosition;
    if (PICO_scale >= 2048.0) {
        clipPosition += PICO_clipCenter;
    }

    return clipPosition;
}

vec4 PICO_lngLatToClip(vec2 lngLatPosition) {
    return PICO_worldToClip(PICO_lngLatToWorld(lngLatPosition));
}
`;

// High-precision for intermediate calculations
let tempCenter64 = new Float64Array(4);

// Low-precision for uniforms
let tempLngLatCenter32 = new Float32Array(2);
let tempPixelsPerDegree32 = new Float32Array(2);
let tempClipCenter32 = new Float32Array(4);
let tempViewProjectionMatrix32 = new Float32Array(16);

export function PICO_highPrecisionMat4() {
    return mat4.identity(new Float64Array(16));
}

export function PICO_injectGLSLProjection(vsSource) {
    let versionMatch = vsSource.match(/#version \d+(\s+es)?\s*\n/);
    let versionLine = versionMatch ? versionMatch[0] : "";

    return vsSource.replace(versionLine, versionLine + PROJECTION_GLSL);
}

export function PICO_mapboxViewMatrix(out, {
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
    mat4.translate(out, out, [0, 0, -1.5 * canvasHeight]);

    // Rotate by bearing, and then by pitch (which tilts the view)
    mat4.rotateX(out, out, -pitch * DEGREES_TO_RADIANS);
    mat4.rotateZ(out, out, bearing * DEGREES_TO_RADIANS);

    PICO_lngLatToWorld(tempCenter64, longitude, latitude);

    mat4.scale(out, out, [scale, scale, 1]);

    mat4.translate(out, out, vec3.negate(tempCenter64, tempCenter64));

    return out;
}

export function PICO_mapboxProjectionMatrix(out, {
    pitch = 0,
    zoom,
    canvasWidth,
    canvasHeight,
    near = canvasHeight
}) {
    let scale = Math.pow(2, zoom);
    let altitude = 1.5 * canvasHeight;
    let pitchRadians = pitch * DEGREES_TO_RADIANS;
    let halfFov = Math.atan(1 / 3);   // Math.atan(0.5 * canvasHeight / altitude) => Math.atan(1 / 3)

    let topHalfSurfaceDistance = Math.sin(halfFov) * altitude / Math.sin(Math.PI / 2 - pitchRadians - halfFov);

    // Calculate z value of the farthest fragment that should be rendered (plus an epsilon).
    let fov = 2 * halfFov;
    let aspect = canvasWidth / canvasHeight;
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

export function PICO_forEachUniform(longitude, latitude, zoom, viewMatrix, projectionMatrix, fn) {
    tempLngLatCenter32[0] = longitude;
    tempLngLatCenter32[1] = latitude;

    fn("PICO_lngLatCenter", tempLngLatCenter32);

    PICO_pixelsPerDegree(tempPixelsPerDegree32, latitude);

    fn("PICO_pixelsPerDegree", tempPixelsPerDegree32);

    PICO_lngLatToClip(tempClipCenter32, longitude, latitude, viewMatrix, projectionMatrix);

    fn("PICO_clipCenter", tempClipCenter32);

    fn("PICO_scale", Math.pow(2, zoom));

    mat4.multiply(tempViewProjectionMatrix32, projectionMatrix, viewMatrix);

    fn("PICO_viewProjectionMatrix", tempViewProjectionMatrix32);
}

export function PICO_pixelsPerMeter(latitude) {
    /**
    * Number of pixels occupied by one meter around current lat/lon:
    */
    return TILE_SIZE / EARTH_CIRCUMFERENCE / Math.cos(latitude * DEGREES_TO_RADIANS);
}

export function PICO_pixelsPerDegree(out, latitude) {
    out[0] = TILE_SIZE / 360;
    out[1] = out[0] / Math.cos(latitude * DEGREES_TO_RADIANS);

    return out;
}

export function PICO_lngLatToWorld(out, longitude, latitude) {
    let lambda2 = longitude * DEGREES_TO_RADIANS;
    let phi2 = latitude * DEGREES_TO_RADIANS;
    let x = TILE_SIZE * (lambda2 + PI) / (2 * PI);
    let y = TILE_SIZE * (PI + Math.log(Math.tan(PI_4 + phi2 * 0.5))) / (2 * PI);

    out[0] = x;
    out[1] = y;
    out[2] = 0;
    out[3] = 1;

    return out;
}

export function PICO_worldToClip(out, worldPosition, viewMatrix, projectionMatrix) {
    vec4.transformMat4(tempCenter64, worldPosition, viewMatrix);
    vec4.transformMat4(out, tempCenter64, projectionMatrix);

    return out;
}

export function PICO_lngLatToClip(out, longitude, latitude, viewMatrix, projectionMatrix) {
    PICO_lngLatToWorld(tempCenter64, longitude, latitude);
    PICO_worldToClip(out, tempCenter64, viewMatrix, projectionMatrix)

    return out;
}
