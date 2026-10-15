"use client";

import { ReactNode, useEffect } from "react";

export default function Drawer({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) { if (event.key === "Escape") onClose(); }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="drawerBackdrop" onMouseDown={onClose}>
      <aside className="drawer" onMouseDown={e => e.stopPropagation()}>
        <div className="drawerHeader"><h2>{title}</h2><button className="drawerClose" onClick={onClose}>×</button></div>
        <div className="drawerBody">{children}</div>
      </aside>
    </div>
  );
}
