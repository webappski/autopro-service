'use client';
import { useEffect } from 'react';

const WIDGET_SRC = 'https://typelessity-widget.vercel.app/widget.js';
const API_URL = 'https://typelessity.vercel.app';
const CONFIG_ID = 'db274287-6f68-4acb-9b0e-6c7d431b46fd';

export default function TypelessityLoader() {
  useEffect(() => {
    if (document.querySelector('script[data-typelessity-widget]')) return;
    const script = document.createElement('script');
    script.type = 'module';
    script.src = WIDGET_SRC;
    script.dataset.typelessityWidget = 'true';
    document.head.appendChild(script);
  }, []);

  return (
    // @ts-expect-error -- web component
    <typelessity-widget config-id={CONFIG_ID} api-url={API_URL} position="bottom-left" />
  );
}
