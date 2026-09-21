import "server-only";
import {
  Document, Page, View, Text, StyleSheet, renderToBuffer,
} from "@react-pdf/renderer";
import { euros, dateFr, vatLabel } from "@/lib/format";

export type InvoicePdfData = {
  company: { name: string; address?: string | null; siret?: string | null; vat?: string | null };
  client: {
    name: string; address?: string | null; postalCode?: string | null; city?: string | null;
    email?: string | null; siret?: string | null;
  };
  invoice: {
    reference: string; issueDate: string; dueDate?: string | null; paymentTerms?: string | null;
    notes?: string | null; subtotalCents: number; vatCents: number; totalCents: number;
  };
  items: { label: string; qty: number; unitPriceCents: number; vatBps: number; lineTotalCents: number }[];
};

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 9, color: "#0f172a", fontFamily: "Helvetica" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  company: { fontSize: 16, fontWeight: 700, color: "#1d4ed8" },
  small: { fontSize: 8, color: "#64748b" },
  title: { fontSize: 20, fontWeight: 700, textAlign: "right" },
  ref: { fontSize: 10, textAlign: "right", color: "#64748b", marginTop: 2 },
  blocks: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  block: { width: "48%" },
  blockLabel: { fontSize: 8, color: "#64748b", textTransform: "uppercase", marginBottom: 3 },
  bold: { fontWeight: 700 },
  thead: { flexDirection: "row", backgroundColor: "#0f172a", color: "#ffffff", paddingVertical: 5, paddingHorizontal: 4 },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e2e8f0", paddingVertical: 4, paddingHorizontal: 4 },
  cLabel: { width: "52%" }, cQty: { width: "10%", textAlign: "right" }, cPu: { width: "16%", textAlign: "right" },
  cVat: { width: "10%", textAlign: "right" }, cTotal: { width: "12%", textAlign: "right" },
  totals: { marginTop: 12, alignItems: "flex-end" },
  totalRow: { flexDirection: "row", width: 200, justifyContent: "space-between", paddingVertical: 2 },
  grand: { fontSize: 12, fontWeight: 700, borderTopWidth: 1, borderTopColor: "#0f172a", marginTop: 3, paddingTop: 4 },
  footer: { marginTop: 24, fontSize: 8, color: "#64748b" },
});

function InvoiceDoc({ data }: { data: InvoicePdfData }) {
  const { company, client, invoice, items } = data;
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.headerRow}>
          <View>
            <Text style={s.company}>{company.name}</Text>
            {company.address ? <Text style={s.small}>{company.address}</Text> : null}
            {company.siret ? <Text style={s.small}>SIRET {company.siret}</Text> : null}
            {company.vat ? <Text style={s.small}>TVA {company.vat}</Text> : null}
          </View>
          <View>
            <Text style={s.title}>FACTURE</Text>
            <Text style={s.ref}>{invoice.reference}</Text>
            <Text style={s.ref}>Émise le {dateFr(invoice.issueDate)}</Text>
            {invoice.dueDate ? <Text style={s.ref}>Échéance {dateFr(invoice.dueDate)}</Text> : null}
          </View>
        </View>

        <View style={s.blocks}>
          <View style={s.block}>
            <Text style={s.blockLabel}>Émetteur</Text>
            <Text style={s.bold}>{company.name}</Text>
            {company.address ? <Text>{company.address}</Text> : null}
          </View>
          <View style={s.block}>
            <Text style={s.blockLabel}>Client</Text>
            <Text style={s.bold}>{client.name}</Text>
            {client.address ? <Text>{client.address}</Text> : null}
            {(client.postalCode || client.city) ? <Text>{[client.postalCode, client.city].filter(Boolean).join(" ")}</Text> : null}
            {client.siret ? <Text>SIRET {client.siret}</Text> : null}
          </View>
        </View>

        <View style={s.thead}>
          <Text style={s.cLabel}>Désignation</Text>
          <Text style={s.cQty}>Qté</Text>
          <Text style={s.cPu}>PU HT</Text>
          <Text style={s.cVat}>TVA</Text>
          <Text style={s.cTotal}>Total HT</Text>
        </View>
        {items.map((it, i) => (
          <View style={s.tr} key={i}>
            <Text style={s.cLabel}>{it.label}</Text>
            <Text style={s.cQty}>{it.qty}</Text>
            <Text style={s.cPu}>{euros(it.unitPriceCents)}</Text>
            <Text style={s.cVat}>{vatLabel(it.vatBps)}</Text>
            <Text style={s.cTotal}>{euros(it.lineTotalCents)}</Text>
          </View>
        ))}

        <View style={s.totals}>
          <View style={s.totalRow}><Text>Total HT</Text><Text>{euros(invoice.subtotalCents)}</Text></View>
          <View style={s.totalRow}><Text>TVA</Text><Text>{euros(invoice.vatCents)}</Text></View>
          <View style={[s.totalRow, s.grand]}><Text>Total TTC</Text><Text>{euros(invoice.totalCents)}</Text></View>
        </View>

        <View style={s.footer}>
          {invoice.paymentTerms ? <Text>Conditions de paiement : {invoice.paymentTerms}</Text> : null}
          {invoice.notes ? <Text style={{ marginTop: 4 }}>{invoice.notes}</Text> : null}
        </View>
      </Page>
    </Document>
  );
}

export async function renderInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  return renderToBuffer(<InvoiceDoc data={data} />);
}
