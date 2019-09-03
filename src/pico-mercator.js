const PI = Math.PI;
const PI_4 = PI / 4;
const DEGREES_TO_RADIANS = PI / 180;
const TILE_SIZE = 512;
const EARTH_CIRCUMFERENCE = 40.03e6;

export const PicoMercator = {
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
        height,
        pitch,
        bearing,
        center = null,
        scale,
        out
    }) {

        // VIEW MATRIX: PROJECTS MERCATOR WORLD COORDINATES
        // Note that mercator world coordinates typically need to be flipped
        //
        // Note: As usual, matrix operation orders should be read in reverse
        // since vectors will be multiplied from the right during transformation
        mat4.identity(out);

        // Move camera to scaled position along the pitch & bearing direction
        // (1.5 * screen height in pixels at zoom 0)
        mat4.translate(out, out, [0, 0, -1.5 * height / scale]);

        // Rotate by bearing, and then by pitch (which tilts the view)
        mat4.rotateX(out, out, -pitch * DEGREES_TO_RADIANS);
        mat4.rotateZ(out, out, bearing * DEGREES_TO_RADIANS);

        if (center) {
            mat4.translate(out, out, vec3.negate([], center));
        }
    },

    getProjectionMatrix: function({
        width,
        height,
        pitch = 0,
        scale,
        nearZoomZero = height,
        out
    }) {
        const altitude = 1.5 * height;
        const pitchRadians = pitch * DEGREES_TO_RADIANS;
        const halfFov = Math.atan(0.3217505543966422)   // Math.atan(0.5 * height / altitude) => Math.atan(1 / 3)

        const topHalfSurfaceDistance = Math.sin(halfFov) * altitude / Math.sin(Math.PI / 2 - pitchRadians - halfFov);

        // Calculate z value of the farthest fragment that should be rendered (plus an epsilon).
        const fov = 2 * halfFov;
        const aspect = width / height;
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

