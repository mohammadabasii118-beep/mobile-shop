"use client";
import { useState } from "react";
import { Package, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { DataTable, type Column } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { ListSkeleton } from "@/components/shared/query-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { PRODUCT_ICONS } from "@/database/seed";
import { placeholderImage } from "@/lib/placeholder";
import { apiFetch, useAction, useProducts } from "@/hooks/api";
import { useFmt } from "@/hooks/use-fmt";
import { useT } from "@/i18n/provider";
import type { Product } from "@/types";

const CATEGORIES = Object.keys(PRODUCT_ICONS);
const EMPTY: Omit<Product, "id"> = { name: "", sku: "", category: CATEGORIES[0], price: 0, stock: 0, status: "active" };

function ProductForm({ initial, onDone }: { initial?: Product; onDone: () => void }) {
  const t = useT();
  const [f, setF] = useState<Omit<Product, "id">>(initial ?? EMPTY);
  const save = useAction(() => (initial ? apiFetch(`/api/products/${initial.id}`, { method: "PATCH", json: f }) : apiFetch("/api/products", { method: "POST", json: f })));
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  return (
    <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); save.mutate(undefined, { onSuccess: () => { toast.success(t(initial ? "Product updated" : "Product added")); onDone(); }, onError: (er) => toast.error(er.message) }); }}>
      <Field label="Name"><Input value={f.name} onChange={(e) => set("name", e.target.value)} required /></Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="SKU"><Input value={f.sku} onChange={(e) => set("sku", e.target.value)} required /></Field>
        <Field label="Category"><Select value={f.category} onChange={(e) => set("category", e.target.value)}>{CATEGORIES.map((c) => <option key={c} value={c}>{t(c)}</option>)}</Select></Field>
        <Field label="Price (Toman)"><Input type="number" min={0} value={f.price} onChange={(e) => set("price", Number(e.target.value))} required /></Field>
        <Field label="Stock"><Input type="number" min={0} value={f.stock} onChange={(e) => set("stock", Number(e.target.value))} required /></Field>
      </div>
      <Field label="Status"><Select value={f.status} onChange={(e) => set("status", e.target.value as Product["status"])}><option value="active">{t("Active")}</option><option value="draft">{t("Draft")}</option><option value="out_of_stock">{t("Out of stock")}</option></Select></Field>
      <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onDone}>{t("Cancel")}</Button><Button type="submit" loading={save.isPending}>{t("Save")}</Button></div>
    </form>
  );
}

export function ProductsPage() {
  const { data, isLoading } = useProducts();
  const t = useT();
  const { toman, nf } = useFmt();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const del = useAction((id: string) => apiFetch(`/api/products/${id}`, { method: "DELETE" }));
  const rows = (data ?? []).filter((p) => `${p.name} ${p.sku}`.toLowerCase().includes(q.toLowerCase()));

  const columns: Column<Product>[] = [
    { key: "name", label: "Product", primary: true, cell: (p) => (
      <span className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={placeholderImage(PRODUCT_ICONS[p.category] ?? "📦", p.name.length, "")} alt="" className="size-10 rounded-lg object-cover" />
        <span dir="auto" className="font-medium">{p.name}</span>
      </span>
    ) },
    { key: "sku", label: "SKU", cell: (p) => <code className="text-xs">{p.sku}</code> },
    { key: "price", label: "Price", cell: (p) => <span dir="auto">{toman(p.price)}</span> },
    { key: "stock", label: "Stock", cell: (p) => <span className={p.stock === 0 ? "text-danger" : p.stock < 10 ? "text-warning" : ""}>{nf.format(p.stock)}</span> },
    { key: "status", label: "Status", cell: (p) => <StatusBadge status={p.status} /> },
    { key: "actions", label: "", className: "text-end", cell: (p) => (
      <span className="flex justify-end gap-1.5">
        <Button size="sm" variant="outline" onClick={() => setEditing(p)}><Pencil className="size-3.5" />{t("Edit")}</Button>
        <Button size="sm" variant="danger" onClick={() => setDeleting(p)}><Trash2 className="size-3.5" />{t("Delete")}</Button>
      </span>
    ) },
  ];

  return (
    <div>
      <PageHeader title="Products" description="The AI assistant reads prices and stock from this catalog." actions={<Button onClick={() => setEditing("new")}><Plus className="size-4" />{t("Add product")}</Button>} />
      <Card>
        <div className="border-b p-4"><div className="relative max-w-xs"><Search className="absolute top-2.5 start-3 size-4 text-muted-foreground" /><Input className="ps-9" placeholder={t("Search products")} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t("Search products")} /></div></div>
        {isLoading ? <ListSkeleton /> : rows.length === 0 ? <EmptyState icon={Package} title="No products found" /> : <DataTable columns={columns} rows={rows} rowKey={(p) => p.id} />}
      </Card>
      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Add product" : "Edit product"}>
        {editing && <ProductForm key={editing === "new" ? "new" : editing.id} initial={editing === "new" ? undefined : editing} onDone={() => setEditing(null)} />}
      </Dialog>
      <Dialog open={!!deleting} onClose={() => setDeleting(null)} title="Delete product?" description={deleting?.name}>
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setDeleting(null)}>{t("Cancel")}</Button>
          <Button variant="danger" loading={del.isPending} onClick={() => deleting && del.mutate(deleting.id, { onSuccess: () => { toast.success(t("Product deleted")); setDeleting(null); } })}>{t("Delete")}</Button></div>
      </Dialog>
    </div>
  );
}
