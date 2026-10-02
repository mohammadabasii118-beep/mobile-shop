"use client";
import { useState } from "react";
import { Eye, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/page-header";
import { GridSkeleton } from "@/components/shared/query-state";
import { SourceBadge, StatusBadge } from "@/components/shared/status-badge";
import { apiFetch, useAction, useStories } from "@/hooks/api";
import { formatDateTime, nf } from "@/utils/format";

export function StoriesPage() {
  const { data, isLoading } = useStories();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const create = useAction(() => apiFetch("/api/stories", { method: "POST", json: { label } }));
  return (
    <div>
      <PageHeader title="Instagram Stories" description="Published and scheduled stories." actions={<Button onClick={() => setOpen(true)}><Plus className="size-4" />Create Story</Button>} />
      {isLoading ? <GridSkeleton count={4} className="h-96" /> : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
          {data?.map((s) => (
            <Card key={s.id} className="overflow-hidden">
              <div className="relative aspect-[9/16]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.imageUrl} alt={s.label} className="size-full object-cover" />
                <div className="absolute top-2 left-2"><StatusBadge status={s.status} /></div>
              </div>
              <div className="space-y-2 p-3 text-xs">
                <div className="flex items-center justify-between"><SourceBadge source={s.source} /><span className="flex items-center gap-1 text-muted-foreground"><Eye className="size-3.5" />{nf.format(s.views)}</span></div>
                <p className="text-muted-foreground">{formatDateTime(s.publishedAt)}</p>
              </div>
            </Card>
          ))}
        </div>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} title="Create Story" description="Demo: a placeholder story is generated and published to the mock Instagram provider.">
        <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); create.mutate(undefined, { onSuccess: () => { toast.success("Story published"); setOpen(false); setLabel(""); }, onError: (er) => toast.error(er.message) }); }}>
          <Field label="Story title"><Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. New arrivals" required maxLength={40} /></Field>
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" loading={create.isPending}>Publish</Button></div>
        </form>
      </Dialog>
    </div>
  );
}
