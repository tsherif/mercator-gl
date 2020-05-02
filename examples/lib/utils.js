(function() {
    const EARTH_RADIUS = 6378000;

    const NUM_TIMING_SAMPLES = 60;

    let cpuTimeSum = 0;
    let gpuTimeSum = 0;
    let timeSampleCount = NUM_TIMING_SAMPLES - 1;

    let randS = 1;
    let randC = 1;
    let frame = 0;

    window.utils = {
        random() {
            randS = Math.sin(randC * 18.42);
            randC = Math.cos(randS * 984.21);
            let n = Math.abs(randS * randC) * 4532.3454;
            return n - Math.floor(n);
        },
        
        addTimerElement() {
            this.timerDiv = document.createElement("div")
            this.timerDiv.id = "timer";
            this.cpuTimeElement = document.createElement("div");
            this.gpuTimeElement = document.createElement("div");
            this.timerDiv.appendChild(this.cpuTimeElement);
            this.timerDiv.appendChild(this.gpuTimeElement);
            document.body.appendChild(this.timerDiv);
        },

        updateTimerElement(cpuTime, gpuTime) {
            cpuTimeSum += cpuTime;
            gpuTimeSum += gpuTime;
            ++timeSampleCount;

            if (timeSampleCount === NUM_TIMING_SAMPLES) {
                let cpuTimeAve = cpuTimeSum / NUM_TIMING_SAMPLES;
                let gpuTimeAve = gpuTimeSum / NUM_TIMING_SAMPLES;
                this.cpuTimeElement.innerText = "CPU time: " + cpuTimeAve.toFixed(3) + "ms";
                if (gpuTimeAve > 0) {
                    this.gpuTimeElement.innerText = "GPU time: " + gpuTimeAve.toFixed(3) + "ms";
                } else {
                    this.gpuTimeElement.innerText = "GPU time: (Unavailable)";
                }

                cpuTimeSum = 0;
                gpuTimeSum = 0;
                timeSampleCount = 0;
            }
        },

        // From deck.gl: https://github.com/uber/deck.gl/blob/master/modules/layers/src/column-layer/column-geometry.js
        // Used under MIT license
        createColumn(radius = 1, height = 1, nradial = 10) {
          const vertsAroundEdge = nradial + 1; // loop
          const numVertices = vertsAroundEdge * 3; // top, side top edge, side bottom edge

          const stepAngle = (Math.PI * 2) / nradial;

          const positions = new Float32Array(numVertices * 3);
          const normals = new Float32Array(numVertices * 3);

          let i = 0;

          // side tesselation: 0, 1, 2, 3, 4, 5, ...
          //
          // 0 - 2 - 4  ... top
          // | / | / |
          // 1 - 3 - 5  ... bottom
          //
          for (let j = 0; j < vertsAroundEdge; j++) {
            const a = j * stepAngle;
            const sin = Math.sin(a);
            const cos = Math.cos(a);

            for (let k = 0; k < 2; k++) {
              positions[i + 0] = cos * radius;
              positions[i + 1] = sin * radius;
              positions[i + 2] = (1 / 2 - k) * height;

              normals[i]     = cos;
              normals[i + 1] = sin;

              i += 3;
            }
          }

          // top tesselation: 0, -1, 1, -2, 2, -3, 3, ...
          //
          //    0 -- 1
          //   /      \
          // -1        2
          //  |        |
          // -2        3
          //   \      /
          //   -3 -- 4
          //
          for (let j = 0; j < vertsAroundEdge; j++) {
            const v = Math.floor(j / 2) * Math.sign((j % 2) - 0.5);
            const a = v * stepAngle;
            const sin = Math.sin(a);
            const cos = Math.cos(a);

            positions[i]     = cos * radius;
            positions[i + 1] = sin * radius;
            positions[i + 2] = height / 2;

            normals[i + 2] = 1;

            i += 3;
          }

          return {
            positions,
            normals
          };
        }
    }
})();

