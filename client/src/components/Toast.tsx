import { useEffect, useState } from "react";

/** One short message at the bottom of the screen; `at` changes re-trigger it. */
export function Toast({ message, at }: { message: string | null; at: number }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!message) return;
    setVisible(true);
    const id = window.setTimeout(() => setVisible(false), 3200);
    return () => window.clearTimeout(id);
  }, [message, at]);
  if (!message || !visible) return null;
  return (
    <div className="toast" role="alert">
      {message}
    </div>
  );
}
