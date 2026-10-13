import { describe, expect, it } from 'vitest';
import {
  imFilter, mitSammlung, ohneSammlung, ordnerPlanen, sammlungenAusPfad, sammlungenUebersicht, sammlungenVon, sammlungName,
  sammlungUmbenennen, sicherungFaellig,
} from '@/domain/sammlungen';

describe('Sammlungen: Namen', () => {
  it('Name aus der Eingabe: Leerraum geglättet, nicht leer, nicht zu lang', () => {
    expect(sammlungName('  Orchester   A ')).toBe('Orchester A');
    expect(sammlungName('   ')).toBeNull();
    expect(sammlungName('x'.repeat(80))).toHaveLength(40);
  });
  it('Sammlungen eines Stücks: nur Texte, unstimmiges Feld zählt als keine', () => {
    expect(sammlungenVon({ sammlungen: ['Märsche', 3, 'Jazz'] })).toEqual(['Märsche', 'Jazz']);
    expect(sammlungenVon({ sammlungen: 'Märsche' })).toEqual([]);
    expect(sammlungenVon({})).toEqual([]);
  });
  it('hinzufügen ohne Doppel (Groß/klein egal), entfernen, umbenennen', () => {
    expect(mitSammlung(['Märsche'], 'märsche')).toEqual(['Märsche']);
    expect(mitSammlung(['Märsche'], 'Jazz')).toEqual(['Märsche', 'Jazz']);
    expect(ohneSammlung(['Märsche', 'Jazz'], 'MÄRSCHE')).toEqual(['Jazz']);
    expect(sammlungUmbenennen(['Märsche', 'Jazz'], 'Märsche', 'Marsch')).toEqual(['Marsch', 'Jazz']);
    // Umbenennen auf eine schon vorhandene: zusammengelegt, nicht doppelt
    expect(sammlungUmbenennen(['Märsche', 'Jazz'], 'Märsche', 'jazz')).toEqual(['Jazz']);
  });
  it('Übersicht: alle Namen mit Zahl der Stücke, A–Z mit Zahlen als Zahlen', () => {
    const noten = [
      { sammlungen: ['Orchester B', 'Märsche'] }, { sammlungen: ['märsche'] }, { sammlungen: ['Orchester A'] }, {}, { sammlungen: ['Orchester 10'] },
    ];
    expect(sammlungenUebersicht(noten)).toEqual([
      { name: 'Märsche', anzahl: 2 }, { name: 'Orchester 10', anzahl: 1 }, { name: 'Orchester A', anzahl: 1 }, { name: 'Orchester B', anzahl: 1 },
    ]);
  });
  it('Filter: alle oder nur die einer Sammlung', () => {
    expect(imFilter({ sammlungen: ['Jazz'] }, null)).toBe(true);
    expect(imFilter({ sammlungen: ['Jazz'] }, 'jazz')).toBe(true);
    expect(imFilter({}, 'Jazz')).toBe(false);
  });
});

describe('Ordner übernehmen', () => {
  it('Unterordner werden Sammlungen; der gewählte Ordner nur, wenn die PDFs direkt darin liegen', () => {
    expect(sammlungenAusPfad('Märsche/Florentiner.pdf')).toEqual(['Märsche']);
    expect(sammlungenAusPfad('Noten/Orchester A/Florentiner.pdf')).toEqual(['Orchester A']);
    expect(sammlungenAusPfad('Noten/Orchester A/Konzert 2026/Florentiner.pdf')).toEqual(['Orchester A', 'Konzert 2026']);
    expect(sammlungenAusPfad('Florentiner.pdf')).toEqual([]);
  });

  const datei = (pfad: string, groesse = 100) => ({ pfad, groesse });

  it('legt neue Stücke an — dieselbe Datei in zwei Ordnern wird EIN Stück in zwei Sammlungen', () => {
    const plan = ordnerPlanen([
      datei('Noten/Orchester A/Florentiner.pdf', 500), datei('Noten/Märsche/Florentiner.pdf', 500), datei('Noten/Jazz/Take Five.pdf', 300),
    ], []);
    expect(plan.neu).toEqual([
      { index: 0, name: 'Florentiner.pdf', sammlungen: ['Orchester A', 'Märsche'] },
      { index: 2, name: 'Take Five.pdf', sammlungen: ['Jazz'] },
    ]);
    expect(plan.doppelt).toBe(1);
  });

  it('gleicher Name, andere Größe: verschiedene Stücke (z. B. „Klarinette 1.pdf“ je Stück-Ordner)', () => {
    const plan = ordnerPlanen([datei('Noten/Florentiner/Klarinette 1.pdf', 500), datei('Noten/Radetzky/Klarinette 1.pdf', 700)], []);
    expect(plan.neu).toHaveLength(2);
    expect(plan.doppelt).toBe(0);
  });

  it('schon in der Bibliothek (gleicher Dateiname, gleiche Größe): keine zweite Kopie, nur einsortieren', () => {
    const plan = ordnerPlanen([datei('Märsche/Florentiner.pdf', 500), datei('Märsche/Neu.pdf', 200)], [
      { id: 'n1', dateiname: 'Florentiner.pdf', groesse: 500 },
      { id: 'n2', dateiname: 'Neu.pdf', groesse: 999 },
    ]);
    expect(plan.bekannt).toEqual([{ notenId: 'n1', sammlungen: ['Märsche'] }]);
    expect(plan.neu.map((n) => n.name)).toEqual(['Neu.pdf']);
  });

  it('überspringt alles, was keine PDF ist, und zählt es', () => {
    const plan = ordnerPlanen([datei('Märsche/.DS_Store'), datei('Märsche/Notiz.txt'), datei('Märsche/A.PDF')], []);
    expect(plan.neu.map((n) => n.name)).toEqual(['A.PDF']);
    expect(plan.ohnePdf).toBe(2);
  });

  it('dazu die aktive Sammlung, wenn „einsortieren“ an ist', () => {
    const plan = ordnerPlanen([datei('Märsche/A.pdf')], [{ id: 'n1', dateiname: 'B.pdf', groesse: 1 }], 'Orchester A');
    expect(plan.neu[0].sammlungen).toEqual(['Märsche', 'Orchester A']);
  });
});

describe('Erinnerung an die Sicherung', () => {
  const tag = 86_400_000, jetzt = 100 * tag;
  it('fällig: länger als 7 Tage her und seitdem etwas geändert', () => {
    expect(sicherungFaellig(90 * tag, 95 * tag, 10 * tag, jetzt)).toEqual({ faellig: true, tage: 10 });
    expect(sicherungFaellig(90 * tag, 80 * tag, 10 * tag, jetzt)).toEqual({ faellig: false, tage: 10 });
    expect(sicherungFaellig(97 * tag, 99 * tag, 10 * tag, jetzt)).toEqual({ faellig: false, tage: 3 });
  });
  it('noch nie gesichert: fällig, sobald die ersten Noten älter als 7 Tage sind', () => {
    expect(sicherungFaellig(null, 99 * tag, 90 * tag, jetzt)).toEqual({ faellig: true, tage: null });
    expect(sicherungFaellig(null, 99 * tag, 96 * tag, jetzt)).toEqual({ faellig: false, tage: null });
    expect(sicherungFaellig(null, 0, null, jetzt)).toEqual({ faellig: false, tage: null });
  });
});
