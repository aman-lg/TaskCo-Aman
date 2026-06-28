"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search } from "lucide-react";

interface Country {
  code: string;
  name: string;
  flag: string;
}

interface DropdownPos {
  top: number;
  left: number;
}

interface Props {
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
  /** When true: no border/radius, transparent bg, full parent height — for embedding inside a field wrapper */
  insideField?: boolean;
}

const FALLBACK: Country[] = [
  { code: "+1",   name: "United States", flag: "🇺🇸" },
  { code: "+44",  name: "United Kingdom", flag: "🇬🇧" },
  { code: "+91",  name: "India",          flag: "🇮🇳" },
  { code: "+61",  name: "Australia",      flag: "🇦🇺" },
  { code: "+86",  name: "China",          flag: "🇨🇳" },
  { code: "+49",  name: "Germany",        flag: "🇩🇪" },
  { code: "+33",  name: "France",         flag: "🇫🇷" },
  { code: "+81",  name: "Japan",          flag: "🇯🇵" },
  { code: "+971", name: "UAE",            flag: "🇦🇪" },
  { code: "+65",  name: "Singapore",      flag: "🇸🇬" },
];

const DROPDOWN_W = 260;
const DROPDOWN_MAX_H = 320;

export function CountryCodeSelect({ value, onChange, disabled, insideField }: Props) {
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [pos, setPos] = useState<DropdownPos | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const apiUrl =
      process.env.NEXT_PUBLIC_COUNTRY_API_URL ??
      "https://restcountries.com/v3.1/all?fields=name,idd,cca2";
    fetch(apiUrl)
      .then(r => r.json())
      .then((data: Array<{ name: { common: string }; idd: { root: string; suffixes?: string[] }; cca2: string }>) => {
        const list: Country[] = [];
        for (const c of data) {
          if (!c.idd?.root) continue;
          const root = c.idd.root;
          const suffix = c.idd.suffixes?.length === 1 ? c.idd.suffixes[0] : "";
          const code = root + suffix;
          if (!code || code === "+") continue;
          const flag = c.cca2
            ? Array.from(c.cca2.toUpperCase()).map(ch =>
                String.fromCodePoint(0x1f1e6 + ch.charCodeAt(0) - 65)
              ).join("")
            : "";
          list.push({ code, name: c.name.common, flag });
        }
        list.sort((a, b) => a.name.localeCompare(b.name));
        setCountries(list);
      })
      .catch(() => setCountries(FALLBACK))
      .finally(() => setLoading(false));
  }, []);

  function calcPos() {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();

    // Horizontal: prefer aligning left edge with button, clamp to viewport
    let left = r.left;
    if (left + DROPDOWN_W > window.innerWidth - 8) {
      left = window.innerWidth - DROPDOWN_W - 8;
    }
    if (left < 8) left = 8;

    // Vertical: open downward if room, otherwise upward
    const spaceBelow = window.innerHeight - r.bottom - 8;
    const top = spaceBelow >= DROPDOWN_MAX_H
      ? r.bottom + 4
      : Math.max(8, r.top - DROPDOWN_MAX_H - 4);

    setPos({ top, left });
  }

  useEffect(() => {
    if (!open) return;
    calcPos();
    window.addEventListener("scroll", calcPos, true);
    window.addEventListener("resize", calcPos);
    return () => {
      window.removeEventListener("scroll", calcPos, true);
      window.removeEventListener("resize", calcPos);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (btnRef.current?.contains(target)) return;
      const portal = document.getElementById("cc-dropdown");
      if (portal?.contains(target)) return;
      setOpen(false);
      setSearch("");
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const filtered = search
    ? countries.filter(
        c =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.code.includes(search)
      )
    : countries;

  const selected = countries.find(c => c.code === value);

  const btnStyle: React.CSSProperties = insideField
    ? {
        // Embedded inside a field: no border, transparent bg, full height
        border: "none",
        borderRadius: 0,
        background: "transparent",
        height: "100%",
        padding: "0 10px",
        display: "flex",
        alignItems: "center",
        gap: 4,
        color: "var(--ink)",
        cursor: "pointer",
        flexShrink: 0,
        fontSize: 14,
        fontWeight: 600,
      }
    : {
        // Standalone: left half of an input row
        border: `1px solid var(--line)`,
        borderRight: "none",
        borderRadius: "8px 0 0 8px",
        background: "var(--panel-bg)",
        height: 40,
        minWidth: 80,
        padding: "0 10px",
        display: "flex",
        alignItems: "center",
        gap: 4,
        color: "var(--ink)",
        cursor: "pointer",
        flexShrink: 0,
        fontSize: 13,
        fontWeight: 600,
      };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled || loading}
        onClick={() => { setOpen(o => !o); setSearch(""); }}
        style={btnStyle}
        className="transition-opacity disabled:opacity-50"
      >
        <span style={{ fontSize: 16, lineHeight: 1 }}>{selected?.flag ?? "🌐"}</span>
        <span className="tabular-nums">{loading ? "…" : (value || "+")}</span>
        <ChevronDown style={{ width: 12, height: 12, opacity: 0.5, flexShrink: 0 }} />
      </button>

      {/* Portal into document.body — escapes CSS transform stacking contexts */}
      {open && pos && typeof document !== "undefined" && createPortal(
        <div
          id="cc-dropdown"
          style={{
            position: "fixed",
            top: pos.top,
            left: pos.left,
            width: DROPDOWN_W,
            maxHeight: DROPDOWN_MAX_H,
            background: "var(--surface-bg)",
            border: "1px solid var(--line)",
            borderRadius: 12,
            boxShadow: "0 8px 32px rgba(0,0,0,0.14)",
            zIndex: 9999,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Search bar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px",
              borderBottom: "1px solid var(--line)",
              flexShrink: 0,
            }}
          >
            <Search style={{ width: 14, height: 14, color: "var(--text-muted)", flexShrink: 0 }} />
            <input
              autoFocus
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search country or code…"
              style={{
                flex: 1,
                fontSize: 13,
                outline: "none",
                background: "transparent",
                color: "var(--ink)",
                border: "none",
              }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                style={{ fontSize: 12, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Scrollable list */}
          <div style={{ overflowY: "auto", flex: 1 }}>
            {filtered.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--text-muted)", padding: "12px 14px" }}>No results</p>
            ) : (
              filtered.map(c => (
                <button
                  key={`${c.code}-${c.name}`}
                  type="button"
                  onMouseDown={e => {
                    e.preventDefault();
                    onChange(c.code);
                    setOpen(false);
                    setSearch("");
                  }}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "9px 14px",
                    background: c.code === value ? "var(--line-soft)" : "transparent",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    color: "var(--ink)",
                    transition: "background 80ms",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "var(--line-soft)")}
                  onMouseLeave={e =>
                    (e.currentTarget.style.background =
                      c.code === value ? "var(--line-soft)" : "transparent")
                  }
                >
                  <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{c.flag}</span>
                  <span style={{ flex: 1, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.name}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                    {c.code}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
