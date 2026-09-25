/**
 * Fictional businesses used by the demo lead provider and demo enrichment.
 * All domains use the reserved `.example` TLD (RFC 2606) so no demo record can
 * ever point at, or email, a real company.
 */
export interface DemoBusiness {
  company_name: string;
  domain: string;
  industry: string;
  city: string;
  region: string;
  country: string;
  description: string;
  phone: string;
  /** Role address "published" on the demo website. */
  email: string | null;
  contact_name: string | null;
  contact_title: string | null;
  /** Text a crawler would have seen on the public homepage/contact page. */
  site_text: string;
}

export const DEMO_CATALOG: DemoBusiness[] = [
  {
    company_name: "Harbourside Family Dental", domain: "harboursidedental.example", industry: "Dental clinic",
    city: "Sydney", region: "NSW", country: "Australia", phone: "(02) 5550 1234", email: "reception@harboursidedental.example",
    contact_name: "Dr Priya Raman", contact_title: "Principal Dentist",
    description: "General and family dentistry practice in Sydney's inner west with three dentists.",
    site_text: "Family dentistry since 2004. Call to book an appointment. © 2016 Harbourside Family Dental. Site not optimised for mobile. No online booking form.",
  },
  {
    company_name: "Bayview Smiles", domain: "bayviewsmiles.example", industry: "Dental clinic",
    city: "Brisbane", region: "QLD", country: "Australia", phone: "(07) 5550 2211", email: "hello@bayviewsmiles.example",
    contact_name: null, contact_title: null,
    description: "Cosmetic and general dental clinic offering Invisalign and whitening.",
    site_text: "Now offering Invisalign. Book online 24/7. New patient special. © 2025 Bayview Smiles. Built on WordPress.",
  },
  {
    company_name: "Southbank Dental Studio", domain: "southbankdental.example", industry: "Dental clinic",
    city: "Melbourne", region: "VIC", country: "Australia", phone: "(03) 5550 3490", email: "info@southbankdental.example",
    contact_name: "Marcus Lee", contact_title: "Practice Manager",
    description: "Modern dental studio near Southbank; opened a second location in 2025.",
    site_text: "We've moved! Our second clinic in Docklands is now open. Enquiries via phone only. © 2018. WordPress theme 'Dentalia' v1.2.",
  },
  {
    company_name: "Kingsford Dental Care", domain: "kingsforddental.example", industry: "Dental clinic",
    city: "Sydney", region: "NSW", country: "Australia", phone: "(02) 5550 7781", email: "admin@kingsforddental.example",
    contact_name: null, contact_title: null,
    description: "Independent dental practice serving Kingsford and Randwick families.",
    site_text: "Emergency dental appointments available. Page last updated 2015. Contact form currently unavailable — please call.",
  },
  {
    company_name: "Northside Orthodontics", domain: "northsideortho.example", industry: "Orthodontist",
    city: "Brisbane", region: "QLD", country: "Australia", phone: "(07) 5550 6620", email: "contact@northsideortho.example",
    contact_name: "Dr Hannah Cole", contact_title: "Orthodontist & Owner",
    description: "Specialist orthodontic practice for children and adults.",
    site_text: "Braces and clear aligners. Free initial consultation. Online booking via third-party portal. © 2024.",
  },
  {
    company_name: "Perth Hills Dental", domain: "perthhillsdental.example", industry: "Dental clinic",
    city: "Perth", region: "WA", country: "Australia", phone: "(08) 5550 4412", email: "reception@perthhillsdental.example",
    contact_name: null, contact_title: null,
    description: "Community dental clinic in the Perth Hills offering general and children's dentistry.",
    site_text: "Serving the hills community for 20 years. Slow-loading image gallery. © 2017 Perth Hills Dental. Find us on Facebook.",
  },
  {
    company_name: "Adelaide Central Dental", domain: "adelaidecentraldental.example", industry: "Dental clinic",
    city: "Adelaide", region: "SA", country: "Australia", phone: "(08) 5550 9001", email: "info@adelaidecentraldental.example",
    contact_name: "Sophie Tran", contact_title: "Clinic Manager",
    description: "CBD dental clinic focused on busy professionals, open late weekdays.",
    site_text: "Open until 8pm weekdays. Book online. Health fund rebates on the spot. © 2023. Hiring: dental assistant.",
  },
  {
    company_name: "Gold Coast Kids Dentistry", domain: "gckidsdental.example", industry: "Paediatric dentist",
    city: "Gold Coast", region: "QLD", country: "Australia", phone: "(07) 5550 8123", email: "bookings@gckidsdental.example",
    contact_name: null, contact_title: null,
    description: "Paediatric dental practice for children and teens.",
    site_text: "Gentle dentistry for kids. Child Dental Benefits Schedule accepted. Website under construction. © 2019.",
  },
  {
    company_name: "Hobart Waterfront Dental", domain: "hobartdental.example", industry: "Dental clinic",
    city: "Hobart", region: "TAS", country: "Australia", phone: "(03) 5550 2277", email: null,
    contact_name: null, contact_title: null,
    description: "Small general dental practice on the Hobart waterfront.",
    site_text: "Call us to make an appointment. No email address listed. © 2014.",
  },
  {
    company_name: "Canberra Smile Centre", domain: "canberrasmile.example", industry: "Dental clinic",
    city: "Canberra", region: "ACT", country: "Australia", phone: "(02) 5550 3344", email: "hello@canberrasmile.example",
    contact_name: "Dr Tom Whitfield", contact_title: "Principal Dentist",
    description: "Family and cosmetic dentistry in Belconnen.",
    site_text: "Rebranded in 2025 — new name, same friendly team. Old website still shows previous brand on some pages. © 2025.",
  },
  {
    company_name: "Newcastle Dental Group", domain: "newcastledental.example", industry: "Dental group",
    city: "Newcastle", region: "NSW", country: "Australia", phone: "(02) 5550 5500", email: "enquiries@newcastledental.example",
    contact_name: null, contact_title: null,
    description: "Group practice with four locations across the Hunter region.",
    site_text: "Four locations. Each clinic has a separate website with different branding. Book online at some locations. © 2021.",
  },
  {
    company_name: "Geelong Coastal Dental", domain: "geelongdental.example", industry: "Dental clinic",
    city: "Geelong", region: "VIC", country: "Australia", phone: "(03) 5550 6781", email: "info@geelongdental.example",
    contact_name: null, contact_title: null,
    description: "General dentistry clinic in Geelong with sleep dentistry options.",
    site_text: "Sleep dentistry available. Book online via our new system. Fast, mobile-friendly site. © 2026.",
  },
  // ── other industries, so searches and qualification show realistic misses
  {
    company_name: "Riverside Physio & Pilates", domain: "riversidephysio.example", industry: "Physiotherapy",
    city: "Brisbane", region: "QLD", country: "Australia", phone: "(07) 5550 1100", email: "team@riversidephysio.example",
    contact_name: null, contact_title: null,
    description: "Physiotherapy and clinical pilates studio.",
    site_text: "Clinical pilates classes. Book via phone. © 2017. Timetable is a PDF download.",
  },
  {
    company_name: "Eastwood Physiotherapy", domain: "eastwoodphysio.example", industry: "Physiotherapy",
    city: "Sydney", region: "NSW", country: "Australia", phone: "(02) 5550 1919", email: "info@eastwoodphysio.example",
    contact_name: "Liam O'Brien", contact_title: "Director",
    description: "Sports and musculoskeletal physiotherapy clinic.",
    site_text: "Sports injury specialists. Online booking. © 2024.",
  },
  {
    company_name: "Collins & Hart Lawyers", domain: "collinshart.example", industry: "Law firm",
    city: "Melbourne", region: "VIC", country: "Australia", phone: "(03) 5550 4040", email: "enquiries@collinshart.example",
    contact_name: null, contact_title: null,
    description: "Boutique family and property law firm.",
    site_text: "Family law and conveyancing. Free 15 minute phone consultation. © 2016.",
  },
  {
    company_name: "Summit Accounting Partners", domain: "summitaccounting.example", industry: "Accounting firm",
    city: "Perth", region: "WA", country: "Australia", phone: "(08) 5550 7070", email: "office@summitaccounting.example",
    contact_name: null, contact_title: null,
    description: "Accounting and advisory for small businesses and trades.",
    site_text: "Tax returns and BAS. Client portal login. © 2020.",
  },
  {
    company_name: "Little Lane Café", domain: "littlelanecafe.example", industry: "Café",
    city: "Adelaide", region: "SA", country: "Australia", phone: "(08) 5550 3030", email: "hi@littlelanecafe.example",
    contact_name: null, contact_title: null,
    description: "Specialty coffee and brunch café.",
    site_text: "Menu on Instagram. Open 7am–3pm. Single-page site. © 2022.",
  },
  {
    company_name: "Auckland Bay Dental", domain: "aucklandbaydental.example", industry: "Dental clinic",
    city: "Auckland", region: "Auckland", country: "New Zealand", phone: "+64 9 555 0199", email: "info@aucklandbaydental.example",
    contact_name: null, contact_title: null,
    description: "General dental practice in Auckland.",
    site_text: "Book by phone. © 2018.",
  },
];

export function demoBusinessByDomain(domain: string | null | undefined): DemoBusiness | undefined {
  if (!domain) return undefined;
  return DEMO_CATALOG.find((b) => b.domain === domain.toLowerCase());
}
