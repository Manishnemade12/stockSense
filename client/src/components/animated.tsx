import { motion, type HTMLMotionProps } from "motion/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Fade-up reveal when the element scrolls into view. */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.55, delay, ease: [0.21, 0.65, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/** Card that lifts and glows on hover. */
export function GlowCard({
  children,
  className,
  ...props
}: HTMLMotionProps<"div">) {
  return (
    <motion.div
      className={cn(
        "rounded-xl border bg-card p-6 text-card-foreground transition-shadow duration-300 hover:glow-sm",
        className,
      )}
      whileHover={{ y: -6, scale: 1.015 }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/** Button with springy press/hover physics. Wrap any content. */
export function AnimatedButton({
  children,
  className,
  ...props
}: HTMLMotionProps<"button">) {
  return (
    <motion.button
      className={className}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.96 }}
      transition={{ type: "spring", stiffness: 400, damping: 18 }}
      {...props}
    >
      {children}
    </motion.button>
  );
}

/** Gradient headline text with a slow animated gradient shift. */
export function GradientText({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("text-gradient animate-gradient", className)}>
      {children}
    </span>
  );
}

/** Badge that pops in with a spring. */
export function AnimatedBadge({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border bg-secondary/60 px-3 py-1 text-xs font-medium text-secondary-foreground",
        className,
      )}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 16 }}
    >
      {children}
    </motion.span>
  );
}

/** Animated spinner loader with a pulsing glow ring. */
export function Loader({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-muted border-t-primary" />
        <div className="absolute inset-0 animate-pulse-glow rounded-full" />
      </div>
      <motion.p
        className="text-sm text-muted-foreground"
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
      >
        {label}
      </motion.p>
    </div>
  );
}

/** Stagger container — children with <StaggerItem> animate in sequence. */
export function Stagger({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-60px" }}
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: 0.12 } },
      }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 24 },
        show: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.5, ease: [0.21, 0.65, 0.36, 1] },
        },
      }}
    >
      {children}
    </motion.div>
  );
}
