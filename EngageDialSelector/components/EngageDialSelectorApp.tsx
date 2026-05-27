/**
 * Proactive Engagement Phone Selector — Main React Application Component
 * Version: 1.0.6
 *
 * Renders the full control UI. Supports five visual states:
 *   loading     → spinner while fetching customer data
 *   no-customer → empty state when Case has no customer
 *   no-phones   → empty state when customer has no phone numbers
 *   ready       → selectable phone cards + "Prepare engagement" button
 *   error       → user-friendly error with console diagnostics
 *
 * A success banner is shown inline (within the ready state) after the agent
 * confirms a selection. This avoids a full state transition and lets the agent
 * change their selection immediately if needed.
 */

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { IInputs } from "../generated/ManifestTypes";
import { PhoneNumber, CustomerInfo, ControlState, PhoneFieldDef } from "../types";
import {
  fetchCustomerFromCase,
  fetchContactPhones,
  fetchAccountPhones,
} from "../services/DataverseService";
import { PhoneCard } from "./PhoneCard";
import { generateGuid } from "../utils/guid";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface IEngageDialSelectorAppProps {
  context: ComponentFramework.Context<IInputs>;
  onPayloadReady: (payload: string | null) => void;
  /** Incremented by index.ts whenever customerid changes on the form. */
  customerReloadVersion: number;
  /** Resolved Contact phone fields from the manifest configuration properties. */
  contactFields: PhoneFieldDef[];
  /** Resolved Account phone fields from the manifest configuration properties. */
  accountFields: PhoneFieldDef[];
  /**
   * Initial panel display mode from the manifest "Default Display Mode" property.
   * Expanded = always open; Collapsed = always closed initially;
   * Auto = collapsed when an existing engagement payload is present.
   */
  defaultDisplayMode: "Expanded" | "Collapsed" | "Auto";
  /**
   * The current raw value of alex_proactive_engagement when the control loads.
   * Used only for Auto mode to decide the initial expanded/collapsed state.
   */
  currentEngagementValue: string;
}

// ---------------------------------------------------------------------------
// Internal type for the undocumented-but-stable PCF contextInfo object.
// ---------------------------------------------------------------------------
interface PCFContextInfo {
  entityId?: string;
  id?: string;
}

interface PCFUserSettings {
  userId?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const EngageDialSelectorApp: React.FC<IEngageDialSelectorAppProps> = ({
  context,
  onPayloadReady,
  customerReloadVersion,
  contactFields,
  accountFields,
  defaultDisplayMode,
  currentEngagementValue,
}) => {
  const [controlState, setControlState] = useState<ControlState>("loading");
  const [customer, setCustomer] = useState<CustomerInfo | null>(null);
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successVisible, setSuccessVisible] = useState(false);

  // Expand/collapse state — initialised once from the configured default.
  // The lazy initialiser runs only on mount; user toggling takes over after that.
  const [isPanelExpanded, setIsPanelExpanded] = useState<boolean>(() => {
    if (defaultDisplayMode === "Collapsed") return false;
    if (defaultDisplayMode === "Auto") return !currentEngagementValue;
    return true; // "Expanded" (default)
  });

  // Re-run whenever the parent signals that customerid changed.
  useEffect(() => {
    void loadCustomerData();
  }, [customerReloadVersion]);

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /** Safely reads the Case record ID from the PCF form context. */
  function getCaseId(): string | null {
    const modeAccess = context.mode as unknown as { contextInfo?: PCFContextInfo };
    const ci = modeAccess.contextInfo;
    return ci?.entityId ?? ci?.id ?? null;
  }

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  async function loadCustomerData(): Promise<void> {
    setControlState("loading");
    setSelectedPhone(null);
    setSuccessVisible(false);
    setErrorMessage("");

    try {
      let customerInfo: CustomerInfo | null = null;

      // --- Primary: read from the bound customerId PCF property ---
      const raw = context.parameters.customerId?.raw;
      if (raw && raw.length > 0) {
        const lookup = raw[0];
        customerInfo = {
          id: lookup.id,
          name: lookup.name ?? "",
          entityType: lookup.entityType as "contact" | "account",
        };
      } else {
        // --- Fallback: fetch the Case record via Web API ---
        const caseId = getCaseId();
        if (!caseId) {
          console.error(
            "[EngageDial] Case ID unavailable. Ensure the control is placed on the Case (incident) form."
          );
          setControlState("error");
          setErrorMessage(
            "We could not load the customer phone numbers. Please refresh the form or contact your administrator."
          );
          return;
        }
        customerInfo = await fetchCustomerFromCase(context.webAPI, caseId);
      }

      if (!customerInfo) {
        setControlState("no-customer");
        return;
      }

      setCustomer(customerInfo);

      // --- Fetch phone numbers ---
      let phones: PhoneNumber[] = [];
      if (customerInfo.entityType === "contact") {
        phones = await fetchContactPhones(context.webAPI, customerInfo.id, contactFields);
      } else if (customerInfo.entityType === "account") {
        phones = await fetchAccountPhones(context.webAPI, customerInfo.id, accountFields);
      } else {
        console.warn(
          `[EngageDial] Unsupported customer type: "${String(customerInfo.entityType)}". Only contact and account are supported.`
        );
        setControlState("error");
        setErrorMessage(
          `Unsupported customer type: "${String(customerInfo.entityType)}". Only Contact and Account are supported.`
        );
        return;
      }

      setPhoneNumbers(phones);
      setControlState(phones.length === 0 ? "no-phones" : "ready");
    } catch (err) {
      console.error("[EngageDial] Error loading customer data:", err);
      setControlState("error");
      setErrorMessage(
        "We could not load the customer phone numbers. Please refresh the form or contact your administrator."
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------

  const handleSelect = useCallback((number: string) => {
    setSelectedPhone((prev) => (prev === number ? null : number));
    setSuccessVisible(false);
    setErrorMessage("");
  }, []);

  const handlePrepare = useCallback(() => {
    if (!selectedPhone || !customer) return;

    // Locate the full PhoneNumber entry to use the normalized E.164 value
    const selectedEntry = phoneNumbers.find((p) => p.number === selectedPhone);

    // Defensive: block submission if the selected entry is invalid or has no normalized value
    if (!selectedEntry?.isValid || !selectedEntry.normalized) {
      setErrorMessage(
        "Invalid phone number format. Please update the customer phone number before preparing proactive engagement."
      );
      return;
    }

    try {
      const caseId = getCaseId() ?? "";
      const contextAccess = context as unknown as { userSettings?: PCFUserSettings };
      const rawUserId: string = contextAccess.userSettings?.userId ?? "";

      // Normalize userId: strip surrounding braces and lowercase so the
      // downstream Flow receives a clean GUID (e.g. "d8d38f1e-10c4-f011-...").
      const initiatedBy = rawUserId.replace(/^\{(.+)\}$/, "$1").toLowerCase();

      const payload = {
        RequestId: generateGuid(),
        // Use the E.164 normalized value, not the raw string from Dataverse
        DestinationPhoneNumber: selectedEntry.normalized,
        // ContactId is set only for Contact customers; Account ID must not flow here.
        ContactId: customer.entityType === "contact" ? customer.id : null,
        CustomerId: customer.id,
        CustomerType: customer.entityType,
        CaseId: caseId,
        InitiatedBy: initiatedBy,
        InitiatedOn: new Date().toISOString(),
        Source: "Proactive Engagement Phone Selector",
        SelectedPhoneField: selectedEntry.fieldName,
        SelectedPhoneLabel: selectedEntry.label,
      };

      onPayloadReady(JSON.stringify(payload));
      setSuccessVisible(true);
      setErrorMessage("");
    } catch (err) {
      console.error("[EngageDial] Error preparing engagement payload:", err);
      setErrorMessage(
        "We could not prepare the engagement request. Please try again or contact your administrator."
      );
      setSuccessVisible(false);
    }
  }, [selectedPhone, customer, phoneNumbers, context, onPayloadReady]);

  const handleToggle = useCallback(() => {
    setIsPanelExpanded((prev) => !prev);
  }, []);

  // ---------------------------------------------------------------------------
  // Collapsed meta line — describes the current state in one short line
  // ---------------------------------------------------------------------------

  function getCollapsedMeta(): string {
    if (controlState === "loading") return "Loading...";
    if (controlState === "error") return "Unable to load customer data";
    if (controlState === "no-customer") return "No customer selected";

    if (selectedPhone) {
      const found = phoneNumbers.find((p) => p.number === selectedPhone);
      return `Selected: ${selectedPhone}${found ? ` · ${found.label}` : ""}`;
    }

    const typeLabel = customer?.entityType === "contact" ? "Contact" : "Account";
    if (controlState === "no-phones" || phoneNumbers.length === 0) {
      return customer ? `${customer.name} · ${typeLabel} · No phone numbers` : "No phone numbers";
    }

    const validCount = phoneNumbers.filter((p) => p.isValid).length;
    const invalidCount = phoneNumbers.length - validCount;
    const countLabel = `${validCount} number${validCount !== 1 ? "s" : ""} available${invalidCount > 0 ? ` · ${invalidCount} invalid` : ""}`;
    return `${customer?.name ?? ""} · ${typeLabel} · ${countLabel}`;
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="engagedial-root">
      <div className="engagedial-card engagedial-card--collapsible">
        <ToggleBar
          isExpanded={isPanelExpanded}
          meta={getCollapsedMeta()}
          onToggle={handleToggle}
        />
        {isPanelExpanded && (
          <div className="engagedial-body">{renderContent()}</div>
        )}
      </div>
    </div>
  );

  function renderContent(): React.ReactNode {
    // --- Loading ---
    if (controlState === "loading") {
      return (
        <div className="engagedial-state-loading">
          <div className="engagedial-spinner" />
          <span>Loading customer phone numbers...</span>
        </div>
      );
    }

    // --- No customer ---
    if (controlState === "no-customer") {
      return (
        <div className="engagedial-state-info">
          <div className="engagedial-state-icon">
            <InfoIcon />
          </div>
          <h4 className="engagedial-state-title">No customer selected</h4>
          <p className="engagedial-state-message">
            No customer is selected on this Case.
            <br />
            Please select a customer before starting a proactive engagement.
          </p>
        </div>
      );
    }

    // --- No phones ---
    if (controlState === "no-phones") {
      return (
        <>
          {customer && <CustomerRow customer={customer} />}
          <div className="engagedial-state-info">
            <div className="engagedial-state-icon">
              <PhoneOffIcon />
            </div>
            <h4 className="engagedial-state-title">No phone numbers found</h4>
            <p className="engagedial-state-message">
              No phone numbers were found for this customer.
            </p>
          </div>
        </>
      );
    }

    // --- Error ---
    if (controlState === "error") {
      return (
        <div className="engagedial-state-info">
          <div className="engagedial-state-icon">
            <WarningIcon />
          </div>
          <h4 className="engagedial-state-title">Something went wrong</h4>
          <p className="engagedial-state-message">{errorMessage}</p>
        </div>
      );
    }

    // --- Ready (default) ---
    return (
      <>
        <CardHeader showSubtitle={true} />
        {customer && <CustomerRow customer={customer} />}

        <div className="engagedial-section-label">Available numbers</div>
        <div
          className="engagedial-phone-list"
          role="radiogroup"
          aria-label="Customer phone numbers"
        >
          {phoneNumbers.map((phone) => (
            <PhoneCard
              key={phone.number}
              phone={phone}
              isSelected={selectedPhone === phone.number}
              onSelect={handleSelect}
            />
          ))}
        </div>

        <div className="engagedial-action-row">
          <button
            className="engagedial-btn engagedial-btn-primary"
            onClick={handlePrepare}
            disabled={!selectedPhone || !phoneNumbers.find((p) => p.number === selectedPhone)?.isValid}
            aria-label="Prepare proactive engagement with selected phone number"
          >
            <CheckIcon />
            Prepare engagement
          </button>
        </div>

        {successVisible && (
          <div className="engagedial-banner engagedial-banner-success" role="status" aria-live="polite">
            <span className="engagedial-banner-icon">
              <SuccessIcon />
            </span>
            <span className="engagedial-banner-text">
              Engagement request prepared successfully.
            </span>
          </div>
        )}

        {errorMessage && (
          <div className="engagedial-banner engagedial-banner-error" role="alert">
            <span className="engagedial-banner-icon">
              <ErrorIcon />
            </span>
            <span className="engagedial-banner-text">{errorMessage}</span>
          </div>
        )}
      </>
    );
  }
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const ToggleBar: React.FC<{
  isExpanded: boolean;
  meta: string;
  onToggle: () => void;
}> = ({ isExpanded, meta, onToggle }) => (
  <button
    className="engagedial-toggle-bar"
    onClick={onToggle}
    aria-expanded={isExpanded}
    aria-label={isExpanded ? "Collapse phone selector" : "Expand phone selector"}
  >
    <PhoneLineIcon />
    <span className="engagedial-toggle-bar__meta">{meta}</span>
    <ChevronIcon expanded={isExpanded} />
  </button>
);

const ChevronIcon: React.FC<{ expanded: boolean }> = ({ expanded }) => (
  <svg
    className={`engagedial-chevron${expanded ? " engagedial-chevron--up" : ""}`}
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M4 6l4 4 4-4"
      stroke="#616161"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/* Fluent UI PhoneRegular path — neutral, lightweight, 16×16 */
const PhoneLineIcon: React.FC = () => (
  <svg
    className="engagedial-toggle-bar__phone-icon"
    width="14"
    height="14"
    viewBox="0 0 20 20"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M5.11 2.17a1.25 1.25 0 0 0-1.7.03L2.1 3.52A2.75 2.75 0 0 0 1.42 6.6c1.06 3.18 2.9 6.06 5.4 8.56 2.5 2.5 5.38 4.34 8.56 5.4a2.75 2.75 0 0 0 3.08-.68l1.32-1.31a1.25 1.25 0 0 0 .03-1.7l-2.4-2.59a1.25 1.25 0 0 0-1.6-.22l-1.74 1.1a1 1 0 0 1-1.1-.04 17.5 17.5 0 0 1-4.1-4.1 1 1 0 0 1-.03-1.1l1.1-1.73a1.25 1.25 0 0 0-.23-1.61L5.11 2.17Z"
      stroke="#616161"
      strokeWidth="1.25"
      strokeLinejoin="round"
    />
  </svg>
);

const CardHeader: React.FC<{ showSubtitle: boolean }> = ({ showSubtitle }) => (
  <div className="engagedial-header">
    <h3 className="engagedial-title">Customer phone numbers</h3>
    {showSubtitle && (
      <p className="engagedial-subtitle">Select a number to prepare proactive engagement.</p>
    )}
  </div>
);

const CustomerRow: React.FC<{ customer: CustomerInfo }> = ({ customer }) => (
  <div className="engagedial-customer-row">
    <span className="engagedial-customer-name" title={customer.name}>
      {customer.name}
    </span>
    <span
      className={`engagedial-badge engagedial-badge-${customer.entityType}`}
      aria-label={`Customer type: ${customer.entityType}`}
    >
      {customer.entityType === "contact" ? "Contact" : "Account"}
    </span>
  </div>
);

// ---------------------------------------------------------------------------
// Inline SVG icons (no external dependency required)
// ---------------------------------------------------------------------------

const InfoIcon: React.FC = () => (
  <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true">
    <circle cx="18" cy="18" r="15" stroke="#c8c8c8" strokeWidth="2" />
    <path d="M18 16v9" stroke="#c8c8c8" strokeWidth="2" strokeLinecap="round" />
    <circle cx="18" cy="12" r="1.75" fill="#c8c8c8" />
  </svg>
);

const PhoneOffIcon: React.FC = () => (
  <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true">
    <path
      d="M7 7l22 22M14 9.5a17 17 0 0 1 4-.5 17 17 0 0 1 12 4.8M21.5 17l5 5a2.3 2.3 0 0 1 .2 3l-2.1 2.5a2.3 2.3 0 0 1-3 .2C19.4 26 16.2 25 13.5 25c-1 0-1.8.1-2.7.2"
      stroke="#c8c8c8"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const WarningIcon: React.FC = () => (
  <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true">
    <path
      d="M18 5L3 31h30L18 5z"
      stroke="#c42b1c"
      strokeWidth="2"
      fill="none"
      strokeLinejoin="round"
    />
    <path d="M18 16v7" stroke="#c42b1c" strokeWidth="2" strokeLinecap="round" />
    <circle cx="18" cy="26.5" r="1.5" fill="#c42b1c" />
  </svg>
);

const SuccessIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx="8" cy="8" r="7" stroke="#107c10" strokeWidth="1.5" />
    <path
      d="M4.5 8l2.5 2.5 4.5-4.5"
      stroke="#107c10"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ErrorIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx="8" cy="8" r="7" stroke="#c42b1c" strokeWidth="1.5" />
    <path d="M8 4.5v5" stroke="#c42b1c" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="8" cy="11.5" r="1" fill="#c42b1c" />
  </svg>
);

const CheckIcon: React.FC = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
    <path
      d="M2 6.5l3.5 3.5 5.5-6"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
