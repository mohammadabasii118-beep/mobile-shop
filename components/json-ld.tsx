import { ldJson } from "@/lib/seo";

/** Renders one or more JSON-LD blocks. Values are escaped so stored text can never close the script tag. */
export function JsonLd({ data }: { data: unknown | unknown[] }) {
  const list = Array.isArray(data) ? data : [data];
  return <>{list.filter(Boolean).map((d, i) => <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(d) }} />)}</>;
}
