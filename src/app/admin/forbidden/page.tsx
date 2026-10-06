import Link from "next/link";
export default function Forbidden(){return <main className="wrap page"><section className="formcard"><h1>You don’t have access</h1><p>Your account does not have permission to view this page.</p><Link className="btn" href="/">Return home</Link></section></main>}
