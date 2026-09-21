import { Mail, Phone, MapPin } from "lucide-react";
import { getSiteSettings } from "@/modules/site/queries";
import { ContactForm } from "@/modules/site/contact-form";

export const metadata = { title: "Contact — ISOPoz" };

export default async function ContactPage() {
  const s = await getSiteSettings();
  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <h1 className="text-3xl font-bold">Contact</h1>
      <p className="mt-2 text-muted-foreground">Une question, un projet ? Écrivez-nous, réponse rapide garantie.</p>

      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">
          {s.email && (
            <div className="flex items-start gap-3"><Mail className="mt-0.5 size-5 text-primary" /><div><p className="font-medium">Email</p><p className="text-sm text-muted-foreground">{s.email}</p></div></div>
          )}
          {s.phone && (
            <div className="flex items-start gap-3"><Phone className="mt-0.5 size-5 text-primary" /><div><p className="font-medium">Téléphone</p><p className="text-sm text-muted-foreground">{s.phone}</p></div></div>
          )}
          {s.address && (
            <div className="flex items-start gap-3"><MapPin className="mt-0.5 size-5 text-primary" /><div><p className="font-medium">Adresse</p><p className="text-sm text-muted-foreground">{s.address}</p></div></div>
          )}
        </div>
        <div className="lg:col-span-2">
          <ContactForm />
        </div>
      </div>
    </div>
  );
}
