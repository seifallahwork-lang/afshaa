import { useEffect, useState } from "react";

/** Seconds left until `endsAt` (server time), corrected by the server clock offset. */
export function useCountdown(endsAt: number | null, clockOffset: number): number {
  const calc = () => (endsAt === null ? 0 : Math.max(0, Math.ceil((endsAt - (Date.now() + clockOffset)) / 1000)));
  const [left, setLeft] = useState(calc);
  useEffect(() => {
    setLeft(calc());
    if (endsAt === null) return;
    const id = window.setInterval(() => setLeft(calc()), 250);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endsAt, clockOffset]);
  return left;
}
