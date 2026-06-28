"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown, Search } from "lucide-react";

interface Country {
  code: string; // e.g. "+91"
  name: string; // e.g. "India"
  flag: string; // emoji flag e.g. "🇮🇳"
}

interface Props {
  value: string; // e.g. "+91"
  onChange: (code: string) => void;
  disabled?: boolean;
}

export function CountryCodeSelect({ value, onChange, disabled }: Props) {
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_COUNTRY_API_URL ?? "https://restcountries.com/v3.1/all?fields=name,idd,cca2";
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
          // Flag emoji from cca2 code
          const flag = c.cca2
            ? Array.from(c.cca2.toUpperCase()).map(ch => String.fromCodePoint(0x1F1E6 + ch.charCodeAt(0) - 65)).join("")
            : "";
          list.push({ code, name: c.name.common, flag });
        }
        // Sort by country name
        list.sort((a, b) => a.name.localeCompare(b.name));
        setCountries(list);
      })
      .catch(() => {
        // Fallback list of common codes
        setCountries([
          { code: "+1", name: "United States", flag: "🇺🇸" },
          { code: "+44", name: "United Kingdom", flag: "🇬🇧" },
          { code: "+91", name: "India", flag: "🇮🇳" },
          { code: "+61", name: "Australia", flag: "🇦🇺" },
          { code: "+86", name: "China", flag: "🇨🇳" },
          { code: "+49", name: "Germany", flag: "🇩🇪" },
          { code: "+33", name: "France", flag: "🇫🇷" },
          { code: "+81", name: "Japan", flag: "🇯🇵" },
          { code: "+971", name: "UAE", flag: "🇦🇪" },
          { code: "+65", name: "Singapore", flag: "🇸🇬" },
        ]);
      })
      .finally(() => setLoading(false));
  }, []);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const filtered = search
    ? countries.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.code.includes(search)
      )
    : countries;

  const selected = countries.find(c => c.code === value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => { setOpen(o => !o); setSearch(""); }}
        className="flex items-center gap-1.5 h-10 px-2.5 border-r-0 border text-[13px] font-semibold min-w-[76px] transition-colors disabled:opacity-50"
        style={{
          borderColor: "var(--line)",
          background: "var(--panel-bg)",
          color: "var(--ink)",
          borderRadius: "8px 0 0 8px",
        }}
      >
        <span className="text-[16px]">{selected?.flag ?? "🌐"}</span>
        <span>{loading ? "…" : (value || "+")}</span>
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>

      {open && !loading && (
        <div
          className="absolute top-full left-0 mt-1 z-50 rounded-xl border shadow-lg flex flex-col overflow-hidden"
          style={{
            background: "var(--surface-bg)",
            borderColor: "var(--line)",
            width: 240,
            maxHeight: 280,
          }}
        >
          {/* Search */}
          <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: "var(--line)" }}>
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
          <div className="overflow-y-auto" style={{ maxHeight: 220 }}>
            {filtered.length === 0 ? (
              <p className="text-[12px] px-3 py-3" style={{ color: "var(--text-muted)" }}>No results</p>
            ) : filtered.map(c => (
              <button
                key={`${c.code}-${c.name}`}
                type="button"
                onClick={() => { onChange(c.code); setOpen(false); setSearch(""); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:opacity-80 transition-opacity"
                style={{
                  background: c.code === value ? "var(--line-soft)" : "transparent",
                  color: "var(--ink)",
                }}
              >
                <span className="text-[16px] flex-shrink-0">{c.flag}</span>
                <span className="flex-1 text-[13px] truncate">{c.name}</span>
                <span className="text-[12px] font-semibold flex-shrink-0" style={{ color: "var(--text-muted)" }}>{c.code}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
