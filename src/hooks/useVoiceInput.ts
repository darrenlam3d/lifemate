/**
 * useVoiceInput — wraps the Web Speech API for speech-to-text.
 *
 * Falls back gracefully on browsers without SpeechRecognition (e.g. desktop
 * Firefox): `supported` is false and `start()` is a no-op. The recognized
 * transcript is exposed via `transcript` and cleared on the next session.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

// Minimal typings for the vendor-prefixed Web Speech API.
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

function getRecognitionCtor(): { new (): SpeechRecognitionLike } | null {
  if (typeof window === 'undefined') return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function useVoiceInput(opts?: { lang?: string; onFinal?: (text: string) => void }) {
  const { lang = 'en-US', onFinal } = opts ?? {};
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  useEffect(() => {
    const Ctor = getRecognitionCtor();
    setSupported(!!Ctor);
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setError('Voice input is not supported in this browser. Try Chrome or the app on your phone.');
      return;
    }
    setError(null);
    setTranscript('');

    const rec = new Ctor();
    rec.lang = lang;
    rec.interimResults = true;
    rec.continuous = false;

    rec.onresult = (e: any) => {
      let interim = '';
      let finalText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const txt = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += txt;
        else interim += txt;
      }
      setTranscript(finalText || interim);
      if (finalText) onFinalRef.current?.(finalText.trim());
    };
    rec.onerror = (e: any) => {
      setError(e?.error === 'not-allowed' ? 'Microphone permission was blocked.' : 'Could not capture audio.');
      setListening(false);
    };
    rec.onend = () => setListening(false);

    recRef.current = rec;
    rec.start();
    setListening(true);
  }, [lang]);

  const stop = useCallback(() => {
    recRef.current?.stop();
    setListening(false);
  }, []);

  return { supported, listening, transcript, error, start, stop };
}
