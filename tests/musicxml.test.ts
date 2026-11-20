import { deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { KeineNoten, KeinXml, musicXmlLesen, musicXmlText, textDekodieren, xmlLesen, zipVerzeichnis } from '@/domain/musicxml';
import { abcLesen, alsAbcStimmen } from '@/domain/notation';
import { aufBlatt, aufsBlattStimmen, BLATT } from '@/domain/notensatz';

// Eine Partitur mit einem Teil; `takte` ist der Inhalt der <measure>-Elemente.
function partitur(takte: string[], { teile = '', titel = 'Probe', name = 'Klarinette' } = {}): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">
  <work><work-title>${titel}</work-title></work>
  <part-list><score-part id="P1"><part-name>${name}</part-name></score-part>${teile ? '<score-part id="P2"><part-name>Zwei</part-name></score-part>' : ''}</part-list>
  <part id="P1">${takte.map((t, i) => `<measure number="${i + 1}">${t}</measure>`).join('\n')}</part>
  ${teile}
</score-partwise>`;
}
const attr = ({ teiler = 1, kreuze = 0, modus = 'major', z = 4, n = 4, clef = '<clef><sign>G</sign><line>2</line></clef>' } = {}) =>
  `<attributes><divisions>${teiler}</divisions><key><fifths>${kreuze}</fifths><mode>${modus}</mode></key><time><beats>${z}</beats><beat-type>${n}</beat-type></time>${clef}</attributes>`;
const note = (stufe: string, oktave: number, dauer: number, extra = '') => {
  const alter = stufe.length > 1 ? `<alter>${stufe[1] === '#' ? 1 : -1}</alter>` : '';
  return `<note><pitch><step>${stufe[0]}</step>${alter}<octave>${oktave}</octave></pitch><duration>${dauer}</duration>${extra}</note>`;
};
// Akkordton: klingt mit der vorigen Note.
const dazu = (n: string) => n.replace('<note>', '<note><chord/>');
const pause = (dauer: number, extra = '') => `<note><rest/><duration>${dauer}</duration>${extra}</note>`;

const tonhoehen = (t: { noten: { midi: number | null }[] }) => t.noten.map((n) => n.midi);
const dauern = (t: { noten: { dauer: number }[] }) => t.noten.map((n) => n.dauer);
const V = BLATT / 4; // Viertel in Zellen

describe('xmlLesen', () => {
  it('liest Elemente, Attribute, Text und Entitäten; überliest Kommentare, DOCTYPE und Anweisungen', () => {
    const x = xmlLesen(`<?xml version="1.0"?><!DOCTYPE a [<!ENTITY x "y">]><!-- k --><a b="1 &amp; 2" c='z'><d>R&#252;ck &lt;3&gt;</d><e/><![CDATA[<roh>]]></a>`);
    expect(x.name).toBe('a');
    expect(x.attr).toEqual({ b: '1 & 2', c: 'z' });
    expect(x.kinder.map((k) => k.name)).toEqual(['d', 'e']);
    expect(x.kinder[0].text).toBe('Rück <3>');
    expect(x.text).toBe('<roh>');
  });
  it('wirft bei kaputtem XML', () => {
    expect(() => xmlLesen('<a><b></a>')).toThrow(KeinXml);
    expect(() => xmlLesen('<a>')).toThrow(KeinXml);
    expect(() => xmlLesen('kein xml')).toThrow(KeinXml);
  });
});

describe('musicXmlLesen', () => {
  it('liest eine einfache Stimme: Tonhöhen, Dauern, Tonart, Taktart, Titel', () => {
    const { gelesen, hinweise } = musicXmlLesen(partitur([
      attr({ kreuze: 1 }) + note('G', 4, 1) + note('A', 4, 1) + note('B', 4, 1) + note('C', 5, 1),
      note('D', 5, 2) + note('F#', 5, 1) + pause(1),
    ]));
    expect(gelesen.titel).toBe('Probe');
    expect(gelesen.tonart?.abc).toBe('G');
    expect(gelesen.raster).toMatchObject({ zaehler: 4, nenner: 4, feinheit: BLATT, bpm: 80 });
    expect(gelesen.stimmen).toHaveLength(1);
    // Eine Stimme im Violinschlüssel bleibt namenlos (wie ein geschriebenes Stück).
    expect(gelesen.stimmen[0]).toMatchObject({ name: '', schluessel: 'violin' });
    const [a, b] = gelesen.stimmen[0].takte;
    expect(tonhoehen(a)).toEqual([67, 69, 71, 72]);
    expect(dauern(a)).toEqual([V, V, V, V]);
    expect(tonhoehen(b)).toEqual([74, 78, null]);
    expect(dauern(b)).toEqual([2 * V, V, V]);
    expect(hinweise).toEqual([]);
  });

  it('rechnet Teiler auf das Blatt um und meldet, was gerundet werden musste', () => {
    // Teiler 6: Achtel = 3, Sechzehntel punktiert = 2,25 → nicht ganz
    const { gelesen } = musicXmlLesen(partitur([attr({ teiler: 6 }) + note('C', 5, 3) + note('D', 5, 3) + note('E', 5, 6) + note('F', 5, 12)]));
    expect(dauern(gelesen.stimmen[0].takte[0])).toEqual([V / 2, V / 2, V, 2 * V]);
    const { hinweise } = musicXmlLesen(partitur([attr({ teiler: 5 }) + note('C', 5, 1) + note('D', 5, 19)]));
    expect(hinweise.some((h) => h.startsWith('Rhythmen an'))).toBe(true);
  });

  it('übernimmt Haltebögen (auch über den Taktstrich) und Bindebögen', () => {
    const { gelesen } = musicXmlLesen(partitur([
      attr() + note('C', 5, 1, '<notations><slur type="start" number="1"/></notations>') + note('D', 5, 1) + note('E', 5, 1, '<notations><slur type="stop" number="1"/></notations>')
        + note('G', 5, 1, '<tie type="start"/><notations><tied type="start"/></notations>'),
      note('G', 5, 4, '<tie type="stop"/>'),
    ]));
    const [a, b] = gelesen.stimmen[0].takte;
    expect(a.noten[0].bogenAuf).toBe(true);
    expect(a.noten[2].bogenZu).toBe(true);
    expect(a.noten[3].bindung).toBe(true);
    expect(b.noten[0].bindung).toBeUndefined();
  });

  it('füllt einen Auftakt vorn mit Pausen und den kurzen Schlusstakt hinten', () => {
    const { gelesen, hinweise } = musicXmlLesen(partitur([
      attr({ z: 3 }) + note('D', 5, 1),
      note('G', 5, 3),
      note('G', 5, 2),
    ]));
    const [a, b, c] = gelesen.stimmen[0].takte;
    expect(tonhoehen(a)).toEqual([null, 74]);
    expect(dauern(a)).toEqual([2 * V, V]);
    expect(dauern(b)).toEqual([3 * V]);
    expect(tonhoehen(c)).toEqual([79, null]);
    expect(dauern(c)).toEqual([2 * V, V]);
    expect(hinweise.some((h) => h.startsWith('Auftakt'))).toBe(true);
  });

  it('lässt zu kurze Takte mitten im Stück kurz (rot im Notenblatt) und sagt es', () => {
    const { gelesen, hinweise } = musicXmlLesen(partitur([
      attr() + note('C', 5, 4),
      note('C', 5, 3),
      note('C', 5, 4),
    ]));
    expect(dauern(gelesen.stimmen[0].takte[1])).toEqual([3 * V]);
    expect(hinweise).toContain('1 Takt passt nicht zur Taktart und ist rot — dort hat die Erkennung wohl etwas verpasst.');
  });

  it('behält bei Akkorden den obersten Ton', () => {
    const { gelesen, hinweise } = musicXmlLesen(partitur([
      attr() + note('C', 5, 2) + dazu(note('E', 5, 2)) + note('G', 4, 2) + dazu(note('B', 4, 2)),
    ]));
    expect(tonhoehen(gelesen.stimmen[0].takte[0])).toEqual([76, 71]);
    expect(hinweise).toContain('Akkorde in einer Stimme (2×): nur der oberste Ton.');
  });

  it('macht aus Stimmen und Systemen eigene Stimmen mit ihrem Schlüssel', () => {
    const klavier = attr({ clef: '<staves>2</staves><clef number="1"><sign>G</sign><line>2</line></clef><clef number="2"><sign>F</sign><line>4</line></clef>' })
      + note('E', 5, 4, '<voice>1</voice><staff>1</staff>')
      + '<backup><duration>4</duration></backup>'
      + note('C', 5, 2, '<voice>2</voice><staff>1</staff>') + note('B', 4, 2, '<voice>2</voice><staff>1</staff>')
      + '<backup><duration>4</duration></backup>'
      + note('C', 3, 4, '<voice>5</voice><staff>2</staff>');
    const { gelesen } = musicXmlLesen(partitur([klavier], { name: 'Klavier' }));
    expect(gelesen.stimmen.map((s) => [s.name, s.schluessel])).toEqual([['Klavier 1', 'violin'], ['Klavier 2', 'violin'], ['Klavier 3', 'bass']]);
    expect(gelesen.stimmen.map((s) => tonhoehen(s.takte[0]))).toEqual([[76], [72, 71], [48]]);
  });

  it('füllt Lücken einer Stimme (forward, fehlende Takte) mit Pausen und lässt leere Stimmen weg', () => {
    const xml = partitur([
      attr() + note('C', 5, 4, '<voice>1</voice>') + '<backup><duration>4</duration></backup><forward><duration>2</duration></forward>' + note('A', 4, 2, '<voice>2</voice>'),
      note('D', 5, 4, '<voice>1</voice>') + '<backup><duration>4</duration></backup>' + pause(4, '<voice>3</voice>'),
    ]);
    const { gelesen, hinweise } = musicXmlLesen(xml);
    expect(gelesen.stimmen).toHaveLength(2);
    expect(tonhoehen(gelesen.stimmen[1].takte[0])).toEqual([null, 69]);
    expect(tonhoehen(gelesen.stimmen[1].takte[1])).toEqual([null]);
    expect(dauern(gelesen.stimmen[1].takte[1])).toEqual([4 * V]);
    expect(hinweise).toContain('1 leere Stimme weggelassen.');
  });

  it('nimmt mehrere Teile als Stimmen', () => {
    const zwei = `<part id="P2"><measure number="1">${attr({ clef: '<clef><sign>F</sign><line>4</line></clef>' })}${note('C', 3, 4)}</measure></part>`;
    const { gelesen } = musicXmlLesen(partitur([attr() + note('C', 5, 4)], { teile: zwei }));
    expect(gelesen.stimmen.map((s) => [s.name, s.schluessel])).toEqual([['Klarinette', 'violin'], ['Zwei', 'bass']]);
  });

  it('erkennt Triolen über die Lage der Einsätze (das Blatt klammert sie)', () => {
    const triole = '<time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification>';
    const { gelesen } = musicXmlLesen(partitur([attr({ teiler: 3 }) + note('C', 5, 1, triole) + note('D', 5, 1, triole) + note('E', 5, 1, triole) + note('F', 5, 3) + note('G', 5, 6)]));
    expect(dauern(gelesen.stimmen[0].takte[0])).toEqual([V / 3, V / 3, V / 3, V, 2 * V]);
    const blatt = aufsBlattStimmen(gelesen.stimmen, gelesen.raster.feinheit, gelesen.raster);
    const erste = blatt[0].takte[0].noten;
    expect(erste.slice(0, 3).every((n) => n.triole)).toBe(true);
    expect(erste[0].gruppe).toBe(3);
  });

  it('rechnet das Tempo auf den Schlag um (6/8: punktierte Viertel)', () => {
    const tempo = '<direction><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>120</per-minute></metronome></direction-type><sound tempo="120"/></direction>';
    expect(musicXmlLesen(partitur([attr() + tempo + note('C', 5, 4)])).gelesen.raster.bpm).toBe(120);
    expect(musicXmlLesen(partitur([attr({ z: 6, n: 8, teiler: 2 }) + tempo + note('C', 5, 6)])).gelesen.raster.bpm).toBe(80);
    const nurMetronom = '<direction><direction-type><metronome><beat-unit>half</beat-unit><per-minute>60</per-minute></metronome></direction-type></direction>';
    expect(musicXmlLesen(partitur([attr({ z: 2, n: 2 }) + nurMetronom + note('C', 5, 4)])).gelesen.raster.bpm).toBe(60);
  });

  it('meldet, was das Notenblatt nicht fassen kann', () => {
    const { hinweise } = musicXmlLesen(partitur([
      attr() + '<direction><direction-type><dynamics><p/></dynamics></direction-type></direction>'
        + '<harmony><root><root-step>C</root-step></root><kind>major</kind></harmony>'
        + note('C', 5, 1, '<lyric><text>la</text></lyric>')
        + '<note><grace/><pitch><step>D</step><octave>5</octave></pitch></note>'
        + note('E', 5, 3, '<notations><articulations><staccato/></articulations></notations>')
        + '<barline location="right"><repeat direction="backward"/></barline>',
      '<attributes><key><fifths>-1</fifths></key><time><beats>3</beats><beat-type>4</beat-type></time></attributes>' + note('F', 5, 3)
        + '<direction><direction-type><words>D.C. al Fine</words></direction-type></direction>',
    ]));
    expect(hinweise).toEqual(expect.arrayContaining([
      'Tonartwechsel im Stück: Die Töne stimmen, die neuen Vorzeichen stehen an den Noten.',
      'Taktwechsel im Stück: Das Notenblatt kennt nur eine Taktart (4/4).',
      'Vorschlagsnoten (1) weggelassen.',
      'Wiederholungszeichen und Volten fehlen — die Takte stehen einmal da.',
      'Sprungzeichen (D.C., D.S., Coda, Fine) fehlen.',
      'Dynamik, Artikulation und Verzierungen fallen weg.',
      'Liedtext fällt weg.',
      'Akkordsymbole (1) fallen weg.',
    ]));
  });

  it('meldet Tonarten, die das Notenblatt nicht kennt (Vorzeichen an den Noten)', () => {
    const { gelesen, hinweise } = musicXmlLesen(partitur([attr({ kreuze: 5 }) + note('B', 4, 4)]));
    expect(gelesen.tonart).toBeNull();
    expect(hinweise).toContain('Die Tonart mit 5 Kreuzen kennt das Notenblatt nicht — die Vorzeichen stehen an den Noten.');
    expect(musicXmlLesen(partitur([attr({ kreuze: -2, modus: 'minor' }) + note('G', 4, 4)])).gelesen.tonart?.abc).toBe('Gm');
  });

  it('liest Tenor- und Altschlüssel; ein Oktav-Violinschlüssel wird eine Oktave höher notiert', () => {
    expect(musicXmlLesen(partitur([attr({ clef: '<clef><sign>C</sign><line>4</line></clef>' }) + note('C', 4, 4)])).gelesen.stimmen[0].schluessel).toBe('tenor');
    const { gelesen, hinweise } = musicXmlLesen(partitur([attr({ clef: '<clef><sign>G</sign><line>2</line><clef-octave-change>-1</clef-octave-change></clef>' }) + note('E', 3, 4)]));
    expect(tonhoehen(gelesen.stimmen[0].takte[0])).toEqual([64]);
    expect(hinweise.some((h) => h.startsWith('Oktav-Schlüssel'))).toBe(true);
    const sopran = musicXmlLesen(partitur([attr({ clef: '<clef><sign>C</sign><line>1</line></clef>' }) + note('C', 5, 4)]));
    expect(sopran.gelesen.stimmen[0].schluessel).toBe('alt');
    expect(sopran.hinweise).toContain('Schlüssel C auf Linie 1 gibt es im Notenblatt nicht — als nächster passender geschrieben.');
  });

  it('liest auch die zeitweise Form (score-timewise)', () => {
    const xml = `<score-timewise><part-list><score-part id="P1"><part-name>Flöte</part-name></score-part></part-list>
      <measure number="1"><part id="P1">${attr()}${note('C', 5, 4)}</part></measure>
      <measure number="2"><part id="P1">${note('D', 5, 4)}</part></measure></score-timewise>`;
    const { gelesen } = musicXmlLesen(xml);
    expect(gelesen.stimmen[0].takte.map(tonhoehen)).toEqual([[72], [74]]);
  });

  it('wirft, wenn es keine Partitur ist oder keine Noten darin stehen', () => {
    expect(() => musicXmlLesen('<html><body/></html>')).toThrow(KeineNoten);
    expect(() => musicXmlLesen(partitur([attr() + pause(4)]))).toThrow('In der Datei stehen keine Noten.');
  });

  it('überlebt Speichern und Wiederöffnen im Notenblatt (ABC hin und zurück)', () => {
    const { gelesen } = musicXmlLesen(partitur([
      attr({ kreuze: -1, z: 3 }) + note('F', 4, 1) + note('A', 4, 1) + note('C', 5, 1),
      note('Bb', 4, 2, '<tie type="start"/>') + note('Bb', 4, 1, '<tie type="stop"/>'),
    ]));
    const r = aufBlatt(gelesen.raster);
    const blatt = aufsBlattStimmen(gelesen.stimmen, gelesen.raster.feinheit, gelesen.raster);
    const abc = alsAbcStimmen(blatt, r, { titel: 'Probe' }, gelesen.tonart);
    const zurueck = abcLesen(abc)!;
    expect(zurueck.tonart?.abc).toBe('F');
    expect(zurueck.raster).toMatchObject({ zaehler: 3, nenner: 4, feinheit: BLATT });
    expect(aufsBlattStimmen(zurueck.stimmen, zurueck.raster.feinheit, zurueck.raster)).toEqual(blatt);
  });
});

// Eine ZIP-Datei bauen (ohne Prüfsummen — der Leser prüft sie nicht).
function zip(dateien: { name: string; text: string; packen?: boolean }[]): Uint8Array {
  const teile: Uint8Array[] = [], verzeichnis: Uint8Array[] = [];
  let ab = 0;
  for (const d of dateien) {
    const roh = new TextEncoder().encode(d.text);
    const daten = d.packen === false ? roh : new Uint8Array(deflateRawSync(roh));
    const name = new TextEncoder().encode(d.name);
    const kopf = new DataView(new ArrayBuffer(30));
    kopf.setUint32(0, 0x04034b50, true); kopf.setUint16(8, d.packen === false ? 0 : 8, true);
    kopf.setUint32(18, daten.length, true); kopf.setUint32(22, roh.length, true); kopf.setUint16(26, name.length, true);
    const zentral = new DataView(new ArrayBuffer(46));
    zentral.setUint32(0, 0x02014b50, true); zentral.setUint16(10, d.packen === false ? 0 : 8, true);
    zentral.setUint32(20, daten.length, true); zentral.setUint32(24, roh.length, true); zentral.setUint16(28, name.length, true);
    zentral.setUint32(42, ab, true);
    teile.push(new Uint8Array(kopf.buffer), name, daten);
    verzeichnis.push(new Uint8Array(zentral.buffer), name);
    ab += 30 + name.length + daten.length;
  }
  const groesse = verzeichnis.reduce((s, x) => s + x.length, 0);
  const ende = new DataView(new ArrayBuffer(22));
  ende.setUint32(0, 0x06054b50, true); ende.setUint16(8, dateien.length, true); ende.setUint16(10, dateien.length, true);
  ende.setUint32(12, groesse, true); ende.setUint32(16, ab, true);
  const alles = [...teile, ...verzeichnis, new Uint8Array(ende.buffer)];
  const b = new Uint8Array(alles.reduce((s, x) => s + x.length, 0));
  let p = 0;
  for (const x of alles) { b.set(x, p); p += x.length; }
  return b;
}

describe('MusicXML-Datei', () => {
  const xml = partitur([attr() + note('C', 5, 4)], { titel: 'Grüße' });

  it('liest ungepackte Dateien, auch UTF-16 mit BOM', async () => {
    expect(await musicXmlText(new TextEncoder().encode(xml))).toBe(xml);
    const utf16 = new Uint8Array(2 + xml.length * 2);
    utf16[0] = 0xff; utf16[1] = 0xfe;
    for (let i = 0; i < xml.length; i++) { utf16[2 + i * 2] = xml.charCodeAt(i) & 0xff; utf16[3 + i * 2] = xml.charCodeAt(i) >> 8; }
    expect(textDekodieren(utf16)).toBe(xml);
  });

  it('entpackt .mxl über META-INF/container.xml', async () => {
    const container = '<?xml version="1.0"?><container><rootfiles><rootfile full-path="noten/stueck.musicxml" media-type="application/vnd.recordare.musicxml+xml"/></rootfiles></container>';
    const datei = zip([
      { name: 'mimetype', text: 'application/vnd.recordare.musicxml', packen: false },
      { name: 'META-INF/container.xml', text: container },
      { name: 'noten/stueck.musicxml', text: xml },
    ]);
    expect(zipVerzeichnis(datei).map((e) => e.name)).toEqual(['mimetype', 'META-INF/container.xml', 'noten/stueck.musicxml']);
    const text = await musicXmlText(datei);
    expect(musicXmlLesen(text).gelesen.titel).toBe('Grüße');
  });

  it('nimmt ohne container.xml die erste Notendatei und meldet kaputte Pakete', async () => {
    expect(await musicXmlText(zip([{ name: 'a.xml', text: xml, packen: false }]))).toBe(xml);
    const kaputt = zip([{ name: 'a.xml', text: xml }]).slice(0, 40);
    await expect(musicXmlText(kaputt)).rejects.toThrow('beschädigt');
  });
});
