/**
 * Proactive Engagement Phone Selector — Dataverse Web API Service
 * Version: 1.0.6
 *
 * Retrieves customer information and phone numbers from Dataverse using the
 * PCF Web API context. Phone field sets are passed in at runtime from the
 * PCF manifest configuration properties, allowing system customizers to
 * control which fields are queried and displayed per control instance.
 * Phone numbers are validated and normalized to E.164 format before being
 * returned; invalid numbers are included in the list but flagged accordingly.
 */

import { PhoneNumber, CustomerInfo, PhoneFieldDef } from "../types";
import { validatePhone } from "../utils/phoneValidation";

// ---------------------------------------------------------------------------
// OData annotation keys produced by the Dataverse Web API for polymorphic
// Customer lookups (customerid field on the incident table).
// ---------------------------------------------------------------------------
const LOOKUP_ENTITY_TYPE_KEY =
  "_customerid_value@Microsoft.Dynamics.CRM.lookuplogicalname";
const LOOKUP_DISPLAY_NAME_KEY =
  "_customerid_value@OData.Community.Display.V1.FormattedValue";
const LOOKUP_VALUE_KEY = "_customerid_value";

// ---------------------------------------------------------------------------
// Public functions
// ---------------------------------------------------------------------------

/**
 * Reads the Case record to resolve the customer (Contact or Account).
 * Used as a fallback when the customerId property is not bound in the form.
 */
export async function fetchCustomerFromCase(
  webApi: ComponentFramework.WebApi,
  caseId: string
): Promise<CustomerInfo | null> {
  const result = await webApi.retrieveRecord(
    "incident",
    caseId,
    `?$select=${LOOKUP_VALUE_KEY}`
  );

  const customerId = getEntityString(result, LOOKUP_VALUE_KEY);
  if (!customerId) return null;

  const entityType = getEntityString(result, LOOKUP_ENTITY_TYPE_KEY);
  const displayName = getEntityString(result, LOOKUP_DISPLAY_NAME_KEY) ?? "";

  if (!entityType) {
    console.warn("[EngageDial] Customer entity type annotation missing. Cannot determine Contact vs Account.");
    return null;
  }

  return {
    id: customerId,
    name: displayName,
    entityType: entityType as "contact" | "account",
  };
}

/**
 * Retrieves phone numbers from a Contact record using the configured field set.
 * Empty values and duplicates are automatically removed.
 */
export async function fetchContactPhones(
  webApi: ComponentFramework.WebApi,
  contactId: string,
  fields: readonly PhoneFieldDef[]
): Promise<PhoneNumber[]> {
  if (fields.length === 0) return [];
  const select = fields.map((f) => f.field).join(",");
  const result = await webApi.retrieveRecord("contact", contactId, `?$select=${select}`);
  return extractPhoneNumbers(result, fields);
}

/**
 * Retrieves phone numbers from an Account record using the configured field set.
 * Does NOT retrieve numbers from the Account's Primary Contact or related Contacts.
 * Empty values and duplicates are automatically removed.
 */
export async function fetchAccountPhones(
  webApi: ComponentFramework.WebApi,
  accountId: string,
  fields: readonly PhoneFieldDef[]
): Promise<PhoneNumber[]> {
  if (fields.length === 0) return [];
  const select = fields.map((f) => f.field).join(",");
  const result = await webApi.retrieveRecord("account", accountId, `?$select=${select}`);
  return extractPhoneNumbers(result, fields);
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function extractPhoneNumbers(
  record: ComponentFramework.WebApi.Entity,
  fieldDefs: readonly PhoneFieldDef[]
): PhoneNumber[] {
  const seenRaw = new Set<string>();
  const seenNormalized = new Set<string>();
  const phones: PhoneNumber[] = [];

  for (const def of fieldDefs) {
    const value = getEntityString(record, def.field);
    if (!value) continue;

    // Deduplicate by raw value first
    if (seenRaw.has(value)) continue;
    seenRaw.add(value);

    const { isValid, normalized } = validatePhone(value);

    // Also deduplicate valid numbers by their normalized form
    if (isValid && normalized) {
      if (seenNormalized.has(normalized)) continue;
      seenNormalized.add(normalized);
    }

    phones.push({ label: def.label, number: value, fieldName: def.field, isValid, normalized });
  }

  return phones;
}

/** Safely reads a string value from a Dataverse Web API entity record. */
function getEntityString(
  record: ComponentFramework.WebApi.Entity,
  key: string
): string | null {
  const raw: unknown = record[key] as unknown;
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  return null;
}
