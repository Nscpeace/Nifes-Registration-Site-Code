import Link from "next/link";
import { ExploreMenu } from "@/components/explore-menu";
import { RegistrationForm } from "@/components/registration-form";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type ProgrammeCard = { day: string; title: string; time: string; venue: string; color: string };

const fallbackProgramme: ProgrammeCard[] = [
  { day: "Sunday", title: "Foundation Class", time: "2:30 PM", venue: "FAGCOOP Multipurpose Hall", color: "blue" },
  { day: "Sunday", title: "Sunday Service", time: "3:30 PM", venue: "FAGCOOP Multipurpose Hall", color: "blue" },
  { day: "Tuesday", title: "Prayer Meeting", time: "5:30 PM", venue: "FAGCOOP Multipurpose Hall", color: "amber" },
  { day: "Friday", title: "Bible Study", time: "5:00 PM", venue: "FAGCOOP Multipurpose Hall", color: "coral" },
  { day: "Last Saturday", title: "Mass Evangelism", time: "Time TBA", venue: "FAGCOOP Multipurpose Hall", color: "indigo" },
];

export default async function Home() {
  let programme = fallbackProgramme;
  try {
    const stored = await db.recurringEvent.findMany({ where: { active: true }, orderBy: [{ weekday: "asc" }, { startTime: "asc" }] });
    if (stored.length) {
      programme = stored.map((event) => {
        const day = event.recurrence === "LAST_SATURDAY" ? "Last Saturday" : ({ 0: "Sunday", 2: "Tuesday", 5: "Friday", 6: "Saturday" } as Record<number, string>)[event.weekday ?? -1] ?? "Weekly";
        const [hour, minute] = event.startTime.split(":").map(Number);
        const time = event.timeTBA ? "Time TBA" : `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
        return { day, title: event.name, time, venue: event.venue, color: day === "Sunday" ? "blue" : day === "Tuesday" ? "amber" : day === "Friday" ? "coral" : "indigo" };
      });
    }
  } catch {
    // Falls back gracefully
  }

  return (
    <main>
      <header className="site-header site-container">
        <Link className="site-brand" href="/" aria-label="NIFES UNIBEN home">
          <div className="brand-logo-wrap">
            <img src="/nifes-logo.jpg" alt="NIFES UNIBEN Logo" className="brand-logo-img" width="46" height="46" />
          </div>
          <div className="brand-text">
            <strong>NIFES</strong>
            <span>UNIBEN</span>
          </div>
        </Link>
        <ExploreMenu />
      </header>

      <section className="hero-section" aria-labelledby="hero-title">
        <div className="site-container hero-grid">
          <div className="hero-copy">
            <span className="eyebrow">Nigeria Fellowship of Evangelical Students · UNIBEN</span>
            <p className="hero-kicker">Worship with us</p>
            <h1 id="hero-title">Faith. Purpose.<br /><span>Community.</span></h1>
            <p className="hero-description">Find your people, grow in faith, and build a life of purpose. There’s a seat for you at NIFES UNIBEN.</p>
            <div className="hero-actions">
              <a className="button button-primary" href="#register">Register with us <span aria-hidden="true">↓</span></a>
              <Link className="button button-secondary" href="/check-in">Member check-in</Link>
              <Link className="button button-secondary" href="/records">Member's records</Link>
            </div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="hero-orbit orbit-one" />
            <div className="hero-orbit orbit-two" />
            <div className="hero-logo-badge">
              <img src="/nifes-logo.jpg" alt="NIFES UNIBEN Official Fellowship Logo" width="180" height="180" className="hero-badge-img" />
            </div>
            <div className="hero-caption">Growing together<br /><strong>in Christ</strong></div>
          </div>
        </div>
      </section>

      <section className="about-section" id="about">
        <div className="site-container about-grid">
          <div>
            <span className="eyebrow">Building tomorrow’s leaders today</span>
            <h2>A place to belong<br />and become.</h2>
          </div>
          <div className="about-copy">
            <p>NIFES is a community of students growing together through God’s word, prayer, worship and service. Come as you are and discover what fellowship can mean for your university journey.</p>
            <div className="venue-card">
              <span className="venue-icon" aria-hidden="true">⌖</span>
              <div>
                <strong>Find us at UNIBEN</strong>
                <p>FAGCOOP Multipurpose Hall<br />University of Benin, Ugbowo, Benin City</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="program-section" id="programs">
        <div className="site-container">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Gather with us</span>
              <h2>Our weekly programs</h2>
            </div>
            <span className="section-hint">Scroll to explore <span aria-hidden="true">→</span></span>
          </div>
          <div className="program-strip" aria-label="Weekly NIFES programs">
            {programme.map((event) => (
              <article className="program-card" key={event.title}>
                <span className={`program-day ${event.color}`}>{event.day}</span>
                <h3>{event.title}</h3>
                <p>{event.time}</p>
                <small>{event.venue}</small>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Registration Section is White as explicitly requested */}
      <RegistrationForm />

      <footer className="site-footer">
        <div className="site-container footer-inner">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img src="/nifes-logo.jpg" alt="NIFES UNIBEN Logo" width="28" height="28" style={{ borderRadius: "50%" }} />
            <span>© {new Date().getFullYear()} NIFES UNIBEN</span>
          </div>
          <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
            <Link href="/records">Member's Records</Link>
            <Link href="/check-in">Check-in</Link>
            <Link href="/privacy">Privacy notice</Link>
            <a href="mailto:nifesuniben@example.com">Get in touch</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
