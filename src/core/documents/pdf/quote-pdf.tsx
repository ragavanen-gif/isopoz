import "server-only";
import {
  Document, Page, View, Text, StyleSheet, renderToBuffer,
} from "@react-pdf/renderer";
import { euros, dateFr, vatLabel } from "@/lib/format";

export type QuotePdfData = {
  company: { name: string; address?: string | null; siret?: string | null; vat?: string | null };
  client: {
    name: string; address?: string | null; postalCode?: string | null; city?: string | null;
    email?: string | null; siret?: string | null; vat?: string | null;
  };
  quote: {
    reference: string; issueDate: string; validUntil?: string | null; subject?: string | null;
    paymentTerms?: string | null; notes?: string | null;
    subtotalCents: number; vatCents: number; totalCents: number;
  };
  items: {
    kind: string; label: string; description?: string | null; qty: number;
    unitPriceCents: number; discountBps: number; vatBps: number; lineTotalCents: number;
  }[];
  managerName?: string | null;
};

const styles = StyleSheet.create({
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
  subject: { marginBottom: 12, fontSize: 11, fontWeight: 700 },
  thead: { flexDirection: "row", backgroundColor: "#0f172a", color: "#ffffff", paddingVertical: 5, paddingHorizontal: 4 },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e2e8f0", paddingVertical: 4, paddingHorizontal: 4 },
  cLabel: { width: "42%" },
  cQty: { width: "10%", textAlign: "right" },
  cPu: { width: "14%", textAlign: "right" },
  cDisc: { width: "10%", textAlign: "right" },
  cVat: { width: "10%", textAlign: "right" },
  cTotal: { width: "14%", textAlign: "right" },
  totals: { marginTop: 12, alignItems: "flex-end" },
  totalRow: { flexDirection: "row", width: 200, justifyContent: "space-between", paddingVertical: 2 },
  grandTotal: { fontSize: 12, fontWeight: 700, borderTopWidth: 1, borderTopColor: "#0f172a", marginTop: 3, paddingTop: 4 },
  footer: { marginTop: 24, fontSize: 8, color: "#64748b" },
  desc: { fontSize: 7, color: "#64748b" },
});

function QuoteDocument({ data }: { data: QuotePdfData }) {
  const { company, client, quote, items } = data;
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.company}>{company.name}</Text>
            {company.address ? <Text style={styles.small}>{company.address}</Text> : null}
            {company.siret ? <Text style={styles.small}>SIRET {company.siret}</Text> : null}
            {company.vat ? <Text style={styles.small}>TVA {company.vat}</Text> : null}
          </View>
          <View>
            <Text style={styles.title}>DEVIS</Text>
            <Text style={styles.ref}>{quote.reference}</Text>
            <Text style={styles.ref}>Émis le {dateFr(quote.issueDate)}</Text>
            {quote.validUntil ? <Text style={styles.ref}>Valable jusqu'au {dateFr(quote.validUntil)}</Text> : null}
          </View>
        </View>

        <View style={styles.blocks}>
          <View style={styles.block}>
            <Text style={styles.blockLabel}>Émetteur</Text>
            <Text style={styles.bold}>{company.name}</Text>
            {company.address ? <Text>{company.address}</Text> : null}
            {data.managerName ? <Text>Contact : {data.managerName}</Text> : null}
          </View>
          <View style={styles.block}>
            <Text style={styles.blockLabel}>Client</Text>
            <Text style={styles.bold}>{client.name}</Text>
            {client.address ? <Text>{client.address}</Text> : null}
            {(client.postalCode || client.city) ? <Text>{[client.postalCode, client.city].filter(Boolean).join(" ")}</Text> : null}
            {client.email ? <Text>{client.email}</Text> : null}
            {client.siret ? <Text>SIRET {client.siret}</Text> : null}
          </View>
        </View>

        {quote.subject ? <Text style={styles.subject}>Objet : {quote.subject}</Text> : null}

        <View style={styles.thead}>
          <Text style={styles.cLabel}>Désignation</Text>
          <Text style={styles.cQty}>Qté</Text>
          <Text style={styles.cPu}>PU HT</Text>
          <Text style={styles.cDisc}>Remise</Text>
          <Text style={styles.cVat}>TVA</Text>
          <Text style={styles.cTotal}>Total HT</Text>
        </View>
        {items.map((it, i) => (
          <View style={styles.tr} key={i}>
            <View style={styles.cLabel}>
              <Text>{it.label}</Text>
              {it.description ? <Text style={styles.desc}>{it.description}</Text> : null}
            </View>
            <Text style={styles.cQty}>{it.qty}</Text>
            <Text style={styles.cPu}>{euros(it.unitPriceCents)}</Text>
            <Text style={styles.cDisc}>{it.discountBps / 100}%</Text>
            <Text style={styles.cVat}>{vatLabel(it.vatBps)}</Text>
            <Text style={styles.cTotal}>{euros(it.lineTotalCents)}</Text>
          </View>
        ))}

        <View style={styles.totals}>
          <View style={styles.totalRow}><Text>Total HT</Text><Text>{euros(quote.subtotalCents)}</Text></View>
          <View style={styles.totalRow}><Text>TVA</Text><Text>{euros(quote.vatCents)}</Text></View>
          <View style={[styles.totalRow, styles.grandTotal]}><Text>Total TTC</Text><Text>{euros(quote.totalCents)}</Text></View>
        </View>

        <View style={styles.footer}>
          {quote.paymentTerms ? <Text>Conditions de paiement : {quote.paymentTerms}</Text> : null}
          {quote.notes ? <Text style={{ marginTop: 4 }}>{quote.notes}</Text> : null}
        </View>
      </Page>
    </Document>
  );
}

export async function renderQuotePdf(data: QuotePdfData): Promise<Buffer> {
  return renderToBuffer(<QuoteDocument data={data} />);
}
