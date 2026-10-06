"use client";

import Link from "next/link";
import { useState } from "react";

export function ExploreMenu() {
  const [open, setOpen] = useState(false);
  return (
    <div className="explore-menu">
      <button className="explore-trigger" type="button" aria-expanded={open} aria-controls="explore-options" onClick={() => setOpen((value) => !value)}>
        Explore <span aria-hidden="true">{open ? "⌃" : "⌄"}</span>
      </button>
      {open && (
        <nav className="explore-options" id="explore-options" aria-label="Explore NIFES UNIBEN">
          <Link href="/#about" onClick={() => setOpen(false)}>About Us</Link>
          <Link href="/#programs" onClick={() => setOpen(false)}>Programs</Link>
          <Link href="/records" onClick={() => setOpen(false)}>Member&apos;s Records</Link>
        </nav>
      )}
    </div>
  );
}
