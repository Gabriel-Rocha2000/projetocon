import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { ContestProvider } from "@/contexts/ContestContext";

export const metadata = {
  title: "Concurseiro CLT",
  description: "Sistema adaptativo de estudos para concursos",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <AuthProvider>
          <ContestProvider>{children}</ContestProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
