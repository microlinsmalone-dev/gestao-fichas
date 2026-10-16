import './globals.css';
import type { Metadata } from 'next';
import { Sidebar } from '../components/sidebar';
import { Header } from '../components/header';
import { DialogProvider } from '../components/ui/dialog';

export const metadata: Metadata = {
  title: 'Sistema de Fichas Pedagógicas • Microlins Potirendaba',
  description: 'Gestão, acompanhamento individual e emissão de fichas pedagógicas A4',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="flex min-h-screen bg-[#f8fafd] text-slate-900 antialiased font-sans">
        <DialogProvider>
          {/* Sidebar - Desktop */}
          <Sidebar />

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <Header />
            <main className="flex-1 overflow-y-auto">
              {children}
            </main>
          </div>
        </DialogProvider>
      </body>
    </html>
  );
}
