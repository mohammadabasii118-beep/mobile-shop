"use client";
import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "./provider";

export function LanguageSwitch() {
  const { locale, setLocale } = useI18n();
  return (
    <Button variant="ghost" size="sm" aria-label="Language / زبان" onClick={() => setLocale(locale === "fa" ? "en" : "fa")}>
      <Languages className="size-4" />
      <span>{locale === "fa" ? "EN" : "فا"}</span>
    </Button>
  );
}
