'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { insBild, type Lage } from '@/domain/lage';
import { gespeichert, speichern } from './klang';

// Frei schiebbare Panels (B-03): Am Kopf anfassen und über den ganzen
// Bildschirm ziehen, damit die Noten lesbar bleiben. Ohne gemerkte Lage
// sitzt das Panel im Dock über der Leiste; Ablegen nahe der Leiste dockt
// wieder an. Die Lage wird je Panel gemerkt und bleibt im Bild — beim
// Erscheinen und wenn sich die Fenstergröße ändert.
//
// `grenze`: die Leiste, über der das Panel bleibt (Auswahl-Selektor; im
// Komponier-Dialog der Fuß mit „Speichern“). `schwebBreite`: wie breit das
// Panel wird, wenn es sich aus dem vollbreiten Dock löst (null: es bleibt
// so breit, wie es ist — der Griffpunkt bleibt dann unter dem Finger).

export type { Lage };

export interface SchiebOptionen { grenze?: string; schwebBreite?: number | null }

// Wer zuletzt angefasst wurde, liegt über dem anderen Panel.
let stapel = 0;

export function useSchiebbar<T extends HTMLElement = HTMLElement>(schluessel: string, { grenze = '.leiste', schwebBreite = 380 }: SchiebOptionen = {}) {
  const panel = useRef<T | null>(null);
  const [lage, setLage] = useState<Lage | null>(() => gespeichert<Lage | null>(schluessel, null));
  const [ebene, setEbene] = useState(0);
  const zug = useRef<{ id: number; dx: number; dy: number; startX: number; startY: number; gezogen: boolean } | null>(null);

  // Ins Bild heißt: über der unteren Leiste — dahinter wäre das Panel
  // verdeckt und nicht antippbar.
  const klemmen = useCallback((x: number, y: number): Lage => {
    const el = panel.current;
    const leiste = document.querySelector(grenze)?.getBoundingClientRect();
    const unten = leiste && leiste.height > 0 ? Math.min(leiste.top, window.innerHeight) : window.innerHeight;
    return insBild({ x, y }, { b: el?.offsetWidth ?? 320, h: el?.offsetHeight ?? 160 }, { b: window.innerWidth, h: unten });
  }, [grenze]);

  const anfassen = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button, input, a, select')) return;
    const el = panel.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    zug.current = { id: e.pointerId, dx: e.clientX - r.left, dy: e.clientY - r.top, startX: e.clientX, startY: e.clientY, gezogen: false };
    setEbene(++stapel);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const bewegen = useCallback((e: React.PointerEvent) => {
    const z = zug.current;
    if (!z || e.pointerId !== z.id) return;
    if (!z.gezogen) {
      if (Math.hypot(e.clientX - z.startX, e.clientY - z.startY) < 5) return;
      z.gezogen = true;
      // Beim Lösen aus dem vollbreiten Dock wird das Panel schmaler —
      // Griffpunkt in die Panel-Mitte legen, sonst springt es weg.
      if (schwebBreite !== null) {
        const breite = Math.min(schwebBreite, window.innerWidth - 16);
        if (z.dx > breite - 24) z.dx = breite / 2;
      }
    }
    setLage(klemmen(e.clientX - z.dx, e.clientY - z.dy));
  }, [klemmen, schwebBreite]);

  const loslassen = useCallback(() => {
    const z = zug.current;
    zug.current = null;
    if (!z?.gezogen) return;
    const el = panel.current;
    if (!el) return;
    const leisteOben = document.querySelector(grenze)?.getBoundingClientRect().top ?? window.innerHeight;
    if (el.getBoundingClientRect().bottom > leisteOben - 12) {
      // Nahe der Leiste abgelegt: wieder andocken.
      setLage(null);
      speichern(schluessel, null);
    } else {
      const r = el.getBoundingClientRect();
      speichern(schluessel, { x: Math.round(r.left), y: Math.round(r.top) });
    }
  }, [schluessel, grenze]);

  // Beim Erscheinen und wenn das Panel wächst: Die gemerkte Lage kann aus
  // einem anderen Format stammen (iPad, quer, gedreht, während das Panel zu
  // war) und läge sonst außerhalb — das Panel wäre unsichtbar. Der Beobachter
  // meldet sich gleich nach dem ersten Layout mit der echten Größe.
  useEffect(() => {
    const el = panel.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setLage((l) => {
      if (!l) return l;
      const k = klemmen(l.x, l.y);
      return k.x === l.x && k.y === l.y ? l : k;
    }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [klemmen]);

  // Fenstergröße ändert sich (Drehen, Teilen): gemerkte Lage im Bild halten.
  useEffect(() => {
    const auf = () => setLage((l) => (l ? klemmen(l.x, l.y) : l));
    window.addEventListener('resize', auf);
    return () => window.removeEventListener('resize', auf);
  }, [klemmen]);

  return { panel, lage, ebene, anfassen, bewegen, loslassen };
}
