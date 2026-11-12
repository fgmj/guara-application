import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-stone-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-brand">Guará</h1>
        <p className="mb-6 text-sm text-stone-500">Acesse sua conta</p>
        <LoginForm />
      </div>
    </main>
  );
}
