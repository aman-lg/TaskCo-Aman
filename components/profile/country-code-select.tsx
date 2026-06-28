"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown, Search } from "lucide-react";

interface Country {
  code: string;
  name: string;
  flag: string;
}

interface DropdownPos {
  top: number;
  left: number;
  width: number;
}

interface Props {
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
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

export function CountryCodeSelect({ value, onChange, disabled }: Props) {
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

  // Recalculate position when the dropdown opens or window scrolls/resizes
  useEffect(() => {
    if (!open || !btnRef.current) return;
    function calcPos() {
      if (!btnRef.current) return;
      const r = btnRef.current.getBoundingClientRect();
      // Prefer opening downward; if not enough room, open upward
      const spaceBelow = window.innerHeight - r.bottom;
      const dropH = 280;
      const top = spaceBelow >= dropH ? r.bottom + 4 : r.top - dropH - 4;
      setPos({ top, left: r.left, width: Math.max(r.width, 240) });
    }
    calcPos();
    window.addEventListener("scroll", calcPos, true);
    window.addEventListener("resize", calcPos);
    return () => {
      window.removeEventListener("scroll", calcPos, true);
      window.removeEventListener("resize", calcPos);
    };
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (btnRef.current?.contains(target)) return;
      // also ignore clicks inside the fixed dropdown
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

  function handleOpen() {
    if (disabled || loading) return;
    setOpen(o => !o);
    setSearch("");
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled || loading}
        onClick={handleOpen}
        className="flex items-center gap-1.5 h-10 px-2.5 border text-[13px] font-semibold min-w-[80px] transition-colors disabled:opacity-50 flex-shrink-0"
        style={{
          borderColor: "var(--line)",
          background: "var(--panel-bg)",
          color: "var(--ink)",
          borderRadius: "8px 0 0 8px",
          borderRight: "none",
        }}
      >
        <span className="text-[15px] leading-none">{selected?.flag ?? "🌐"}</span>
        <span className="tabular-nums">{loading ? "…" : (value || "+")}</span>
        <ChevronDown className="w-3 h-3 opacity-50 flex-shrink-0" />
      </button>

      {/* Fixed-position portal — escapes overflow: hidden parents */}
      {open && pos && (
        <div
          id="cc-dropdown"
          className="rounded-xl border shadow-xl flex flex-col overflow-hidden"
          style={{
            position: "fixed",
            top: pos.top,
            left: pos.left,
            width: Math.min(pos.width, window.innerWidth - pos.left - 8),
            maxHeight: 280,
            background: "var(--surface-bg)",
            borderColor: "var(--line)",
            zIndex: 9999,
          }}
        >
          {/* Search */}
          <div
            className="flex items-center gap-2 px-3 py-2 border-b flex-shrink-0"
            style={{ borderColor: "var(--line)" }}
          >
            <Search className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
            <input
              autoFocus
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search country…"
              className="flex-1 text-[13px] outline-none bg-transparent"
              style={{ color: "var(--ink)" }}
            />
          </div>
          {/* List */}
          <div className="overflow-y-auto flex-1">
            {filtered.length === 0 ? (
              <p className="text-[12px] px-3 py-3" style={{ color: "var(--text-muted)" }}>
                No results
              </p>
            ) : (
              filtered.map(c => (
                <button
                  key={`${c.code}-${c.name}`}
                  type="button"
                  onMouseDown={e => {
                    e.preventDefault(); // prevent blur before click registers
                    onChange(c.code);
                    setOpen(false);
                    setSearch("");
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors"
                  style={{
                    background: c.code === value ? "var(--line-soft)" : "transparent",
                    color: "var(--ink)",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "var(--line-soft)")}
                  onMouseLeave={e =>
                    (e.currentTarget.style.background =
                      c.code === value ? "var(--line-soft)" : "transparent")
                  }
                >
                  <span className="text-[15px] flex-shrink-0 leading-none">{c.flag}</span>
                  <span className="flex-1 text-[13px] truncate">{c.name}</span>
                  <span
                    className="text-[12px] font-semibold flex-shrink-0 tabular-nums"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {c.code}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}
