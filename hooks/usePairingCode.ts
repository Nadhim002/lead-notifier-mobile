import { useState, useEffect, useCallback } from 'react';
import { ref, set } from 'firebase/database';
import { db } from '../firebase';

const CODE_TTL_SECONDS = 600;

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export function usePairingCode(uid: string | null): {
  code: string | null;
  secondsLeft: number;
  refresh: () => void;
} {
  const [code, setCode] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(CODE_TTL_SECONDS);

  const writeCode = useCallback(async () => {
    if (!uid) return;
    const newCode = generateCode();
    const expiresAt = Date.now() + CODE_TTL_SECONDS * 1000;
    await set(ref(db, `pairings/${newCode}`), { uid, expiresAt });
    setCode(newCode);
    setSecondsLeft(CODE_TTL_SECONDS);
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    writeCode();
  }, [uid, writeCode]);

  useEffect(() => {
    if (!code) return;
    const interval = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) {
          writeCode();
          return CODE_TTL_SECONDS;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [code, writeCode]);

  return { code, secondsLeft, refresh: writeCode };
}
