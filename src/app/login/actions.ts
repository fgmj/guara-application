"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";

export type LoginState = { error?: string; email?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  try {
    await signIn("credentials", {
      email,
      password: formData.get("password"),
      redirectTo: "/",
    });
    return {};
  } catch (error) {
    if (error instanceof AuthError) {
      // Devolve o e-mail para o formulário não perdê-lo (o React limpa o form após a action)
      return { error: "E-mail ou senha inválidos.", email };
    }
    throw error; // o redirect do Next é lançado como exceção
  }
}
