export interface PostExample {
  id: string;
  title: string;
  hint: string;
  group: string;
  credential: Record<string, unknown>;
}

const NORTHWIND = "https://example.org/catalogue-demo/participants/northwind";
const HARBOUR = "https://example.org/catalogue-demo/participants/harbour-office";
const PORT_CALL = "https://example.org/catalogue-demo/offerings/port-call-api";
const BERTH = "https://example.org/catalogue-demo/resources/berth-schedule";
const TIDE = "https://example.org/catalogue-demo/offerings/tide-forecast";

const STEINWERK = "https://example.org/construct-x/participants/steinwerk-rhein";
const PASSPORT = "https://example.org/construct-x/data/element-passport";
const BATCH = "https://example.org/construct-x/data/delivery-batch-240";
const CATALOGUE = "https://example.org/construct-x/data/product-catalogue";

/**
 * Terms are inlined so they survive expansion when a remote vocabulary is not
 * loaded. Names use schema.org/name, which the explorer prints on the bubble.
 * Links are identifiers shared across this set, so storing the set draws edges.
 * Short literals show up beside a bubble once it is opened.
 */
const CONTEXT = [
  "https://www.w3.org/ns/credentials/v2",
  {
    name: "https://schema.org/name",
    description: "https://schema.org/description",
    country: "https://schema.org/addressCountry",
    LegalPerson: "https://w3id.org/gaia-x/2511#LegalPerson",
    ServiceOffering: "https://w3id.org/gaia-x/2511#ServiceOffering",
    DataProduct: "https://w3id.org/gaia-x/2511#DataProduct",
    DataProductCatalogue: "https://w3id.org/gaia-x/2511#DataProductCatalogue",
    Resource: "https://w3id.org/gaia-x/2511#Resource",
    registrationNumber: "https://w3id.org/gaia-x/2511#registrationNumber",
    keyword: "https://w3id.org/gaia-x/2511#keyword",
    subOrganisation: { "@id": "https://w3id.org/gaia-x/2511#subOrganisation", "@type": "@id" },
    providedBy: { "@id": "https://w3id.org/gaia-x/2511#providedBy", "@type": "@id" },
    aggregationOf: { "@id": "https://w3id.org/gaia-x/2511#aggregationOf", "@type": "@id" },
    operatedBy: { "@id": "https://w3id.org/gaia-x/2511#operatedBy", "@type": "@id" },
    dependsOn: { "@id": "https://w3id.org/gaia-x/2511#dependsOn", "@type": "@id" }
  }
];

function credential(
  id: string,
  subject: Record<string, unknown>,
  space = "catalogue-demo",
  issuer = "did:web:example.org"
): Record<string, unknown> {
  return {
    "@context": CONTEXT,
    id: `https://example.org/${space}/credentials/${id}`,
    type: ["VerifiableCredential", subject.type],
    issuer,
    validFrom: "2026-01-01T00:00:00Z",
    credentialSubject: subject
  };
}

function cx(id: string, subject: Record<string, unknown>): Record<string, unknown> {
  return credential(id, subject, "construct-x", "did:web:steinwerk.example");
}

export const POST_EXAMPLES: PostExample[] = [
  {
    id: "northwind",
    group: "Port demo",
    title: "Northwind Logistics",
    hint: "A legal person, and the hub of this set. Harbour Office hangs off it as a sub-organisation. The registration number and country appear when you open the bubble.",
    credential: credential("northwind", {
      id: NORTHWIND,
      type: "LegalPerson",
      name: "Northwind Logistics",
      description: "Port operator in Hamburg",
      registrationNumber: "HRB 120440",
      country: "Germany",
      subOrganisation: { id: HARBOUR }
    })
  },
  {
    id: "harbour-office",
    group: "Port demo",
    title: "Harbour Office",
    hint: "A second legal person. Northwind links to it, and Berth Schedule is operated by it. Store Northwind as well, or this bubble has no incoming line.",
    credential: credential("harbour-office", {
      id: HARBOUR,
      type: "LegalPerson",
      name: "Harbour Office",
      description: "Hamburg office of Northwind",
      registrationNumber: "HRB 44012",
      country: "Germany"
    })
  },
  {
    id: "port-call-api",
    group: "Port demo",
    title: "Port Call API",
    hint: "A service offering provided by Northwind. It aggregates Berth Schedule, so the two bubbles connect once both are stored.",
    credential: credential("port-call-api", {
      id: PORT_CALL,
      type: "ServiceOffering",
      name: "Port Call API",
      description: "Berth and arrival times",
      keyword: "logistics",
      providedBy: { id: NORTHWIND },
      aggregationOf: { id: BERTH }
    })
  },
  {
    id: "berth-schedule",
    group: "Port demo",
    title: "Berth Schedule",
    hint: "A resource operated by Harbour Office. Port Call API points at it, which is how a service and its data meet in the graph.",
    credential: credential("berth-schedule", {
      id: BERTH,
      type: "Resource",
      name: "Berth Schedule",
      description: "Hourly berth slots",
      keyword: "schedule",
      operatedBy: { id: HARBOUR }
    })
  },
  {
    id: "tide-forecast",
    group: "Port demo",
    title: "Tide Forecast",
    hint: "A service offering from Harbour Office that depends on Port Call API. That dependence is the line between the two services.",
    credential: credential("tide-forecast", {
      id: TIDE,
      type: "ServiceOffering",
      name: "Tide Forecast",
      description: "Live tide heights",
      keyword: "weather",
      providedBy: { id: HARBOUR },
      dependsOn: { id: PORT_CALL }
    })
  },
  {
    id: "steinwerk",
    group: "Construct-X",
    title: "Steinwerk Rhein",
    hint: "The Construct-X member that publishes the data assets. Element Passport and the product catalogue both point here.",
    credential: cx("steinwerk", {
      id: STEINWERK,
      type: "LegalPerson",
      name: "Steinwerk Rhein",
      description: "Precast plant in Cologne",
      registrationNumber: "HRB 90310",
      country: "Germany"
    })
  },
  {
    id: "element-passport",
    group: "Construct-X",
    title: "Element Passport",
    hint: "A data product for one precast element: mix and carbon data. Provided by Steinwerk Rhein. Delivery Batch depends on it.",
    credential: cx("element-passport", {
      id: PASSPORT,
      type: "DataProduct",
      name: "Element Passport",
      description: "Mix and carbon data",
      keyword: "concrete",
      providedBy: { id: STEINWERK }
    })
  },
  {
    id: "delivery-batch",
    group: "Construct-X",
    title: "Delivery Batch",
    hint: "A resource for elements delivered to one site. It depends on Element Passport, so the batch and the product data connect.",
    credential: cx("delivery-batch", {
      id: BATCH,
      type: "Resource",
      name: "Delivery Batch 240",
      description: "Elements for site 240",
      keyword: "batch",
      dependsOn: { id: PASSPORT }
    })
  },
  {
    id: "product-catalogue",
    group: "Construct-X",
    title: "Product Catalogue",
    hint: "A data product catalogue from Steinwerk Rhein. It aggregates Element Passport and Delivery Batch, which is the line from the catalogue to each asset.",
    credential: cx("product-catalogue", {
      id: CATALOGUE,
      type: "DataProductCatalogue",
      name: "Product Catalogue",
      description: "Lists published data",
      keyword: "catalogue",
      providedBy: { id: STEINWERK },
      aggregationOf: [{ id: PASSPORT }, { id: BATCH }]
    })
  }
];

export const EXAMPLE_GROUPS = [...new Set(POST_EXAMPLES.map((item) => item.group))];
