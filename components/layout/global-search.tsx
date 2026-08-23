"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckSquare, Folder, Video } from "lucide-react";
import {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";

interface SearchTask {
  id: string;
  name: string;
  project_id: string;
  project: { title: string } | null;
}
interface SearchProject {
  id: string;
  title: string;
}
interface SearchBooking {
  id: string;
  requester_name: string;
  status: string;
  start_at: string;
}

// Sidebar's search button dispatches this to open the palette without prop-drilling
// open state through AppShell — this component is mounted once, self-contained.
const OPEN_EVENT = "taskco:open-search";

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [tasks, setTasks] = useState<SearchTask[]>([]);
  const [projects, setProjects] = useState<SearchProject[]>([]);
  const [bookings, setBookings] = useState<SearchBooking[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    function onOpenEvent() { setOpen(true); }
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener(OPEN_EVENT, onOpenEvent);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener(OPEN_EVENT, onOpenEvent);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return; // stale results stay in state but are hidden below
    setLoading(true);
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, { credentials: "same-origin" });
        if (res.ok) {
          const { data } = await res.json();
          setTasks(data.tasks ?? []);
          setProjects(data.projects ?? []);
          setBookings(data.bookings ?? []);
        }
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(id);
  }, [query]);

  function closeAndReset() {
    setOpen(false);
    setQuery("");
  }

  function go(path: string) {
    closeAndReset();
    router.push(path);
  }

  const trimmed = query.trim();
  const showResults = trimmed.length >= 2;

  return (
    <CommandDialog
      open={open}
      onOpenChange={(v) => (v ? setOpen(true) : closeAndReset())}
      title="Search"
      description="Search tasks, projects, and meetings"
    >
      {/* shouldFilter=false — results are already filtered server-side; cmdk's
          own fuzzy filter would otherwise match against the `value` prop
          (task/project/booking ids), not the visible label, and hide everything. */}
      <Command shouldFilter={false}>
        <CommandInput placeholder="Search tasks, projects, meetings…" value={query} onValueChange={setQuery} />
        <CommandList>
          {!showResults ? (
            <CommandEmpty>Type at least 2 characters to search…</CommandEmpty>
          ) : loading ? (
            <CommandEmpty>Searching…</CommandEmpty>
          ) : tasks.length === 0 && projects.length === 0 && bookings.length === 0 ? (
            <CommandEmpty>No results found.</CommandEmpty>
          ) : (
            <>
              {tasks.length > 0 && (
                <CommandGroup heading="Tasks">
                  {tasks.map((t) => (
                    <CommandItem key={t.id} value={t.id} onSelect={() => go(`/projects/${t.project_id}`)}>
                      <CheckSquare className="h-4 w-4" />
                      <span className="flex-1 truncate">{t.name}</span>
                      {t.project?.title && (
                        <span className="text-xs opacity-60 flex-shrink-0">{t.project.title}</span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {projects.length > 0 && (
                <CommandGroup heading="Projects">
                  {projects.map((p) => (
                    <CommandItem key={p.id} value={p.id} onSelect={() => go(`/projects/${p.id}`)}>
                      <Folder className="h-4 w-4" />
                      <span className="flex-1 truncate">{p.title}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {bookings.length > 0 && (
                <CommandGroup heading="Meetings">
                  {bookings.map((b) => (
                    <CommandItem key={b.id} value={b.id} onSelect={() => go("/meetings")}>
                      <Video className="h-4 w-4" />
                      <span className="flex-1 truncate">{b.requester_name}</span>
                      <span className="text-xs opacity-60 flex-shrink-0 capitalize">{b.status}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}

export function openGlobalSearch() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}
