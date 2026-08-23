"use client";

import { Check, CheckCheck } from "lucide-react";

interface Props {
  status: "sent" | "delivered" | "read";
}

export function MessageStatus({ status }: Props) {
  if (status === "sent") {
    return <Check className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "rgba(255,255,255,0.5)" }} />;
  }
  if (status === "delivered") {
    return <CheckCheck className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "rgba(255,255,255,0.5)" }} />;
  }
  return <CheckCheck className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#5BC8F5" }} />;
}
