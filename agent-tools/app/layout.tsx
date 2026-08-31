import { p } from "../lib/paths";

export const metadata = {
  title: "Funding Tier — Agent Tools",
  description: "Commission tools for Funding Tier sales and enrollment agents.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href={p("/favicon.ico")} sizes="any" />
        <link rel="icon" type="image/png" sizes="32x32" href={p("/favicon-32x32.png")} />
        <link rel="apple-touch-icon" sizes="180x180" href={p("/apple-touch-icon.png")} />
        <meta name="theme-color" content="#0f9b8e" />
      </head>
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}
