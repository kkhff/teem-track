"use client";

import { Toaster as SonnerToaster, type ToasterProps } from "sonner";

function Toaster(props: ToasterProps) {
  return <SonnerToaster className="toaster group" {...props} />;
}

export { Toaster };
