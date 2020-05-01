/**
    @module GLSL
*/

/**
    Project a longitude/latitude/elevation coordinate into mercator space.

    @function mercator_gl_lngLatToMercator
    @param {vec3} lngLatElevation Longitude/latitude/meter elevation coordinate.
    @param {vec2} lngLatPrecision "Low part" of 64-bit longitude/latitude coordinates.
    @return {vec4} Homegeneous representation of mercator position.
*/

/**
    Project a longitude/latitude/elevation coordinate into mercator space without
    enhanced precition. Equivalent to <code>mercator_gl_lngLatToMercator(lngLatElevation, vec2(0.0))</code>.

    @function mercator_gl_lngLatToMercator
    @param {vec3} lngLatElevation Longitude/latitude/meter elevation coordinate.
    @return {vec4} Homegeneous representation of mercator position.
*/

/**
    Project a longitude/latitude coordinate into mercator space. Equivalent
    to <code>mercator_gl_lngLatToMercator(vec3(lngLat, 0.0), lngLatPrecision)</code>.

    @function mercator_gl_lngLatToMercator
    @param {vec2} lngLat Longitude/latitude coordinate.
    @param {vec2} lngLatPrecision "Low part" of 64-bit longitude/latitude coordinates.
    @return {vec4} Homegeneous representation of mercator position.
*/

/**
    Project a longitude/latitude coordinate into mercator space without
    enhanced precition. Equivalent to <code>mercator_gl_lngLatToMercator(vec3(lngLat, 0.0), vec2(0.0))</code>.

    @function mercator_gl_lngLatToMercator
    @param {vec2} lngLat Longitude/latitude coordinate.
    @return {vec4} Homegeneous representation of mercator position.
*/

/**
    Project a longitude/latitude coordinate into mercator space without
    enhanced precition. Equivalent to <code>mercator_gl_lngLatToMercator(vec3(lngLat, 0.0), vec2(0.0))</code>.

    @function mercator_gl_lngLatToMercator
    @param {vec2} lngLat Longitude/latitude coordinate.
    @return {vec4} Homegeneous representation of mercator position.
*/

/**
    Project a homegeneous 4d mercator coordinate to clip space.

    @function mercator_gl_mercatorToClip
    @param {vec4} mercatorPosition x/y/<meter elevation/1 homegeneous mercator coordinate.
    @return {vec4} Clip space coordinate (can be passed to <code>gl_Position</code>).
*/

/**
    Project a longitude/latitude/elevation coordinate into clip space.

    @function mercator_gl_lngLatToClip
    @param {vec3} lngLatElevation Longitude/latitude/meter elevation coordinate.
    @param {vec2} lngLatPrecision "Low part" of 64-bit longitude/latitude coordinates.
    @return {vec4} Clip space coordinate (can be passed to <code>gl_Position</code>).
*/

/**
    Project a longitude/latitude/elevation coordinate into clip space without
    enhanced precition. Equivalent to <code>mercator_gl_lngLatToClip(lngLatElevation, vec2(0.0))</code>.

    @function mercator_gl_lngLatToClip
    @param {vec3} lngLatElevation Longitude/latitude/meter elevation coordinate.
    @return {vec4} Clip space coordinate (can be passed to <code>gl_Position</code>).
*/

/**
    Project a longitude/latitude coordinate into clip space. Equivalent
    to <code>mercator_gl_lngLatToClip(vec3(lngLat, 0.0), lngLatPrecision)</code>.

    @function mercator_gl_lngLatToClip
    @param {vec2} lngLat Longitude/latitude coordinate.
    @param {vec2} lngLatPrecision "Low part" of 64-bit longitude/latitude coordinates.
    @return {vec4} Clip space coordinate (can be passed to <code>gl_Position</code>).
*/

/**
    Project a longitude/latitude coordinate into clip space without
    enhanced precition. Equivalent to <code>mercator_gl_lngLatToClip(vec3(lngLat, 0.0), vec2(0.0))</code>.

    @function mercator_gl_lngLatToClip
    @param {vec2} lngLat Longitude/latitude coordinate.
    @return {vec4} Clip space coordinate (can be passed to <code>gl_Position</code>).
*/

/**
    Project a longitude/latitude coordinate into clip space without
    enhanced precition. Equivalent to <code>mercator_gl_lngLatToClip(vec3(lngLat, 0.0), vec2(0.0))</code>.

    @function mercator_gl_lngLatToClip
    @param {vec2} lngLat Longitude/latitude coordinate.
    @return {vec4} Clip space coordinate (can be passed to <code>gl_Position</code>).
*/

export const PROJECTION_GLSL = `
#define MERCATOR_GL_TILE_SIZE 512.0
#define MERCATOR_GL_PI 3.1415926536
#define MERCATOR_GL_TILE_SCALE (MERCATOR_GL_TILE_SIZE / (MERCATOR_GL_PI * 2.0))
#define MERCATOR_GL_OFFSET_THRESHOLD 4096.0

uniform vec2 mercator_gl_lngLatCenter;
uniform vec3 mercator_gl_angleDerivatives;
uniform float mercator_gl_scale;
uniform vec4 mercator_gl_clipCenter;
uniform mat4 mercator_gl_viewProjectionMatrix;

vec4 mercator_gl_lngLatToMercator(vec3 lngLatElevation, vec2 lngLatPrecision) {
    vec3 mercatorPosition;
    if (mercator_gl_scale < MERCATOR_GL_OFFSET_THRESHOLD) {
        mercatorPosition.xy = vec2(
            (radians(lngLatElevation.x) + MERCATOR_GL_PI) * MERCATOR_GL_TILE_SCALE,
            (MERCATOR_GL_PI - log(tan(MERCATOR_GL_PI * 0.25 + radians(lngLatElevation.y) * 0.5))) * MERCATOR_GL_TILE_SCALE
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

vec4 mercator_gl_lngLatToMercator(vec3 lngLatElevation) {
    return mercator_gl_lngLatToMercator(lngLatElevation, vec2(0.0));
}

vec4 mercator_gl_lngLatToMercator(vec2 lngLat, vec2 lngLatPrecision) {
    return mercator_gl_lngLatToMercator(vec3(lngLat, 0.0), lngLatPrecision);
}

vec4 mercator_gl_lngLatToMercator(vec2 lngLat) {
    return mercator_gl_lngLatToMercator(vec3(lngLat, 0.0));
}

vec4 mercator_gl_mercatorToClip(vec4 mercatorPosition) {
    if (mercator_gl_scale >= MERCATOR_GL_OFFSET_THRESHOLD) {
        mercatorPosition.w = 0.0;
    }
    vec4 clipPosition = mercator_gl_viewProjectionMatrix * mercatorPosition;
    if (mercator_gl_scale >= MERCATOR_GL_OFFSET_THRESHOLD) {
        clipPosition += mercator_gl_clipCenter;
    }

    return clipPosition;
}

vec4 mercator_gl_lngLatToClip(vec3 lngLatElevation, vec2 lngLatPrecision) {
    return mercator_gl_mercatorToClip(mercator_gl_lngLatToMercator(lngLatElevation, lngLatPrecision));
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
