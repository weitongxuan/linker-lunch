import { useEffect, useState } from 'react';
import { subscribeToast } from '../lib/toast.js';

export function Toast() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => subscribeToast(setMsg), []);
  return (
    <div id="toast" className={msg ? 'on' : ''}>
      {msg}
    </div>
  );
}
