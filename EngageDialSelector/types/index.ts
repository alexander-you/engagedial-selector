/**
 * EngageDial Selector — Shared TypeScript Types
 * Version: 1.0.6
 */

/** A phone field definition with its source field name and display label. */
export interface PhoneFieldDef {
  field: string;
  label: string;
}

/** A single phone number entry with its display label and source field name. */
export interface PhoneNumber {
  label: string;
  /** Raw value as stored in Dataverse. */
  number: string;
  fieldName: string;
  /** True when the number passes E.164 validation. Invalid numbers are shown but not selectable. */
  isValid: boolean;
  /** E.164 normalized value (e.g. "+972542556677") when isValid is true; null otherwise. */
  normalized: string | null;
}

/** Resolved customer information from the Case customerid lookup. */
export interface CustomerInfo {
  id: string;
  name: string;
  entityType: "contact" | "account";
}

/**
 * The JSON payload written to alex_proactive_engagement when the agent
 * confirms a phone number selection.
 * Field names use PascalCase to align with the downstream Flow / unbound action
 * parameter names expected by the proactive engagement process.
 */
export interface EngagementPayload {
  RequestId: string;
  DestinationPhoneNumber: string;
  /** Contact record ID when the Case customer is a Contact; null for Account customers. */
  ContactId: string | null;
  CustomerId: string;
  CustomerType: "contact" | "account";
  CaseId: string;
  /** Current user ID as a clean lowercase GUID (no surrounding braces). */
  InitiatedBy: string;
  InitiatedOn: string;
  Source: "Proactive Engagement Phone Selector";
  /** Optional: the logical name of the Dataverse field that held the selected number. */
  SelectedPhoneField?: string;
  /** Optional: the display label of the field shown to the agent. */
  SelectedPhoneLabel?: string;
}

/** Internal UI state machine for the control. */
export type ControlState =
  | "loading"
  | "no-customer"
  | "no-phones"
  | "ready"
  | "error";
