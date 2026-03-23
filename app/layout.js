export const metadata = {
  title: "Recetario Don Telmo",
  description: "Recetario digital Don Telmo 1958",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
