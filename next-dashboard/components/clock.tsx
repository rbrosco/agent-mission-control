"use client";

import { useEffect, useState } from "react";

export function Clock() {
  const [time, setTime] = useState("--:--:--");

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime(now.toUTCString().split(" ")[4] + " UTC");
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return <div className="text-xs font-mono text-black/50 dark:text-white/50 tabular-nums w-20 text-right">{time}</div>;
}
