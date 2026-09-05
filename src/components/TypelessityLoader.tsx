'use client';
import { useEffect } from 'react';

// `?v=` busts the year-long immutable cache the CDN used to send for the bare
// bundle (typelessity ledger 2026-09-05, D-17). Bump on every widget release.
const WIDGET_VERSION = '20260905b';
const WIDGET_SRC = `https://typelessity-widget.vercel.app/widget.js?v=${WIDGET_VERSION}`;
const API_URL = 'https://typelessity.vercel.app';
// Published from the webappski portal on 2026-09-05 (paste flow, allowAny mechanic).
const CONFIG_ID = '998c2df0-7bdf-45b7-b070-2ae2667a729f';

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
