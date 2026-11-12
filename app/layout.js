export const metadata = {
  title: "Recetario Don Telmo",
  description: "Recetario digital Don Telmo 1958",
  manifest: "/manifest.json",
};

export const viewport = {
  themeColor: "#0E2240",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#0E2240" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Newsreader:opsz,wght@6..72,500;6..72,600;6..72,700&display=swap" rel="stylesheet" />
        <style>{`
          :root {
            --app-primary: #0E2240; --app-primary-dark: #091831; --app-primary-light: #9FB3CF; --app-primary-rgb: 14,34,64;
            /* Rediseño Don Telmo: tokens */
            --dt-navy: #0E2240; --dt-navy-700: #16325A; --dt-orange: #D9731A; --dt-orange-400: #E8832B; --dt-orange-300: #F0A35E;
            --dt-orange-700: #B85E10; --dt-orange-100: #FBEBDD; --dt-orange-50: #FFF6EE; --dt-cream: #F6F3EE; --dt-cream-row: #FAF8F4;
            --dt-line: #E7E1D7; --dt-line-soft: #EFEAE2; --dt-ink: #14213D; --dt-ink-2: #3C3A36; --dt-muted: #8A847A; --dt-muted-2: #A39D92;
            --dt-green: #1F9D6B; --dt-green-100: #E7F5EE; --dt-red: #C8423B;
            --dt-serif: Newsreader, Georgia, serif; --dt-sans: Manrope, system-ui, -apple-system, sans-serif;
            --dt-ease: cubic-bezier(.2,.8,.2,1);
          }
          html, body {
            margin: 0;
            height: 100%;
            overflow: hidden;
            overscroll-behavior-y: none;
          }
          body { background: #F6F3EE; color: #14213D; font-family: var(--dt-sans); -webkit-font-smoothing: antialiased; -webkit-tap-highlight-color: transparent; }
          input, select, textarea, button { font-family: inherit; }
          .dt-scope input:focus, .dt-scope select:focus, .dt-scope textarea:focus { outline: none; border-color: #D9731A !important; box-shadow: 0 0 0 4px rgba(217,115,26,.14); }
          ::-webkit-scrollbar { width: 8px; height: 8px; } ::-webkit-scrollbar-thumb { background: rgba(14,34,64,.18); border-radius: 8px; } ::-webkit-scrollbar-track { background: transparent; }
          .dt-noscroll { scrollbar-width: none; } .dt-noscroll::-webkit-scrollbar { display: none; }
          @keyframes dtUp { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: none } }
          @keyframes dtFade { from { opacity: 0 } to { opacity: 1 } }
          @keyframes dtPop { from { opacity: 0; transform: translateY(10px) scale(.97) } to { opacity: 1; transform: none } }
          @keyframes dtSheet { from { transform: translateY(100%) } to { transform: none } }
          @keyframes dtDrop { from { opacity: 0; transform: translateY(-6px) scale(.98) } to { opacity: 1; transform: none } }
          @keyframes dtBreathe { 0%,100% { transform: translate(-50%,-50%) scale(1) } 50% { transform: translate(-50%,-50%) scale(1.03) } }
          @keyframes dtGlow { 0%,100% { opacity: .55 } 50% { opacity: .9 } }
          .dt-card { transition: transform .35s cubic-bezier(.2,.8,.2,1), box-shadow .35s cubic-bezier(.2,.8,.2,1); }
          @media (hover: hover) { .dt-card:hover { transform: translateY(-4px); box-shadow: 0 24px 40px -18px rgba(14,34,64,.35), 0 0 0 1px rgba(217,115,26,.35) !important; }
            .dt-row:hover { box-shadow: 0 0 0 1px rgba(217,115,26,.35) !important; }
            .dt-hov-dark:hover { background: rgba(255,255,255,.08) !important; }
            .dt-hov-light:hover { background: #FAF8F4 !important; }
            .dt-logout:hover { background: #C8423B !important; border-color: #C8423B !important; }
            .dt-login-btn:hover { background: #D9731A !important; transform: translateY(-1px); box-shadow: 0 14px 26px -12px rgba(217,115,26,.6); } }
          @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; } }
        `}</style>
        <script dangerouslySetInnerHTML={{ __html: `
          // Tamaño de vista (A− / A / A+): zoom en <body>. Por defecto 0,88 en celular y 1 en tablet/computador.
          (function(){ try {
            var z = parseFloat(localStorage.getItem('dt_zoom'));
            if (!(z > 0)) z = window.innerWidth < 640 ? 0.88 : 1;
            window.__dtZoom = z;
            document.documentElement.style.setProperty('--dt-zoom', z);
          } catch (e) { window.__dtZoom = 1; } })();
        ` }} />
      </head>
      <body style={{ margin: 0, overflow: "hidden", height: "100%", overscrollBehaviorY: "none", zoom: "var(--dt-zoom, 1)" }}>
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Altura real del viewport (fix iOS Safari donde 100vh != ventana visible)
              (function() {
                function setAppHeight() {
                  // con zoom en <body> la altura disponible en px CSS es innerHeight / zoom
                  document.documentElement.style.setProperty('--app-height', (window.innerHeight / (window.__dtZoom || 1)) + 'px');
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
