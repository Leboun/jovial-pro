// Petit emetteur pour declencher la transition "sting" du logo Jovial
// par-dessus l'app (ecran de connexion -> dashboard).
type Listener = (destination: string) => void;

let listener: Listener | null = null;

/** Enregistre (ou retire avec null) le composant overlay qui joue la transition. */
export function registerLogoTransition(cb: Listener | null) {
  listener = cb;
}

/** Declenche la transition vers `destination`. Si aucun overlay n'est monte,
 *  retourne false pour que l'appelant puisse naviguer normalement. */
export function playLogoTransition(destination: string): boolean {
  if (listener) {
    listener(destination);
    return true;
  }
  return false;
}
