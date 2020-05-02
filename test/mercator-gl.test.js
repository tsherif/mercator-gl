import {
    injectMercatorGLSL,
    allocateMercatorUniforms,
    updateMercatorUniforms,
    highPrecisionLngLat,
    pixelsPerMeter,
    pixelsPerDegree,
    lngLatToMercator,
    mercatorToClip,
    lngLatToClip
} from "../../src/mercator-gl.js";

glcheck("GLSL injection", async (t, canvas) => {
    const VS = `
        attribute vec2 position;

        void main() {
            gl_Position = mercator_gl_lngLatToClip(position);
        }
    `.trim();

    const VS_300 = `
        #version 300 es

        in vec2 position;

        void main() {
            gl_Position = mercator_gl_lngLatToClip(position);
        }
    `.trim();

    const gl = canvas.getContext("webgl2");

    let vsSource = injectMercatorGLSL(VS);
    t.notEqual(vsSource.indexOf("mercator_gl_lngLatToMercator"), -1, "Source injected");
    
    let vShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vShader, vsSource);
    gl.compileShader(vShader);
    t.ok(gl.getShaderParameter(vShader, gl.COMPILE_STATUS), "Shader compiled");

    gl.deleteShader(vShader);

    vsSource = injectMercatorGLSL(VS_300);
    t.notEqual(vsSource.indexOf("mercator_gl_lngLatToMercator"), -1, "Source injected");
    
    vShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vShader, vsSource);
    gl.compileShader(vShader);
    t.ok(gl.getShaderParameter(vShader, gl.COMPILE_STATUS), "Shader compiled");

    gl.deleteShader(vShader); 

    t.done();
});

glcheck("Uniforms", async (t) => {
    let uniforms = allocateMercatorUniforms();
    t.ok("mercator_gl_lngLatCenter" in uniforms, "mercator_gl_lngLatCenter allocated");
    t.ok("mercator_gl_angleDerivatives" in uniforms, "mercator_gl_angleDerivatives allocated");
    t.ok("mercator_gl_clipCenter" in uniforms, "mercator_gl_clipCenter allocated");
    t.ok("mercator_gl_viewProjectionMatrix" in uniforms, "mercator_gl_viewProjectionMatrix allocated");
    t.ok("mercator_gl_scale" in uniforms, "mercator_gl_scale allocated");

    uniforms = allocateMercatorUniforms({testUniform: true});
    t.ok("mercator_gl_lngLatCenter" in uniforms, "mercator_gl_lngLatCenter allocated");
    t.ok("mercator_gl_angleDerivatives" in uniforms, "mercator_gl_angleDerivatives allocated");
    t.ok("mercator_gl_clipCenter" in uniforms, "mercator_gl_clipCenter allocated");
    t.ok("mercator_gl_viewProjectionMatrix" in uniforms, "mercator_gl_viewProjectionMatrix allocated");
    t.ok("mercator_gl_scale" in uniforms, "mercator_gl_scale allocated");    
    t.ok("testUniform" in uniforms, "testUniform allocated");

    updateMercatorUniforms(uniforms, [50, 50], 10, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    t.ok("mercator_gl_lngLatCenter" in uniforms, "mercator_gl_lngLatCenter allocated with external uniform");
    t.ok("mercator_gl_angleDerivatives" in uniforms, "mercator_gl_angleDerivatives allocated with external uniform");
    t.ok("mercator_gl_clipCenter" in uniforms, "mercator_gl_clipCenter allocated with external uniform");
    t.ok("mercator_gl_viewProjectionMatrix" in uniforms, "mercator_gl_viewProjectionMatrix allocated with external uniform");
    t.ok("mercator_gl_scale" in uniforms, "mercator_gl_scale allocated with external uniform");    
    t.ok("testUniform" in uniforms, "external uniform added");

    t.ok(numericalArray(uniforms.mercator_gl_lngLatCenter), "mercator_gl_lngLatCenter update valid");
    t.ok(numericalArray(uniforms.mercator_gl_angleDerivatives), "mercator_gl_angleDerivatives update valid");
    t.ok(numericalArray(uniforms.mercator_gl_clipCenter), "mercator_gl_clipCenter update valid");
    t.ok(numericalArray(uniforms.mercator_gl_viewProjectionMatrix), "mercator_gl_viewProjectionMatrix update valid");
    t.ok(Number.isFinite(uniforms.mercator_gl_scale), "mercator_gl_scale update valid");
    t.equal(uniforms.testUniform, true, "external uniform unmodified");

    t.done();
});

glcheck("Unit conversions", async (t) => {
    t.ok(Number.isFinite(pixelsPerMeter(50, 10)), "pixelsPerMeter valid value");
    t.ok(numericalArray(pixelsPerDegree([0, 0], 50, 10)), "pixelsPerMeter valid value");

    t.done();
});

glcheck("Coordinate transforms", async (t) => {
    const projectionMatrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

    t.ok(numericalArray(lngLatToMercator([0, 0, 0, 0], [50, 50], 10)), "lngLatToMercator valid value");
    t.ok(numericalArray(mercatorToClip([0, 0, 0, 0], [256, 256, 0, 1], projectionMatrix)), "mercatorToClip valid value");
    t.ok(numericalArray(lngLatToClip([0, 0, 0, 0], [50, 50], 10, projectionMatrix)), "lngLatToClip valid value");

    t.done();
});

function numericalArray(array) {
    for (let i = 0; i < array.length; ++i) {
        if (!Number.isFinite(array[i])) {
            return false;
        }
    }

    return true;
}
