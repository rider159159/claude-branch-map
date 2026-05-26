import { useEffect } from 'react';

interface Props {
  message: string;
  onDone: () => void;
  duration?: number;
}

export function Toast({ message, onDone, duration = 2200 }: Props) {
  useEffect(() => {
    const id = window.setTimeout(onDone, duration);
    return () => window.clearTimeout(id);
  }, [message, duration, onDone]);

  return <div className="toast">{message}</div>;
}
