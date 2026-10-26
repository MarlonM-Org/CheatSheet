// Mitschnitt fürs Einsingen (src/components/ueben/Einspielen.tsx): läuft im
// Audio-Thread, sammelt den ersten Kanal des Eingangs in Stücken von 1024
// Abtastwerten und schickt jedes mit der Kontextzeit seines ersten Werts an
// die Seite (src/domain/notation.ts, mitschnittAb setzt sie zusammen). Der
// Ausgang bleibt still; verbunden ist er nur, damit der Knoten rechnet.
/* global AudioWorkletProcessor, registerProcessor, currentTime, sampleRate */
const STUECK = 1024;

class Mitschnitt extends AudioWorkletProcessor {
  constructor() {
    super();
    this.puffer = new Float32Array(STUECK);
    this.gefuellt = 0;
    this.beginn = 0;
  }

  process(inputs) {
    const kanal = inputs[0] && inputs[0][0];
    if (!kanal) return true;
    let i = 0;
    while (i < kanal.length) {
      if (this.gefuellt === 0) this.beginn = currentTime + i / sampleRate;
      const n = Math.min(kanal.length - i, STUECK - this.gefuellt);
      this.puffer.set(kanal.subarray(i, i + n), this.gefuellt);
      this.gefuellt += n;
      i += n;
      if (this.gefuellt === STUECK) {
        this.port.postMessage({ beginn: this.beginn, daten: this.puffer }, [this.puffer.buffer]);
        this.puffer = new Float32Array(STUECK);
        this.gefuellt = 0;
      }
    }
    return true;
  }
}

registerProcessor('mitschnitt', Mitschnitt);
