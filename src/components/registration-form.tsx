"use client";

import Link from "next/link";
import QRCode from "qrcode";
import { useState } from "react";

type RegistrationResult = { memberId: string; name: string; qr: string; emailSent: boolean };

export function RegistrationForm() {
  const [other, setOther] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<RegistrationResult | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(form.entries()) as Record<string, string | boolean>;
    body.consent = form.get("consent") === "on";
    body.firstTimer = String(form.get("firstTimer") || "");

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      const qr = await QRCode.toDataURL(data.memberId, {
        width: 300,
        margin: 2,
        color: { dark: "#07152b", light: "#ffffff" },
      });
      setResult({ ...data, qr });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Registration failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="registration-section" id="register">
      <div className="site-container registration-layout">
        <div className="registration-copy">
          <span className="eyebrow">Your NIFES journey starts here</span>
          <h2>There’s a place for you.</h2>
          <p>Share a few details to register with the fellowship. We’ll keep your information private and help you get connected.</p>
          <p className="registration-note">Already a member? <Link href="/check-in">Go to check-in</Link></p>
        </div>

        {result ? (
          <div className="registration-card thank-you" role="status" aria-live="polite">
            <div className="thank-you-mark" aria-hidden="true">✓</div>
            <span className="eyebrow">Registration complete</span>
            <h2>Thanks for reaching out, {result.name}!</h2>
            <p>Your member ID is <strong>{result.memberId}</strong>. Save your QR code for check-in.</p>
            <img src={result.qr} alt="Your personal check-in QR code" width="180" height="180" />
            <a className="button button-primary" download={`${result.memberId}.png`} href={result.qr}>Download QR code</a>
            <p className="registration-note">{result.emailSent ? "We also emailed your QR code." : "You can download your QR code above."}</p>
          </div>
        ) : (
          <form className="registration-card" onSubmit={submit}>
            <h3>Register with us</h3>
            <p className="form-intro">All fields are required unless marked optional.</p>
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="form-row">
              <Field label="First name" name="firstName" />
              <Field label="Last name" name="lastName" />
            </div>
            <fieldset className="choice-field"><legend>Gender</legend><label><input required type="radio" name="gender" value="Male" /> Male</label><label><input type="radio" name="gender" value="Female" /> Female</label></fieldset>
            <Field label="Email address" name="email" type="email" />
            <Field label="Place of residence" name="placeOfResidence" />
            <div className="form-field"><label htmlFor="heardAbout">How did you hear about us?</label><select id="heardAbout" name="heardAbout" required onChange={(event) => setOther(event.target.value === "Other")} defaultValue=""><option value="" disabled>Select one</option>{["Friend", "WhatsApp", "Instagram", "Flier", "Other"].map((item) => <option key={item}>{item}</option>)}</select></div>
            {other && <Field label="Please tell us more" name="heardAboutOther" required />}
            <fieldset className="choice-field"><legend>Is this your first time?</legend><label><input required type="radio" name="firstTimer" value="Yes" /> Yes</label><label><input type="radio" name="firstTimer" value="No" /> No</label></fieldset>
            <Field label="Phone number" name="phone" type="tel" placeholder="080…, 070… or +234…" />
            <div className="form-field"><label htmlFor="level">University level</label><select id="level" name="level" required defaultValue=""><option value="" disabled>Select level</option>{[["L100", "100 level"], ["L200", "200 level"], ["L300", "300 level"], ["L400", "400 level"], ["L500", "500 level"], ["L600", "600 level"], ["POSTGRADUATE", "Postgraduate"]].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
            <label className="consent-check"><input type="checkbox" name="consent" required /> I agree to NIFES UNIBEN storing my details for fellowship records.</label>
            <button className="button button-primary submit-button" disabled={busy}>{busy ? "Registering…" : "Complete registration"}</button>
            <p className="form-privacy">Your information is handled according to our <Link href="/privacy">Privacy Notice</Link>.</p>
          </form>
        )}
      </div>
    </section>
  );
}

function Field({ label, name, type = "text", placeholder, required = true }: { label: string; name: string; type?: string; placeholder?: string; required?: boolean }) {
  return <div className="form-field"><label htmlFor={name}>{label}</label><input id={name} name={name} type={type} placeholder={placeholder} required={required} maxLength={254} /></div>;
}
