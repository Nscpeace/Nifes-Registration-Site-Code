import Link from "next/link";

export default function NotFound() {
  return (
    <main className="wrap page" style={{ textAlign: "center", padding: "60px 20px" }}>
      <h1 style={{ fontSize: "2rem", marginBottom: "12px" }}>404 - Page Not Found</h1>
      <p className="muted" style={{ marginBottom: "24px" }}>
        The page you are looking for does not exist or has been moved.
      </p>
      <Link href="/" className="button button-primary">
        Return Home
      </Link>
    </main>
  );
}
