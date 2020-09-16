// Instruments

let leadSampler = new Tone.Sampler({
  urls: {
    C2:
      "https://cdn.glitch.com/207f429b-3476-40eb-a33a-05bb64ff9656%2F521905__tarane468__12-haugharp-c4.wav?v=1596912821837"
  },
  volume: -4
});
let leadDelay = new Tone.PingPongDelay("8n.", 0.3);
leadSampler.connect(leadDelay);
leadDelay.toDestination();
let leadReverb = new Tone.Reverb({ decay: 3, wet: 0.5 }).toDestination();
leadSampler.connect(leadReverb);

// Patterns

let leadPattern = [];
let leadPart = new Tone.Part((time, note) => {
  leadSampler.triggerAttackRelease(note, "2n", time);
}, leadPattern).start();
leadPart.loop = true;
leadPart.loopStart = 0;
leadPart.loopEnd = "8m";

// Interaction

document.getElementById("start").onclick = async () => {
  await Tone.start();
  Tone.Transport.start();
};

document.getElementById("stop").onclick = async () => {
  Tone.Transport.stop();
};

document.getElementById("bpm").oninput = evt => {
  let newBpm = +evt.target.value;
  Tone.Transport.bpm.value = newBpm;
};

let sequencer = new Nexus.Sequencer("#sequencer", {
  columns: 32,
  rows: 6,
  size: [300, 150]
});
new Tone.Loop(time => {
  Tone.Draw.schedule(() => sequencer.next(), time);
}, "2n").start();
let sequencerRows = ["C2", "A2", "G1", "E1", "D1", "C1"];
sequencer.on("change", generateMelodies);

// Magenta stuff

/*
let melodyRnn = new music_rnn.MusicRNN( 'https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/chord_pitches_improv');
let melodyRnnLoaded = melodyRnn.initialize()

document.getElementById('generate-melody').onclick = async () => {
  await melodyRnnLoaded;
  
  let seed = {
    notes: [
      {pitch: Tone.Frequency('C#3').toMidi(), quantizedStartStep: 0, quantizedEndStep: 4}
    ],
    totalQuantizedSteps: 4,
    quantizationInfo: { stepsPerQuarter: 4}
  };
  let steps = 28;
  let temperature = 1.2;
  let chordProgression = ['C#m7'];
  
  let result = await melodyRnn.continueSequence(seed, steps, temperature, chordProgression);
  
  let combined = core.sequences.concatenate([seed, result]);
  
  sequencer.matrix.populate.all([0]);
  for (let note of combined.notes) {
    let column = note.quantizedStartStep;
    let noteName = Tone.Frequency(note.pitch, 'midi').toNote();
    let row = sequencerRows.indexOf(noteName);
    if (row >= 0) {
      sequencer.matrix.set.cell(column, row, 1);
    }
  }
  console.log(combined);
}
*/

let grooVae = new music_vae.MusicVAE(
  "https://storage.googleapis.com/magentadata/js/checkpoints/music_vae/groovae_2bar_humanize"
);
let grooVaeLoaded = grooVae.initialize();

let melChordsVae = new music_vae.MusicVAE(
  "https://storage.googleapis.com/magentadata/js/checkpoints/music_vae/mel_chords"
);
let melChordsLoaded = melChordsVae.initialize();

async function generateMelodies() {
  let input = {
    notes: [],
    totalQuantizedSteps: 32,
    quantizationInfo: { stepsPerQuarter: 4 }
  };
  let pattern = sequencer.matrix.pattern;
  for (let row = 0; row < pattern.length; row++) {
    for (let col = 0; col < pattern[row].length; col++) {
      if (pattern[row][col]) {
        input.notes.push({
          quantizedStartStep: col,
          quantizedEndStep: col + 2,
          pitch: Tone.Frequency(sequencerRows[row]).toMidi()
        });
      }
    }
  }
  console.log(input);

  let z = await melChordsVae.encode([input], { chordProgression: ["C#m7"] });

  let one = await melChordsVae.decode(z, 1.0, { chordProgression: ["C#m7"] });
  let two = await melChordsVae.decode(z, 1.0, { chordProgression: ["F#m"] });
  let three = await melChordsVae.decode(z, 1.0, { chordProgression: ["A"] });
  let four = await melChordsVae.decode(z, 1.0, { chordProgression: ["C#m7"] });

  let all = core.sequences.concatenate(
    one
      .concat(two)
      .concat(three)
      .concat(four)
  );

  leadPart.clear();
  for (let note of all.notes) {
    leadPart.at(
      { "16n": note.quantizedStartStep },
      Tone.Frequency(note.pitch, "midi").toNote()
    );
  }
  console.log(one, two, three, four);
}
