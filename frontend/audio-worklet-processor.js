class MicrophoneProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
    }

    process(inputs) {
        const input = inputs[0];
        if (!input || input.length === 0) {
            return true;
        }

        const channelData = input[0];
        if (!channelData || channelData.length === 0) {
            return true;
        }

        const samples = new Float32Array(channelData.length);
        samples.set(channelData);
        this.port.postMessage(samples, [samples.buffer]);

        return true;
    }
}

registerProcessor('microphone-processor', MicrophoneProcessor);
