// Übe-Sicherung: eine Datei mit allen Noten (PDF), markierten Stellen und
// Anmerkungen eines Geräts — zum Umziehen in die eigene Übe-App und als
// Sicherung gegen gelöschte Browserdaten. Rein und getestet.
//
// Aufbau (binär, ohne Base64, damit große PDFs klein bleiben):
//   "UEBE" (4 Byte) · Version (1 Byte) · Kopflänge (4 Byte, big endian)
//   · Kopf (JSON, UTF-8) · die PDF-Dateien direkt hintereinander.
//
// Der Kopf trägt `noten`, `stellen` und `anmerkungen` im Zuschnitt der
// Registerführer-App (`notenId`) — das ist der Vertrag. Dazu kommen
// optionale Felder (Version bleibt 1, wer sie nicht kennt, überliest sie):
// `geloescht`, `tags`, `tonprofile` (siehe unten) und, so wie sie im
// Gerätespeicher „cheatsheet“ liegen (`stueckId`), `virtuelle` (Stücke ohne
// eigene PDF, tragen nichts zum Datenteil bei), `lesezeichen`, `merker`,
// `setlisten`; dazu `einstellungen` (persönliche Einstellungen,
// @/domain/einstellungen).

export const SICHERUNG_ENDUNG = '.uebe';
const MAGIE = [0x55, 0x45, 0x42, 0x45]; // "UEBE"
const VERSION = 1;

export interface Sicherungskopf {
  version: number;
  erstellt: number;
  quelle: string;
  // Noten ohne die Datei selbst; groesse/typ beschreiben den Datenteil.
  noten: ({ id: string; groesse: number; typ: string } & Record<string, unknown>)[];
  stellen: ({ id: string; notenId: string } & Record<string, unknown>)[];
  anmerkungen: ({ id: string; notenId: string } & Record<string, unknown>)[];
  // Ergänzungen 2026-10-12, weiter Version 1 — fehlen in älteren Sicherungen
  // und in denen der Registerführer-App; wer sie nicht kennt, überliest sie:
  // Grabsteine gelöschter Noten, Stellen, Tags und Tonprofile (siehe
  // @/domain/einspielen), die Tag-Definitionen (@/domain/tags) und die
  // Tonprofile (@/domain/tonprofil).
  geloescht?: unknown[];
  tags?: unknown[];
  tonprofile?: unknown[];
  // Ergänzungen der Datenbank „cheatsheet“ (docs/datenmodell.md), weiter Version 1.
  virtuelle?: Eintrag[];
  lesezeichen?: Eintrag[];
  merker?: Eintrag[];
  setlisten?: Eintrag[];
  // Ergänzung 2026-10-13, ebenso optional: persönliche Einstellungen
  // { stand, werte } — Stimmung, Metronom, Stiftfarben … (@/domain/einstellungen).
  einstellungen?: unknown;
}

export interface Sicherungszusatz {
  geloescht?: unknown[];
  tags?: unknown[];
  tonprofile?: unknown[];
  einstellungen?: { stand: number; werte: Record<string, unknown> };
}

export interface SicherungsInhalt<N, S, A> { noten: N[]; stellen: S[]; anmerkungen: A[] }

type Eintrag = { id: string } & Record<string, unknown>;
export const ZUSATZ = ['virtuelle', 'lesezeichen', 'merker', 'setlisten'] as const;
export type Zusatz = Record<(typeof ZUSATZ)[number], Eintrag[]>;
export const keinZusatz = (): Zusatz => ({ virtuelle: [], lesezeichen: [], merker: [], setlisten: [] });

// Packt alles in eine Datei. Dateiverweise (handle) lassen sich nicht
// übertragen und werden weggelassen.
export async function sicherungPacken<
  N extends { id: string; datei: Blob },
  S extends { id: string; notenId: string },
  A extends { id: string; notenId: string },
>(
  inhalt: SicherungsInhalt<N, S, A>, quelle: string, erstellt: number,
  zusatz: Sicherungszusatz & Partial<Zusatz> = {},
): Promise<Blob> {
  const kopf: Sicherungskopf = {
    version: VERSION,
    erstellt,
    quelle,
    noten: inhalt.noten.map((n) => {
      const { datei, handle: _handle, ...rest } = n as N & { handle?: unknown };
      void _handle;
      return { ...rest, groesse: datei.size, typ: datei.type || 'application/pdf' };
    }),
    stellen: inhalt.stellen.map((s) => ({ ...s })),
    anmerkungen: inhalt.anmerkungen.map((a) => ({ ...a })),
    ...(zusatz.geloescht?.length ? { geloescht: zusatz.geloescht } : {}),
    ...(zusatz.tags?.length ? { tags: zusatz.tags } : {}),
    ...(zusatz.tonprofile?.length ? { tonprofile: zusatz.tonprofile } : {}),
    ...(zusatz.virtuelle?.length ? { virtuelle: zusatz.virtuelle.map(({ handle: _h, ...rest }) => { void _h; return rest as Eintrag; }) } : {}),
    ...(zusatz.lesezeichen?.length ? { lesezeichen: zusatz.lesezeichen } : {}),
    ...(zusatz.merker?.length ? { merker: zusatz.merker } : {}),
    ...(zusatz.setlisten?.length ? { setlisten: zusatz.setlisten } : {}),
    ...(zusatz.einstellungen && Object.keys(zusatz.einstellungen.werte).length ? { einstellungen: zusatz.einstellungen } : {}),
  };
  const json = new TextEncoder().encode(JSON.stringify(kopf));
  const vorspann = new Uint8Array(9);
  vorspann.set(MAGIE, 0);
  vorspann[4] = VERSION;
  new DataView(vorspann.buffer).setUint32(5, json.byteLength, false);
  return new Blob([vorspann, json, ...inhalt.noten.map((n) => n.datei)], { type: 'application/octet-stream' });
}

export class SicherungsFehler extends Error {}

// Liest eine Sicherung und prüft sie, bevor irgendetwas gespeichert wird.
export async function sicherungLesen(datei: Blob): Promise<{
  kopf: Sicherungskopf;
  noten: (Record<string, unknown> & { id: string; datei: Blob })[];
}> {
  if (datei.size < 9) throw new SicherungsFehler('Das ist keine Übe-Sicherung (Datei zu klein).');
  const vorspann = new Uint8Array(await datei.slice(0, 9).arrayBuffer());
  if (!MAGIE.every((b, i) => vorspann[i] === b)) throw new SicherungsFehler('Das ist keine Übe-Sicherung.');
  if (vorspann[4] !== VERSION) throw new SicherungsFehler(`Diese Sicherung hat Version ${vorspann[4]}; unterstützt wird Version ${VERSION}.`);
  const kopfLaenge = new DataView(vorspann.buffer).getUint32(5, false);
  if (9 + kopfLaenge > datei.size) throw new SicherungsFehler('Die Sicherung ist unvollständig (Kopf abgeschnitten).');

  let kopf: Sicherungskopf;
  try {
    kopf = JSON.parse(new TextDecoder().decode(await datei.slice(9, 9 + kopfLaenge).arrayBuffer())) as Sicherungskopf;
  } catch {
    throw new SicherungsFehler('Die Sicherung ist beschädigt (Kopf nicht lesbar).');
  }
  if (!Array.isArray(kopf.noten) || !Array.isArray(kopf.stellen) || !Array.isArray(kopf.anmerkungen)) {
    throw new SicherungsFehler('Die Sicherung ist beschädigt (Inhalt fehlt).');
  }
  if (ZUSATZ.some((k) => kopf[k] !== undefined && !Array.isArray(kopf[k]))) {
    throw new SicherungsFehler('Die Sicherung ist beschädigt (Inhalt fehlt).');
  }

  let pos = 9 + kopfLaenge;
  const noten = kopf.noten.map((n) => {
    if (typeof n.id !== 'string' || !Number.isInteger(n.groesse) || n.groesse < 0) {
      throw new SicherungsFehler('Die Sicherung ist beschädigt (Noteneintrag ungültig).');
    }
    if (pos + n.groesse > datei.size) throw new SicherungsFehler(`Die Sicherung ist unvollständig (Datei für „${String(n.titel ?? n.id)}“ fehlt).`);
    const { groesse, typ, ...rest } = n;
    const teil = datei.slice(pos, pos + groesse, typ || 'application/pdf');
    pos += groesse;
    return { ...rest, id: n.id, datei: teil };
  });
  if (pos !== datei.size) throw new SicherungsFehler('Die Sicherung ist beschädigt (unerwartete Daten am Ende).');
  return { kopf, noten };
}

// Mit Uhrzeit: Die neueste ist auf einen Blick zu erkennen, und eine zweite
// Sicherung am selben Tag überschreibt die erste nicht (Punkt statt
// Doppelpunkt — den mögen Dateisysteme nicht).
export function sicherungsName(datum: Date): string {
  const z = (n: number) => String(n).padStart(2, '0');
  return `Uebe-Sicherung ${datum.getFullYear()}-${z(datum.getMonth() + 1)}-${z(datum.getDate())} ${z(datum.getHours())}.${z(datum.getMinutes())}${SICHERUNG_ENDUNG}`;
}
