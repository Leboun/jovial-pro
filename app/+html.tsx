import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

// Couleur du bandeau status bar (heure, batterie, réseau) sur mobile web
const STATUS_BAR_COLOR = "#F2EDE4";

/**
 * Template HTML racine de l'app web.
 * Ajoute le theme-color (couleur du bandeau système sur mobile),
 * le viewport-fit=cover (pour que env(safe-area-inset-top) fonctionne),
 * et un fond beige sur la zone safe-area du haut.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />

        {/* viewport-fit=cover : permet à l'app de gérer elle-même la safe area */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />

        {/* Couleur du bandeau système sur Android Chrome et Safari iOS (PWA) */}
        <meta name="theme-color" content={STATUS_BAR_COLOR} />

        {/* PWA iOS — statut bar style "default" = icônes sombres sur fond clair */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />

        <title>Jovial</title>
        <link rel="icon" href="/favicon.ico" />

        <ScrollViewStyleReset />

        <style dangerouslySetInnerHTML={{
          __html: `
            html, body {
              height: 100%;
              margin: 0;
              padding: 0;
              background-color: ${STATUS_BAR_COLOR};
            }
            body {
              overflow: hidden;
            }
            #root {
              display: flex;
              height: 100%;
              flex: 1;
              /* Pousse le contenu sous la barre système sur iOS Safari standalone */
              padding-top: env(safe-area-inset-top);
              background-color: ${STATUS_BAR_COLOR};
              box-sizing: border-box;
            }
          `
        }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
