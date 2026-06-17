// Petit bus d'evenements interne pour signaler un changement de notifications
// (marquage "lu" depuis l'ecran Notifications) au badge de la barre d'onglets,
// sans dependre du temps reel Supabase.

type Listener = () => void;
const listeners = new Set<Listener>();

/** S'abonne aux changements de notifications. Retourne une fonction de desabonnement. */
export function onNotificationsChanged(cb: Listener): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** Signale que les notifications ont change (a appeler apres un marquage "lu"). */
export function emitNotificationsChanged(): void {
  listeners.forEach((cb) => {
    try {
      cb();
    } catch {
      /* noop */
    }
  });
}
