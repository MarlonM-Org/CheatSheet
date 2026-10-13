'use client';

import { useEffect, useRef, useState } from 'react';
import {
  RAD_ANFANG, radGeste, radWeg, tastenAktion, WISCH_MIN, WISCH_UMKEHREN, zeigerGeste, type Blaetter, type Richtung,
} from '@/domain/geste';
import { gespeichert, speichern } from './klang';

const RICHTUNG: Record<Richtung, string> = { hoch: '↑ nach oben', runter: '↓ nach unten', links: '← nach links', rechts: '→ nach rechts' };
const ZIEL: Record<Blaetter, string> = { weiter: 'Weiter ›', zurueck: '‹ Zurück' };
// Wie der Ring ankommt, hilft beim Einrichten: als Berührung oder als Zeiger.
const QUELLE: Record<string, string> = { touch: 'als Berührung', mouse: 'als Zeiger', pen: 'als Stift' };
const TASTE: Record<string, string> = {
  ' ': 'Leertaste', ArrowRight: 'Pfeil →', ArrowLeft: 'Pfeil ←', ArrowDown: 'Pfeil ↓', ArrowUp: 'Pfeil ↑', PageDown: 'Bild ↓', PageUp: 'Bild ↑',
};
const STILL = new Set(['Tab', 'Shift', 'Control', 'Alt', 'Meta', 'Escape']);

interface Meldung { aktion: Blaetter | null; text: string; n: number }

// Blättern mit Scroll-Ring oder Pedal (B-08): Wischrichtung, Einrichtung am
// iPhone und ein Feld zum Ausprobieren, das zeigt, was ankommt — dieselben
// Regeln (@/domain/geste) wie auf den Noten.
export function BlaetternEinstellung() {
  const [umkehren, setUmkehren] = useState(() => gespeichert(WISCH_UMKEHREN, false));
  const [meldung, setMeldung] = useState<Meldung | null>(null);
  const [zahl, setZahl] = useState({ weiter: 0, zurueck: 0 });
  const zug = useRef<{ x: number; y: number; t: number; typ: string } | null>(null);
  const rad = useRef(RAD_ANFANG);
  const feld = useRef<HTMLDivElement>(null);

  const melden = (aktion: Blaetter | null, text: string) => {
    setMeldung((m) => ({ aktion, text, n: (m?.n ?? 0) + 1 }));
    if (aktion) setZahl((z) => ({ ...z, [aktion]: z[aktion] + 1 }));
  };

  // Mausrad im Feld: nicht das Blatt rollen (dafür ein Listener, der nicht passiv ist).
  useEffect(() => {
    const el = feld.current;
    if (!el) return;
    const drehen = (e: WheelEvent) => {
      e.preventDefault();
      const f = (d: number) => radWeg(d, e.deltaMode, window.innerHeight);
      const r = radGeste(rad.current, f(e.deltaX), f(e.deltaY), e.timeStamp, umkehren);
      rad.current = r.z;
      if (r.aktion) melden(r.aktion, `Mausrad ${Math.abs(e.deltaX) > Math.abs(e.deltaY) ? 'seitwärts' : e.deltaY > 0 ? '↓' : '↑'}`);
    };
    el.addEventListener('wheel', drehen, { passive: false });
    return () => el.removeEventListener('wheel', drehen);
  }, [umkehren]);

  function hoch(e: React.PointerEvent) {
    const z = zug.current;
    zug.current = null;
    if (!z) return;
    const g = zeigerGeste(e.clientX - z.x, e.clientY - z.y, e.timeStamp - z.t, umkehren);
    const wie = QUELLE[z.typ] ?? '';
    if (g.art === 'wisch') melden(g.aktion, `Wisch ${RICHTUNG[g.richtung]} · ${g.weg} px ${wie}`);
    else if (g.art === 'tippen') melden(null, `Tippen ${wie}`);
    else if (g.weg > 12) melden(null, `Zu kurz (${g.weg} px, ab ${WISCH_MIN} px)`);
    else melden(null, 'Lange gedrückt');
  }

  return (
    <section className="space-y-2" aria-label="Blättern mit Scroll-Ring oder Pedal">
      <p className="text-sm font-semibold">Blättern mit Scroll-Ring oder Pedal</p>
      <ul className="stichpunkte gedaempft text-sm">
        <li>Wischen: links weiter, rechts zurück</li>
        <li>Pedal (Pfeil-, Bild-Tasten, Leertaste) und Mausrad gehen auch</li>
      </ul>
      <label className="flex items-center justify-between gap-3">
        <span>
          <span className="text-sm font-semibold">Hoch und runter tauschen</span>
          <span className="block text-xs gedaempft">
            {umkehren ? 'Runter weiter, hoch zurück' : 'Hoch weiter (wie bei Videos), runter zurück'}
          </span>
        </span>
        <input type="checkbox" role="switch" className="ios-schalter" checked={umkehren}
          onChange={(e) => { setUmkehren(e.target.checked); speichern(WISCH_UMKEHREN, e.target.checked); }} />
      </label>
      <details className="text-sm">
        <summary className="font-semibold">Scroll-Ring am iPhone einrichten</summary>
        <ol className="stichpunkte gedaempft pt-1">
          <li>AssistiveTouch an (Bedienungshilfen → Tippen), Ring per Bluetooth koppeln</li>
          <li>Grauen Zeiger-Punkt mitten auf die Noten stellen</li>
          <li>„Zu kurz“? Zeiger-Geschwindigkeit am iPhone erhöhen</li>
        </ol>
      </details>
      <div ref={feld} className="wisch-test" tabIndex={0} aria-label="Ausprobieren: hier wischen, tippen, Mausrad drehen oder Pedal drücken"
        onPointerDown={(e) => {
          e.currentTarget.focus();
          e.currentTarget.setPointerCapture(e.pointerId);
          zug.current = { x: e.clientX, y: e.clientY, t: e.timeStamp, typ: e.pointerType };
        }}
        onPointerUp={hoch} onPointerCancel={() => { zug.current = null; }}
        onKeyDown={(e) => {
          if (STILL.has(e.key)) return;
          const a = tastenAktion(e.key);
          e.preventDefault();
          melden(a, a ? `Taste ${TASTE[e.key] ?? e.key}` : `Taste „${e.key}“ — blättert nicht`);
        }}>
        {meldung ? (
          <div key={meldung.n} className="wisch-test-blink" role="status">
            <p className={`wisch-test-gross ${meldung.aktion ? '' : 'gedaempft'}`}>{meldung.aktion ? ZIEL[meldung.aktion] : '—'}</p>
            <p className="text-sm">{meldung.text}</p>
          </div>
        ) : (
          <p className="gedaempft text-sm">Hier ausprobieren</p>
        )}
      </div>
      <p className="gedaempft text-xs tabular-nums">Weiter {zahl.weiter} · zurück {zahl.zurueck}</p>
    </section>
  );
}
