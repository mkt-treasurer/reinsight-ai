"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import LockScreen from "./LockScreen";

const STORAGE_KEY = "reinsai_unlocked";

export default function LockGate({ children }: { children: React.ReactNode }) {
  // null = haven't checked storage yet (SSR safe); false = locked; true = unlocked
  const [unlocked, setUnlocked] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      setUnlocked(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      setUnlocked(false);
    }
  }, []);

  const handleUnlock = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore storage errors; session-only unlock
    }
    setUnlocked(true);
  };

  // Before hydration check, render nothing to avoid a flash of unlocked content
  if (unlocked === null) {
    return (
      <div className="fixed inset-0 z-[100] bg-slate-950" aria-hidden />
    );
  }

  return (
    <>
      {/* Children always mount so the blurred backdrop is the real page */}
      <motion.div
        animate={{
          filter: unlocked ? "blur(0px)" : "blur(18px)",
          scale: unlocked ? 1 : 1.02,
        }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        style={{ transformOrigin: "center" }}
        aria-hidden={!unlocked}
      >
        {children}
      </motion.div>
      {!unlocked && <LockScreen onUnlock={handleUnlock} />}
    </>
  );
}
