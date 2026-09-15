"use client";

import { useState, useRef, useEffect, FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, ArrowRight } from "lucide-react";

const PASSWORD = "reins";

export default function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (unlocking) return;
    if (value.trim().toLowerCase() === PASSWORD) {
      setError(false);
      setUnlocking(true);
      // delay to let the exit animation play; LockGate reads localStorage on flag.
      setTimeout(() => {
        onUnlock();
      }, 900);
    } else {
      setError(true);
      setValue("");
      setTimeout(() => setError(false), 600);
    }
  };

  return (
    <AnimatePresence>
      {!unlocking && (
        <motion.div
          key="lock"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(15,23,42,0.55) 0%, rgba(2,6,23,0.8) 100%)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
          }}
        >
          {/* floating ambient dots */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {Array.from({ length: 18 }).map((_, i) => (
              <motion.span
                key={i}
                className="absolute rounded-full bg-white/20"
                style={{
                  width: 2 + (i % 3),
                  height: 2 + (i % 3),
                  left: `${(i * 53) % 100}%`,
                  top: `${(i * 29) % 100}%`,
                }}
                animate={{
                  y: [0, -20, 0],
                  opacity: [0.2, 0.6, 0.2],
                }}
                transition={{
                  duration: 5 + (i % 4),
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: i * 0.2,
                }}
              />
            ))}
          </div>

          <motion.form
            onSubmit={submit}
            initial={{ y: 18, opacity: 0, scale: 0.96 }}
            animate={
              error
                ? { x: [0, -10, 10, -8, 8, -4, 4, 0], y: 0, opacity: 1, scale: 1 }
                : { x: 0, y: 0, opacity: 1, scale: 1 }
            }
            exit={{ scale: 1.04, opacity: 0, filter: "blur(4px)" }}
            transition={
              error
                ? { duration: 0.45 }
                : { duration: 0.6, ease: [0.16, 1, 0.3, 1] }
            }
            className="relative w-[380px] rounded-2xl border border-white/15 bg-white/[0.06] p-8 shadow-[0_8px_60px_rgba(0,0,0,0.5)] backdrop-blur-2xl"
          >
            {/* subtle top glow */}
            <div
              className="pointer-events-none absolute inset-x-0 -top-px h-px"
              style={{
                background:
                  "linear-gradient(to right, transparent, rgba(255,255,255,0.4), transparent)",
              }}
            />

            <div className="mb-6 flex items-center gap-3">
              <motion.div
                animate={{ rotate: error ? [0, -8, 8, 0] : 0 }}
                transition={{ duration: 0.3 }}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20"
              >
                <Lock className="h-5 w-5 text-white" strokeWidth={2} />
              </motion.div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">
                  Restricted Access
                </div>
                <div className="mt-0.5 text-[17px] font-semibold tracking-tight text-white">
                  InsightRe AI
                </div>
              </div>
            </div>

            <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/50">
              Access Code
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                type="password"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Enter access code"
                autoComplete="off"
                spellCheck={false}
                className={`w-full rounded-lg border bg-slate-950/40 px-4 py-3 pr-12 text-[14px] tracking-wide text-white placeholder-white/30 outline-none transition focus:border-white/40 ${
                  error
                    ? "border-red-400/60 focus:border-red-400"
                    : "border-white/15"
                }`}
              />
              <button
                type="submit"
                aria-label="Unlock"
                className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md bg-white text-slate-900 transition hover:bg-white/90 active:scale-95 disabled:opacity-40"
                disabled={!value}
              >
                <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
              </button>
            </div>

            <motion.div
              initial={false}
              animate={{
                opacity: error ? 1 : 0,
                y: error ? 0 : -4,
              }}
              transition={{ duration: 0.2 }}
              className="mt-2 text-[12px] text-red-300"
            >
              Incorrect access code.
            </motion.div>

            <div className="mt-6 border-t border-white/10 pt-4">
              <div className="text-[10px] uppercase tracking-wider text-white/40">
                InsightRe Platform · Authorized Access Only
              </div>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
