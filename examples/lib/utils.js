(function() {
    const EARTH_RADIUS = 6378000;

    const NUM_TIMING_SAMPLES = 10;

    let cpuTimeSum = 0;
    let gpuTimeSum = 0;
    let timeSampleCount = NUM_TIMING_SAMPLES - 1;

    window.utils = {
        addTimerElement() {
            this.timerDiv = document.createElement("div")
            this.timerDiv.id = "timer";
            this.timerDiv.style.zIndex = 9999;
            this.timerDiv.style.position = "absolute";
            this.timerDiv.style.top = "10px";
            this.timerDiv.style.left = "10px";
            this.timerDiv.style.color = "white";
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

        // From deck.gl: https://github.com/uber/deck.gl/blob/master/examples/layer-browser/src/utils/grid-aggregator.js
        // Used under MIT license
        pointsToWorldGrid(points, cellSize) {
          // find the geometric center of sample points
          const allLat = points.map(p => p.COORDINATES[1]);
          const latMin = Math.min.apply(null, allLat);
          const latMax = Math.max.apply(null, allLat);

          const centerLat = (latMin + latMax) / 2;

          const latOffset = (cellSize / EARTH_RADIUS) * (180 / Math.PI);
          const lonOffset = ((cellSize / EARTH_RADIUS) * (180 / Math.PI)) / Math.cos((centerLat * Math.PI) / 180);

          // calculate count per cell
          const gridHash = points.reduce((accu, pt) => {
            const latIdx = Math.floor((pt.COORDINATES[1] + 90) / latOffset);
            const lonIdx = Math.floor((pt.COORDINATES[0] + 180) / lonOffset);
            const key = `${latIdx}-${lonIdx}`;

            accu[key] = accu[key] + 1 || 1;
            return accu;
          }, {});

          const maxHeight = Math.max.apply(null, Object.keys(gridHash).map(k => gridHash[k]));

          const data = Object.keys(gridHash).reduce((accu, key) => {
            const idxs = key.split('-');
            const latIdx = parseInt(idxs[0], 10);
            const lonIdx = parseInt(idxs[1], 10);

            accu.push({
              position: [-180 + lonOffset * lonIdx, -90 + latOffset * latIdx],
              value: gridHash[key] / maxHeight
            });

            return accu;
          }, []);

          return Object.assign({data}, {cellSize});
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

