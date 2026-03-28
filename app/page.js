"use client";

import App from "@/components/App";
import { LangProvider } from "@/lib/LangContext";

export default function Page() {
  return (
    <LangProvider>
      <App />
    </LangProvider>
  );
}
