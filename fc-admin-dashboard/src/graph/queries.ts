import {
  RDF,
  assertReadQuery,
  quoteLiteral,
  sparqlIri
} from "./terms";

const LOBBY_LIMIT = 28;
const LINK_LIMIT = 80;
const NEIGHBOR_LIMIT = 60;
const SEARCH_LIMIT = 24;

const NAME_IRIS = [RDF.name, RDF.schemaName, RDF.label, RDF.title];

function nameFilter(variable: string): string {
  return `FILTER(${variable} IN (${NAME_IRIS.map((iri) => `<${iri}>`).join(", ")}))`;
}

function starLobby(): string {
  return `SELECT ?subject (SAMPLE(?name) AS ?label) (SAMPLE(?type) AS ?kind)
WHERE {
  <<(?subject ?p ?o)>> <${RDF.credential}> ?cs .
  OPTIONAL {
    <<(?subject ?np ?name)>> <${RDF.credential}> ?csName .
    ${nameFilter("?np")}
  }
  OPTIONAL {
    <<(?subject <${RDF.type}> ?type)>> <${RDF.credential}> ?csType .
  }
}
GROUP BY ?subject
ORDER BY ?subject
LIMIT ${LOBBY_LIMIT}`;
}

function plainLobby(): string {
  return `SELECT ?subject (SAMPLE(?name) AS ?label) (SAMPLE(?type) AS ?kind)
WHERE {
  ?subject ?p ?o .
  OPTIONAL {
    ?subject ?np ?name .
    ${nameFilter("?np")}
  }
  OPTIONAL { ?subject <${RDF.type}> ?type . }
}
GROUP BY ?subject
ORDER BY ?subject
LIMIT ${LOBBY_LIMIT}`;
}

function starLinks(iris: string[]): string {
  const values = iris.map((iri) => sparqlIri(iri)).join(" ");
  return `SELECT ?subject ?predicate ?object
WHERE {
  VALUES ?subject { ${values} }
  <<(?subject ?predicate ?object)>> <${RDF.credential}> ?cs .
  FILTER(isIRI(?object))
  FILTER(?predicate != <${RDF.type}>)
}
LIMIT ${LINK_LIMIT}`;
}

function plainLinks(iris: string[]): string {
  const values = iris.map((iri) => sparqlIri(iri)).join(" ");
  return `SELECT ?subject ?predicate ?object
WHERE {
  VALUES ?subject { ${values} }
  ?subject ?predicate ?object .
  FILTER(isIRI(?object))
  FILTER(?predicate != <${RDF.type}>)
}
LIMIT ${LINK_LIMIT}`;
}

function starNeighborhood(iri: string): string {
  const term = sparqlIri(iri);
  return `SELECT ?subject ?predicate ?object
WHERE {
  {
    <<(${term} ?predicate ?object)>> <${RDF.credential}> ?cs .
    BIND(${term} AS ?subject)
  }
  UNION
  {
    <<(?subject ?predicate ${term})>> <${RDF.credential}> ?cs .
    BIND(${term} AS ?object)
  }
}
LIMIT ${NEIGHBOR_LIMIT}`;
}

function plainNeighborhood(iri: string): string {
  const term = sparqlIri(iri);
  return `SELECT ?subject ?predicate ?object
WHERE {
  { ${term} ?predicate ?object . BIND(${term} AS ?subject) }
  UNION
  { ?subject ?predicate ${term} . BIND(${term} AS ?object) }
}
LIMIT ${NEIGHBOR_LIMIT}`;
}

function starNames(iris: string[]): string {
  const values = iris.map((iri) => sparqlIri(iri)).join(" ");
  return `SELECT ?subject (SAMPLE(?name) AS ?label) (SAMPLE(?type) AS ?kind)
WHERE {
  VALUES ?subject { ${values} }
  OPTIONAL {
    <<(?subject ?np ?name)>> <${RDF.credential}> ?csName .
    ${nameFilter("?np")}
  }
  OPTIONAL {
    <<(?subject <${RDF.type}> ?type)>> <${RDF.credential}> ?csType .
  }
}
GROUP BY ?subject
LIMIT ${iris.length}`;
}

function plainNames(iris: string[]): string {
  const values = iris.map((iri) => sparqlIri(iri)).join(" ");
  return `SELECT ?subject (SAMPLE(?name) AS ?label) (SAMPLE(?type) AS ?kind)
WHERE {
  VALUES ?subject { ${values} }
  OPTIONAL {
    ?subject ?np ?name .
    ${nameFilter("?np")}
  }
  OPTIONAL { ?subject <${RDF.type}> ?type . }
}
GROUP BY ?subject
LIMIT ${iris.length}`;
}

const GENERIC_IRI = /^https?:\/\/(?:schema\.org|www\.w3\.org|purl\.org|w3id\.org)(?:[/#?]|$)/i;

/**
 * Pieces of a pasted query cell worth looking up.
 * A quoted triple is split into its own identifier and quoted text.
 * A plain identifier or name is kept whole.
 */
export function searchValues(term: string): string[] {
  const compact = term.replace(/\s+/g, " ").trim();
  const lower = compact.toLowerCase();
  if (lower.length < 2) return [];
  if (!lower.startsWith("<<")) return [lower];

  const iris = [...lower.matchAll(/https?:\/\/[^\s<>"')]+/g)].map((match) => match[0]);
  const quoted = [...compact.matchAll(/"([^"]{2,})"/g)].flatMap((match) => {
    const text = match[1]?.trim().toLowerCase();
    return text && text.length >= 2 ? [text] : [];
  });
  const specific = iris.filter((iri) => !GENERIC_IRI.test(iri));
  const chosen = specific.length > 0 ? specific : iris.slice(0, 1);
  const values = [...new Set([...chosen, ...quoted])];
  return values.length > 0 ? values : [lower];
}

function matchAny(variable: string, values: string[]): string {
  return values
    .map((value) => {
      const needle = quoteLiteral(value);
      const text = `LCASE(STR(${variable}))`;
      return `CONTAINS(${text}, ${needle}) || (isIRI(${variable}) && STRLEN(${text}) >= 12 && CONTAINS(${needle}, ${text}))`;
    })
    .join(" || ");
}

function searchFilter(values: string[], variables: string[]): string {
  const checks = variables.map((variable) => matchAny(variable, values));
  const annotation = `LCASE(STR(<${RDF.credential}>))`;
  for (const value of values) {
    const needle = quoteLiteral(value);
    checks.push(`(CONTAINS(${annotation}, ${needle}) && CONTAINS(${needle}, "credentialsubject"))`);
  }
  return `FILTER(${checks.join(" || ")})`;
}

function starSearch(values: string[]): string {
  return `SELECT ?subject (SAMPLE(?name) AS ?label) (SAMPLE(?type) AS ?kind)
WHERE {
  <<(?subject ?p ?o)>> <${RDF.credential}> ?cs .
  ${searchFilter(values, ["?subject", "?p", "?o", "?cs"])}
  OPTIONAL {
    <<(?subject ?np ?name)>> <${RDF.credential}> ?csName .
    ${nameFilter("?np")}
  }
  OPTIONAL {
    <<(?subject <${RDF.type}> ?type)>> <${RDF.credential}> ?csType .
  }
}
GROUP BY ?subject
ORDER BY ?subject
LIMIT ${SEARCH_LIMIT}`;
}

function plainSearch(values: string[]): string {
  return `SELECT ?subject (SAMPLE(?name) AS ?label) (SAMPLE(?type) AS ?kind)
WHERE {
  ?subject ?p ?o .
  ${searchFilter(values, ["?subject", "?p", "?o"])}
  OPTIONAL {
    ?subject ?np ?name .
    ${nameFilter("?np")}
  }
  OPTIONAL { ?subject <${RDF.type}> ?type . }
}
GROUP BY ?subject
ORDER BY ?subject
LIMIT ${SEARCH_LIMIT}`;
}

function starType(type: string): string {
  const term = sparqlIri(type);
  return `SELECT ?subject (SAMPLE(?name) AS ?label) (SAMPLE(?type) AS ?kind)
WHERE {
  <<(?subject <${RDF.type}> ${term})>> <${RDF.credential}> ?cs .
  OPTIONAL {
    <<(?subject ?np ?name)>> <${RDF.credential}> ?csName .
    ${nameFilter("?np")}
  }
  OPTIONAL {
    <<(?subject <${RDF.type}> ?type)>> <${RDF.credential}> ?csType .
  }
}
GROUP BY ?subject
ORDER BY ?subject
LIMIT ${SEARCH_LIMIT}`;
}

function plainType(type: string): string {
  const term = sparqlIri(type);
  return `SELECT ?subject (SAMPLE(?name) AS ?label) (SAMPLE(?type) AS ?kind)
WHERE {
  ?subject <${RDF.type}> ${term} .
  OPTIONAL {
    ?subject ?np ?name .
    ${nameFilter("?np")}
  }
  OPTIONAL { ?subject <${RDF.type}> ?type . }
}
GROUP BY ?subject
ORDER BY ?subject
LIMIT ${SEARCH_LIMIT}`;
}

function cypherLobby(): string {
  return `MATCH (n:Resource)
RETURN n.uri AS subject, coalesce(n.name, n.label) AS name, labels(n) AS types
ORDER BY subject
LIMIT ${LOBBY_LIMIT}`;
}

function cypherLinks(iris: string[]): string {
  const list = iris.map((iri) => quoteLiteral(iri)).join(", ");
  return `MATCH (a:Resource)-[r]->(b:Resource)
WHERE a.uri IN [${list}] AND b.uri IS NOT NULL
RETURN a.uri AS subject, type(r) AS predicate, b.uri AS object, coalesce(b.name, b.label) AS objectName, labels(b) AS objectTypes
ORDER BY subject, predicate
LIMIT ${LINK_LIMIT}`;
}

function cypherNode(iri: string): string {
  const quoted = quoteLiteral(iri);
  return `MATCH (n:Resource {uri: ${quoted}})
RETURN n.uri AS uri, coalesce(n.name, n.label) AS name, labels(n) AS types, properties(n) AS props
LIMIT 1`;
}

function cypherNodePlain(iri: string): string {
  const quoted = quoteLiteral(iri);
  return `MATCH (n:Resource {uri: ${quoted}})
RETURN n.uri AS uri, coalesce(n.name, n.label) AS name, labels(n) AS types
LIMIT 1`;
}

function cypherHops(iri: string): string {
  const quoted = quoteLiteral(iri);
  return `MATCH (n:Resource {uri: ${quoted}})-[r]-(m:Resource)
WHERE m.uri IS NOT NULL AND m.uri <> n.uri
RETURN CASE WHEN startNode(r) = n THEN "out" ELSE "in" END AS direction, type(r) AS predicate, m.uri AS uri, coalesce(m.name, m.label) AS name, labels(m) AS types
LIMIT ${NEIGHBOR_LIMIT}`;
}

function cypherSearch(term: string): string {
  const needle = quoteLiteral(term);
  return `MATCH (n:Resource)
WHERE toLower(coalesce(toString(n.uri), "")) CONTAINS ${needle}
   OR toLower(coalesce(toString(n.name), "")) CONTAINS ${needle}
   OR toLower(coalesce(toString(n.label), "")) CONTAINS ${needle}
   OR any(key IN keys(n) WHERE toLower(coalesce(toString(n[key]), "")) CONTAINS ${needle})
RETURN n.uri AS subject, coalesce(n.name, n.label) AS name, labels(n) AS types
ORDER BY subject
LIMIT ${SEARCH_LIMIT}`;
}

function cypherType(type: string): string {
  const label = quoteLiteral(type);
  return `MATCH (n:Resource)
WHERE ${label} IN labels(n)
RETURN n.uri AS subject, coalesce(n.name, n.label) AS name, labels(n) AS types
ORDER BY subject
LIMIT ${SEARCH_LIMIT}`;
}

export const LIMITS = {
  lobby: LOBBY_LIMIT,
  search: SEARCH_LIMIT,
  links: LINK_LIMIT,
  neighbor: NEIGHBOR_LIMIT
};

/** The same listing the query page uses for "Anything stored". */
export function wrapperQuery(limit: number): string {
  return assertReadQuery(`SELECT ?subject ?predicate ?object
WHERE { ?subject ?predicate ?object }
LIMIT ${limit}`);
}

export function lobbyQueries(cypher: boolean): string[] {
  return (cypher ? [cypherLobby()] : [starLobby(), plainLobby()]).map(assertReadQuery);
}

export function linkQuery(cypher: boolean, iris: string[]): string | null {
  const safe = iris.filter(canEmbed);
  if (safe.length === 0) return null;
  return assertReadQuery(cypher ? cypherLinks(safe) : starLinks(safe));
}

export function plainLinkQuery(iris: string[]): string | null {
  const safe = iris.filter(canEmbed);
  if (safe.length === 0) return null;
  return assertReadQuery(plainLinks(safe));
}

function canEmbed(iri: string): boolean {
  try {
    sparqlIri(iri);
    quoteLiteral(iri);
    return true;
  } catch {
    return false;
  }
}

export function neighborhoodQueries(iri: string): string[] {
  return [starNeighborhood(iri), plainNeighborhood(iri)].map(assertReadQuery);
}

export function nameQueries(iris: string[]): string[] {
  const safe = iris.filter(canEmbed);
  if (safe.length === 0) return [];
  return [starNames(safe), plainNames(safe)].map(assertReadQuery);
}

export function searchQueries(cypher: boolean, term: string): string[] {
  if (cypher) return [cypherSearch(term.trim().toLowerCase())].map(assertReadQuery);
  const values = searchValues(term);
  if (values.length === 0) throw new Error("Type at least 2 characters.");
  return [starSearch(values), plainSearch(values)].map(assertReadQuery);
}

export function typeQueries(cypher: boolean, type: string): string[] {
  if (cypher) return [assertReadQuery(cypherType(type))];
  return [starType(type), plainType(type)].map(assertReadQuery);
}

export function nodeQueries(iri: string): string[] {
  return [cypherNode(iri), cypherNodePlain(iri)].map(assertReadQuery);
}

export function hopQuery(iri: string): string {
  return assertReadQuery(cypherHops(iri));
}
