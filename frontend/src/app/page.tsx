import { AppShell } from "@/components/app-shell";

export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-3xl font-semibold">Borgen</h1>
      <AppShell />
    </main>
  );
}
