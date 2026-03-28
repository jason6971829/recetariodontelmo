import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function POST(req) {
  try {
    const { email } = await req.json();
    if (!email) return NextResponse.json({ ok: false, error: "email_required" }, { status: 400 });

    // 1. Cargar perfil guardado
    const { data: urlData } = supabaseAdmin.storage
      .from("recipe-images")
      .getPublicUrl("profile/config.json");

    const profileRes = await fetch(urlData.publicUrl + "?t=" + Date.now());
    if (!profileRes.ok) return NextResponse.json({ ok: false, error: "no_profile" }, { status: 404 });

    const profile = await profileRes.json();
    const storedEmail = (profile.email || "").trim().toLowerCase();
    const inputEmail  = email.trim().toLowerCase();

    if (storedEmail !== inputEmail) {
      return NextResponse.json({ ok: false, error: "email_not_found" }, { status: 404 });
    }

    // 2. Obtener usuarios admin de Supabase
    const { data: users } = await supabaseAdmin.from("users").select("username, password, name, role");
    const admins = (users || []).filter(u => u.role === "admin");

    // 3. Construir cuerpo del correo
    const credsList = admins.map(u =>
      `• Usuario: ${u.username}  |  Contraseña: ${u.password}  |  Nombre: ${u.name}`
    ).join("\n");

    const bodyText = `
Hola ${profile.name || ""},

Recibiste este correo porque solicitaste recuperar el acceso al Recetario Digital.

CREDENCIALES DE ADMINISTRADOR
──────────────────────────────
${credsList}
──────────────────────────────

Si no solicitaste esto, ignora este correo.

— Recetario Digital Don Telmo
    `.trim();

    // 4. Enviar correo via Gmail SMTP
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: `"Recetario Digital" <${process.env.SMTP_USER}>`,
      to: storedEmail,
      subject: "🔑 Recuperación de acceso — Recetario Digital",
      text: bodyText,
      html: `
        <div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;background:#f9f6f0;border-radius:16px;overflow:hidden;">
          <div style="background:#1B3A5C;padding:28px 32px;text-align:center;">
            <div style="font-size:36px;margin-bottom:8px;">🍽️</div>
            <div style="color:#D4721A;font-size:11px;letter-spacing:4px;font-weight:700;">RECETARIO DIGITAL</div>
            <div style="color:#fff;font-size:22px;font-weight:700;margin-top:4px;">Don Telmo®</div>
          </div>
          <div style="padding:32px;">
            <h2 style="color:#1B3A5C;margin-top:0;">Recuperación de acceso</h2>
            <p style="color:#555;">Hola <strong>${profile.name || ""}</strong>,<br>
            Aquí están tus credenciales de administrador:</p>
            <div style="background:#fff;border:2px solid #E0D8CE;border-radius:12px;padding:20px;margin:20px 0;">
              ${admins.map(u => `
                <div style="margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid #eee;">
                  <div style="font-size:12px;color:#888;letter-spacing:1px;text-transform:uppercase;">Usuario</div>
                  <div style="font-size:18px;font-weight:700;color:#1B3A5C;">${u.username}</div>
                  <div style="font-size:12px;color:#888;letter-spacing:1px;text-transform:uppercase;margin-top:8px;">Contraseña</div>
                  <div style="font-size:18px;font-weight:700;color:#D4721A;">${u.password}</div>
                </div>
              `).join("")}
            </div>
            <p style="color:#999;font-size:12px;">Si no solicitaste esto, ignora este correo.</p>
          </div>
        </div>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("recover error:", err);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
