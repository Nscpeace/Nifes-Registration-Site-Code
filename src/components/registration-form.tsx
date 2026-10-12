"use client";

import Link from "next/link";
import QRCode from "qrcode";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";

type RegistrationResult = { memberId: string; name: string; qr: string; emailSent: boolean };

export function RegistrationForm() {
  const [heardAbout, setHeardAbout] = useState("");
  const [level, setLevel] = useState("");
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
    body.heardAbout = heardAbout;
    body.level = level;

    if (!heardAbout) {
      setError("Please select how you heard about us.");
      setBusy(false);
      return;
    }
    if (!level) {
      setError("Please select your university level or 'Not a Student'.");
      setBusy(false);
      return;
    }

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
          <span className="eyebrow eyebrow-light">Your NIFES journey starts here</span>
          <h2>There’s a place for you.</h2>
          <p>
            Share a few details to register with the fellowship. We’ll keep your information private and help you get connected.
          </p>
          <div className="registration-perks">
            <div className="perk-item">
              <span className="perk-bullet">✦</span>
              <span>Instant personal Member ID & QR Code</span>
            </div>
            <div className="perk-item">
              <span className="perk-bullet">✦</span>
              <span>Fast-track check-in for weekly fellowship services</span>
            </div>
            <div className="perk-item">
              <span className="perk-bullet">✦</span>
              <span>Warm integration with campus student leaders</span>
            </div>
          </div>
          <p className="registration-note">
            Already a member? <Link href="/check-in">Go to check-in</Link>
          </p>
        </div>

        {result ? (
          <div className="registration-card thank-you" role="status" aria-live="polite">
            <div className="thank-you-mark" aria-hidden="true">✓</div>
            <span className="eyebrow eyebrow-light">Registration complete</span>
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

            <fieldset className="choice-field">
              <legend>Gender</legend>
              <label><input required type="radio" name="gender" value="Male" /> Male</label>
              <label><input type="radio" name="gender" value="Female" /> Female</label>
            </fieldset>

            <Field
              label="Date of birth"
              name="dateOfBirth"
              type="date"
              required={false}
              placeholder="YYYY-MM-DD"
            />

            <Field label="Email address" name="email" type="email" placeholder="name@example.com" />
            <Field label="Place of residence" name="placeOfResidence" placeholder="Hall of residence or off-campus area" />

            {/* Animated Dropdown 1: How heard */}
            <div className="form-field">
              <label id="label-heardAbout">How did you hear about us?</label>
              <AnimatedSelect
                labelId="label-heardAbout"
                value={heardAbout}
                placeholder="Select an option"
                onChange={(val) => setHeardAbout(val)}
                options={[
                  { value: "Friend", label: "Invited by a friend" },
                  { value: "WhatsApp", label: "WhatsApp status / group" },
                  { value: "Instagram", label: "Instagram page" },
                  { value: "Flier", label: "Campus flier / poster" },
                  { value: "Other", label: "Other" },
                ]}
              />
              <input type="hidden" name="heardAbout" value={heardAbout} />
            </div>

            <AnimatePresence>
              {heardAbout === "Other" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Field label="Please tell us more" name="heardAboutOther" required placeholder="How did you hear about NIFES?" />
                </motion.div>
              )}
            </AnimatePresence>

            <fieldset className="choice-field">
              <legend>Is this your first time worshipping with us?</legend>
              <label><input required type="radio" name="firstTimer" value="Yes" /> Yes</label>
              <label><input type="radio" name="firstTimer" value="No" /> No</label>
            </fieldset>

            <Field label="Phone number" name="phone" type="tel" placeholder="080…, 070… or +234…" />

            {/* Animated Dropdown 2: Level */}
            <div className="form-field">
              <label id="label-level">University level / Status</label>
              <AnimatedSelect
                labelId="label-level"
                value={level}
                placeholder="Select your level or Not a Student"
                onChange={(val) => setLevel(val)}
                options={[
                  { value: "L100", label: "100 Level (Freshman)" },
                  { value: "L200", label: "200 Level" },
                  { value: "L300", label: "300 Level" },
                  { value: "L400", label: "400 Level" },
                  { value: "L500", label: "500 Level" },
                  { value: "L600", label: "600 Level (Clinical / Pharmacy)" },
                  { value: "POSTGRADUATE", label: "Postgraduate" },
                  { value: "NON_STUDENT", label: "Not a Student" },
                ]}
              />
              <input type="hidden" name="level" value={level} />
            </div>

            <label className="consent-check">
              <input type="checkbox" name="consent" required />
              <span>I agree to NIFES UNIBEN storing my details for fellowship records.</span>
            </label>

            <button className="button button-primary submit-button" disabled={busy}>
              {busy ? "Registering…" : "Complete registration"}
            </button>
            <p className="form-privacy">
              Your information is handled according to our <Link href="/privacy">Privacy Notice</Link>.
            </p>
          </form>
        )}
      </div>
    </section>
  );
}

function Field({ label, name, type = "text", placeholder, required = true }: { label: string; name: string; type?: string; placeholder?: string; required?: boolean }) {
  return (
    <div className="form-field">
      <label htmlFor={name}>{label}</label>
      <input id={name} name={name} type={type} placeholder={placeholder} required={required} maxLength={254} />
    </div>
  );
}

function AnimatedSelect({
  value,
  placeholder,
  onChange,
  options,
  labelId,
}: {
  value: string;
  placeholder: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
  labelId?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const selected = options.find((o) => o.value === value);

  return (
    <div className="animated-select-container" ref={ref}>
      <button
        type="button"
        className={`animated-select-trigger ${open ? "is-open" : ""}`}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={labelId}
      >
        <span className={selected ? "selected-text" : "placeholder-text"}>
          {selected ? selected.label : placeholder}
        </span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="select-chevron"
        >
          ▾
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            className="animated-select-options"
            role="listbox"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            {options.map((opt, i) => (
              <motion.li
                key={opt.value}
                role="option"
                aria-selected={opt.value === value}
                className={`animated-select-option ${opt.value === value ? "is-active" : ""}`}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03, duration: 0.18 }}
                whileHover={{ x: 4, backgroundColor: "#ebf5ff" }}
                whileTap={{ scale: 0.98 }}
              >
                <span>{opt.label}</span>
                {opt.value === value && <span className="option-check">✓</span>}
              </motion.li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
