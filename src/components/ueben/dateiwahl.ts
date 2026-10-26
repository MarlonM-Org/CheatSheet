// Dateiwahl über ein unsichtbares <input type="file">: Bricht man den Dialog
// ab, meldet der Browser „cancel“ (Safari ab 16.4, Chrome ab 113, Firefox ab
// 91). Nur wer das Ereignis nicht kennt, braucht den alten Behelf: Kommt das
// Fenster ohne Auswahl zurück, nach einer Weile als Abbruch werten. Für alle
// anderen wäre der Behelf schädlich — nach der Kamera auf dem Telefon kommt
// das Bild mitunter erst Sekunden nach dem Fokus, und der Behelf hätte die
// Wahl längst als Abbruch verbucht (nichts passierte).
export function ohneCancelAbbrechen(input: HTMLInputElement, abbrechen: () => void, wartezeit = 1500) {
  if ('oncancel' in (input as object)) return;
  window.addEventListener('focus', () => window.setTimeout(() => { if (!input.files?.length) abbrechen(); }, wartezeit), { once: true });
}
