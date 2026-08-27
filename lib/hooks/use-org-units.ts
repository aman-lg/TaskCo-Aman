"use client";

import { useState, useEffect } from "react";

export interface OrgProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  email: string | null;
}

export interface OrgUnit {
  id: string;
  parent_id: string | null;
  name: string;
  members: { user_id: string; profile: OrgProfile }[];
}

export function useOrgUnits() {
  const [units, setUnits] = useState<OrgUnit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/org/units", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((j) => setUnits(j.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  return { units, loading };
}
