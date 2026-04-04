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
        <style>{`
          :root { --app-primary: #1B3A5C; --app-primary-dark: #0d2340; --app-primary-light: #8BAACC; --app-primary-rgb: 27,58,92; }
          html, body {
            margin: 0;
            height: 100%;
            overflow: hidden;
            overscroll-behavior-y: none;
          }
        `}</style>
      </head>
      <body style={{ margin: 0, overflow: "hidden", height: "100%", overscrollBehaviorY: "none" }}>
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Altura real del viewport (fix iOS Safari donde 100vh != ventana visible)
              (function() {
                function setAppHeight() {
                  document.documentElement.style.setProperty('--app-height', window.innerHeight + 'px');
                }
                setAppHeight();
                window.addEventListener('resize', setAppHeight);
              })();

              // Bloquear pull-to-refresh en iOS Safari y Chrome Android
              (function() {
                var startY = 0;
                document.addEventListener('touchstart', function(e) {
                  startY = e.touches[0].clientY;
                }, { passive: true });
                document.addEventListener('touchmove', function(e) {
                  var el = e.target;
                  // Buscar si hay un antecesor con scroll propio
                  while (el && el !== document.body) {
                    if (el.scrollHeight > el.clientHeight &&
                        (getComputedStyle(el).overflowY === 'auto' || getComputedStyle(el).overflowY === 'scroll')) {
                      return; // dejar que ese elemento haga scroll interno
                    }
                    el = el.parentElement;
                  }
                  // Si llegamos al body sin encontrar scroll: bloquear
                  if (document.scrollingElement && document.scrollingElement.scrollTop === 0 && e.touches[0].clientY > startY) {
                    e.preventDefault();
                  }
                }, { passive: false });
              })();

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
