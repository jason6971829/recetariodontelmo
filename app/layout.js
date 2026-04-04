export const metadata = {
  title: "Recetario Don Telmo",
  description: "Recetario digital Don Telmo 1958",
  manifest: "/manifest.json",
};

export const viewport = {
  themeColor: "#1B3A5C",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#1B3A5C" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="manifest" href="/manifest.json" />
        <style>{`:root { --app-primary: #1B3A5C; --app-primary-dark: #0d2340; --app-primary-light: #8BAACC; --app-primary-rgb: 27,58,92; }`}</style>
      </head>
      <body style={{ margin: 0 }}>
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js').then((reg) => {

                    // Cuando el SW nuevo termina de instalarse
                    reg.addEventListener('updatefound', () => {
                      const newWorker = reg.installing;
                      newWorker.addEventListener('statechange', () => {
                        // SW nuevo listo y hay uno viejo controlando → reemplazar
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                          newWorker.postMessage({ type: 'SKIP_WAITING' });
                        }
                      });
                    });

                    // Verificar actualizaciones cuando el usuario vuelve a la pestaña
                    document.addEventListener('visibilitychange', () => {
                      if (document.visibilityState === 'visible') reg.update();
                    });

                  }).catch(() => {});

                  // Cuando el SW nuevo toma el control → recargar la página automáticamente
                  navigator.serviceWorker.addEventListener('controllerchange', () => {
                    window.location.reload();
                  });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
