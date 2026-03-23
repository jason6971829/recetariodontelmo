"use client";
import { useState, useEffect, useCallback } from "react";
import { savePasskey, getPasskeyUser } from "@/lib/storage";

// Convierte ArrayBuffer a string base64url
function bufferToBase64url(buffer) {
  const bytes = new Uint8Array(buffer);
  let str = "";
  bytes.forEach(b => str += String.fromCharCode(b));
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Convierte string base64url a ArrayBuffer
function base64urlToBuffer(base64url) {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4 === 0 ? "" : "=".repeat(4 - (base64.length % 4));
  const binary = atob(base64 + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

const STORAGE_KEY = "dontelmo:passkey_credential_id";

export function useWebAuthn() {
  const [isSupported, setIsSupported] = useState(false);
  const [hasCredential, setHasCredential] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const supported = !!window.PublicKeyCredential;
    setIsSupported(supported);
    const savedId = localStorage.getItem(STORAGE_KEY);
    setHasCredential(!!savedId);
  }, []);

  // Registrar credencial biométrica después del login
  const register = useCallback(async (user) => {
    try {
      // Generar challenge aleatorio
      const challenge = crypto.getRandomValues(new Uint8Array(32));

      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: {
            name: "Recetario Don Telmo",
            id: window.location.hostname,
          },
          user: {
            id: new TextEncoder().encode(String(user.id)),
            name: user.username,
            displayName: user.name,
          },
          pubKeyCredParams: [
            { alg: -7, type: "public-key" },   // ES256
            { alg: -257, type: "public-key" },  // RS256
          ],
          authenticatorSelection: {
            authenticatorAttachment: "platform", // Solo biométrico del dispositivo
            userVerification: "required",
          },
          timeout: 60000,
        },
      });

      if (!credential) return false;

      const credentialId = bufferToBase64url(credential.rawId);

      // Guardar en Supabase
      const saved = await savePasskey(credentialId, user.id);
      if (!saved) return false;

      // Guardar en localStorage para saber que hay una credencial
      localStorage.setItem(STORAGE_KEY, credentialId);
      setHasCredential(true);

      return true;
    } catch (err) {
      console.error("WebAuthn register error:", err);
      return false;
    }
  }, []);

  // Autenticar con biometría
  const authenticate = useCallback(async () => {
    try {
      const savedCredentialId = localStorage.getItem(STORAGE_KEY);
      if (!savedCredentialId) return null;

      const challenge = crypto.getRandomValues(new Uint8Array(32));

      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge,
          rpId: window.location.hostname,
          allowCredentials: [
            {
              id: base64urlToBuffer(savedCredentialId),
              type: "public-key",
              transports: ["internal"],
            },
          ],
          userVerification: "required",
          timeout: 60000,
        },
      });

      if (!assertion) return null;

      // Buscar el usuario asociado a esta credencial en Supabase
      const user = await getPasskeyUser(savedCredentialId);
      return user;
    } catch (err) {
      console.error("WebAuthn auth error:", err);
      // Si falla la credencial, limpiar localStorage
      if (err.name === "InvalidStateError" || err.name === "NotAllowedError") {
        // No limpiar en NotAllowedError porque el usuario puede haber cancelado
      }
      return null;
    }
  }, []);

  // Eliminar credencial guardada
  const clearCredential = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setHasCredential(false);
  }, []);

  return { isSupported, hasCredential, register, authenticate, clearCredential };
}
