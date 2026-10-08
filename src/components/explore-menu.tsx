"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";

const menuItems = [
  { href: "/#about", label: "About Us", desc: "Our mission, vision and home at UNIBEN" },
  { href: "/#programs", label: "Programs", desc: "Weekly services, studies and gatherings" },
  { href: "/records", label: "Member's Records", desc: "Secure portal for admin & members" },
  { href: "/check-in", label: "Self Check-In", desc: "Fast service check-in with Phone or ID" },
  { href: "/#register", label: "Register as Member", desc: "Join the NIFES UNIBEN fellowship" },
];

export function ExploreMenu() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="explore-menu" ref={containerRef}>
      <motion.button
        className="explore-trigger"
        type="button"
        aria-expanded={open}
        aria-controls="explore-options"
        onClick={() => setOpen((value) => !value)}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
      >
        <span>Explore</span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          style={{ display: "inline-block", fontSize: "0.85rem" }}
        >
          ▼
        </motion.span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.nav
            className="explore-options"
            id="explore-options"
            aria-label="Explore NIFES UNIBEN"
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            {menuItems.map((item, index) => (
              <motion.div
                key={item.href}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.04, duration: 0.2 }}
                whileHover={{ x: 4 }}
              >
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="explore-link-item"
                >
                  <span className="explore-link-title">{item.label}</span>
                  <span className="explore-link-desc">{item.desc}</span>
                </Link>
              </motion.div>
            ))}
          </motion.nav>
        )}
      </AnimatePresence>
    </div>
  );
}
