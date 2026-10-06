"use client";

import { useEffect } from "react";

export function PwaRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch((error: unknown) => {
      console.error("Could not register the offline app shell.", error);
    });
  }, []);

  return null;
}
