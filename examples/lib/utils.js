(function() {
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
        }
    }
})();

