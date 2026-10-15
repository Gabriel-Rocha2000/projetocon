"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { ensureUser } from "@/services/firestore";
import { useAuth } from "@/contexts/AuthContext";

function firebaseErrorMessage(code?: string) {
  switch (code) {
    case "auth/invalid-credential":
      return "Credencial inválida. Confira se este site está conectado ao mesmo projeto Firebase onde sua conta foi criada.";

    case "auth/user-not-found":
      return "Usuário não encontrado neste projeto Firebase.";

    case "auth/wrong-password":
      return "Senha incorreta.";

    case "auth/invalid-email":
      return "O endereço de e-mail informado é inválido.";

    case "auth/user-disabled":
      return "Este usuário está desativado no Firebase.";

    case "auth/too-many-requests":
      return "Muitas tentativas de login. Aguarde alguns minutos e tente novamente.";

    case "auth/unauthorized-domain":
      return "Este domínio da Vercel ainda não está autorizado no Firebase.";

    case "auth/invalid-api-key":
      return "A chave da API do Firebase configurada na Vercel é inválida.";

    case "auth/network-request-failed":
      return "Falha de conexão com o Firebase. Verifique sua internet e tente novamente.";

    case "auth/missing-password":
      return "Digite sua senha.";

    case "auth/weak-password":
      return "A senha precisa ter pelo menos 6 caracteres.";

    case "auth/email-already-in-use":
      return "Já existe uma conta com este e-mail.";

    default:
      return "Não foi possível autenticar.";
  }
}

export default function LoginPage() {
  const router = useRouter();

  const {
    user,
    loading: authLoading,
  } = useAuth();

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [error, setError] =
    useState("");

  const [errorCode, setErrorCode] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  useEffect(() => {
    if (
      !authLoading &&
      user
    ) {
      router.replace(
        "/dashboard"
      );
    }
  }, [
    user,
    authLoading,
    router,
  ]);

  async function login() {
    const cleanEmail =
      email.trim().toLowerCase();

    if (
      !cleanEmail ||
      !password
    ) {
      setError(
        "Preencha o e-mail e a senha."
      );

      return;
    }

    setLoading(true);
    setError("");
    setErrorCode("");
    setMessage("");

    try {
      const credential =
        await signInWithEmailAndPassword(
          auth,
          cleanEmail,
          password
        );

      await ensureUser(
        credential.user.uid,
        credential.user.email
      );

      router.replace(
        "/dashboard"
      );
    } catch (e: any) {
      console.error(
        "Erro no login Firebase:",
        e
      );

      const code =
        e?.code ||
        "erro-desconhecido";

      setErrorCode(code);

      setError(
        firebaseErrorMessage(
          code
        )
      );
    } finally {
      setLoading(false);
    }
  }

  async function resetPassword() {
    const cleanEmail =
      email.trim().toLowerCase();

    if (!cleanEmail) {
      setError(
        "Digite seu e-mail primeiro."
      );

      return;
    }

    setLoading(true);
    setError("");
    setErrorCode("");
    setMessage("");

    try {
      await sendPasswordResetEmail(
        auth,
        cleanEmail
      );

      setMessage(
        "E-mail para redefinição de senha enviado. Confira também a pasta de spam."
      );
    } catch (e: any) {
      console.error(
        "Erro ao redefinir senha:",
        e
      );

      const code =
        e?.code ||
        "erro-desconhecido";

      setErrorCode(code);

      setError(
        firebaseErrorMessage(
          code
        )
      );
    } finally {
      setLoading(false);
    }
  }

  async function createAccount() {
    const cleanEmail =
      email.trim().toLowerCase();

    setLoading(true);
    setError("");
    setErrorCode("");
    setMessage("");

    try {
      const credential =
        await createUserWithEmailAndPassword(
          auth,
          cleanEmail,
          password
        );

      await ensureUser(
        credential.user.uid,
        credential.user.email
      );

      router.replace(
        "/dashboard"
      );
    } catch (e: any) {
      console.error(
        "Erro ao criar conta Firebase:",
        e
      );

      const code =
        e?.code ||
        "erro-desconhecido";

      setErrorCode(code);

      setError(
        firebaseErrorMessage(
          code
        )
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="loginPage">
      <div className="loginCard">
        <div className="loginLogo">
          📚
        </div>

        <h1>
          Projeto Fazenda
        </h1>

        <p className="muted">
          Seu plano diário adaptativo de estudos para concursos.
        </p>

        <div className="loginForm">
          <label>
            E-mail
          </label>

          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={e =>
              setEmail(
                e.target.value
              )
            }
          />

          <label>
            Senha
          </label>

          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={e =>
              setPassword(
                e.target.value
              )
            }
            onKeyDown={e => {
              if (
                e.key ===
                "Enter"
              ) {
                login();
              }
            }}
          />

          {error && (
            <div className="loginError">
              <strong>
                {error}
              </strong>

              {errorCode && (
                <div
                  style={{
                    marginTop:
                      "6px",
                    fontSize:
                      "12px",
                    opacity:
                      0.8,
                  }}
                >
                  Código:{" "}
                  {errorCode}
                </div>
              )}
            </div>
          )}

          {message && (
            <div className="statusBox">
              {message}
            </div>
          )}

          <button
            className="button"
            onClick={login}
            disabled={
              loading
            }
          >
            {loading
              ? "Carregando..."
              : "Entrar"}
          </button>

          <button
            type="button"
            className="button secondary"
            onClick={
              resetPassword
            }
            disabled={
              loading
            }
          >
            Esqueci minha senha
          </button>

          <button
            type="button"
            className="button secondary"
            onClick={
              createAccount
            }
            disabled={
              loading
            }
          >
            Criar conta
          </button>
        </div>
      </div>
    </main>
  );
}
