# Proactive Engagement Phone Selector

> **Version:** v1.0.3  
> **Internal Name:** EngageDial Selector  
> **Target Table:** Case (`incident`)  
> **Control Type:** PCF Field Control (Virtual / React)  
> **Author:** Alex Yurpolsky  
> **Publisher Prefix:** `alex`  

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [PCF Purpose](#2-pcf-purpose)
3. [Target Table and Fields](#3-target-table-and-fields)
4. [Supported Customer Types](#4-supported-customer-types)
5. [Phone Fields — Contact](#5-phone-fields--contact)
6. [Phone Fields — Account](#6-phone-fields--account)
7. [How the PCF Reads customerid](#7-how-the-pcf-reads-customerid)
8. [UI Structure](#8-ui-structure)
9. [How alex_proactive_engagement Is Prepared](#9-how-alex_proactive_engagement-is-prepared)
10. [Build Instructions](#10-build-instructions)
11. [Test Instructions](#11-test-instructions)
12. [Known Limitations](#12-known-limitations)
13. [Future Enhancement Options](#13-future-enhancement-options)
14. [Deployment Steps](#14-deployment-steps)
15. [Version History](#15-version-history)

---

## 1. Project Overview

**EngageDial Selector** is a Power Component Framework (PCF) control designed for the Dynamics 365 Case form.  
It allows customer service agents to quickly identify and select a phone number for the Case customer, preparing the selected number for a downstream proactive outbound engagement process.

The control is a pure **UI layer** — it reads data, renders a polished selector, and prepares a structured JSON payload. It does not trigger the outbound call process directly. That responsibility belongs to a downstream component (Flow, Custom API, Plugin, or other orchestration layer).

### Repository Structure

```
EngageDial Selector/
├── EngageDialSelector/                   # PCF control source
│   ├── ControlManifest.Input.xml         # PCF manifest (properties, resources, features)
│   ├── index.ts                          # PCF lifecycle entry point
│   ├── components/
│   │   ├── EngageDialSelectorApp.tsx     # Main React component
│   │   └── PhoneCard.tsx                 # Selectable phone number card
│   ├── services/
│   │   └── DataverseService.ts           # Dataverse Web API calls
│   ├── types/
│   │   └── index.ts                      # Shared TypeScript interfaces
│   ├── utils/
│   │   └── guid.ts                       # UUID v4 generator
│   └── css/
│       └── EngageDialSelector.css        # Control stylesheet
├── EngageDialSolution/                   # Dataverse solution project
│   ├── EngageDialSolution.cdsproj        # .NET solution project file
│   └── src/Other/
│       ├── Solution.xml                  # Solution metadata (publisher, version)
│       ├── Customizations.xml            # Solution component declarations
│       └── Relationships.xml
├── PCF Control Specification.md          # Original business requirement
├── README.md                             # This file
├── package.json
├── tsconfig.json
└── eslint.config.mjs
```

---

## 2. PCF Purpose

The control solves a specific workflow gap on the Case form:

> *The agent needs to know which phone numbers are available for the customer on this Case, pick one, and prepare that selection for a proactive engagement request — all without leaving the Case form.*

**What the PCF does:**
- Reads the Case's `customerid` field (Contact or Account).
- Retrieves available phone numbers from the customer record.
- Presents them in a clean, selectable UI.
- When the agent confirms a selection, writes a structured JSON payload to the `alex_proactive_engagement` field.

**What the PCF does NOT do (v1.0.3):**
- It does not directly initiate an outbound call.
- It does not call a Custom API or Power Automate Flow.
- It does not create child records.

---

## 3. Target Table and Fields

| Item | Value |
|------|-------|
| **Table** | Case |
| **Logical Name** | `incident` |
| **Host Field** | `alex_proactive_engagement` |
| **Host Field Type** | Multiple Lines of Text (4000 chars) |
| **Customer Source Field** | `customerid` (OOTB polymorphic Customer lookup) |
| **Recommended Form Section** | *Outbound Engagement* or *Customer Callback* |

The control is placed on the `alex_proactive_engagement` field. This is the field that receives the JSON payload on selection confirmation.

> **Note for adapters:** The `alex_proactive_engagement` field uses the `alex` publisher prefix. If you are deploying to your own environment with a different publisher prefix, rename this field accordingly and update the form binding.

---

## 4. Supported Customer Types

| Customer Type | Entity | Supported |
|---------------|--------|-----------|
| Contact | `contact` | ✅ Yes |
| Account | `account` | ✅ Yes |
| Account's Primary Contact | `contact` (via Account) | ❌ No (by design, v1.0.3) |
| Account's related Contacts | `contact` (via Account) | ❌ No (by design, v1.0.3) |

> **Design Decision:** Account phone numbers are retrieved from the Account record only. This aligns with the business requirement that the engagement is with the Account, not with an individual under the Account. If related Contact retrieval is needed in the future, see [Future Enhancement Options](#13-future-enhancement-options).

---

## 5. Phone Fields — Contact

When the Case customer is a Contact, the control retrieves phone numbers from the `contact` table. The fields retrieved — and their display order — are configurable via PCF input properties on the form:

| Property | Default Field | Dataverse Field | Label |
|----------|--------------|-----------------|-------|
| Contact Number 1 | Mobile Phone | `mobilephone` | Mobile Phone |
| Contact Number 2 | Telephone 1 | `telephone1` | Telephone 1 |
| Contact Number 3 | Telephone 2 | `telephone2` | Telephone 2 |
| Contact Number 4 | Telephone 3 | `telephone3` | Telephone 3 |

- Empty fields are silently skipped.
- If the same phone number appears in more than one field, only the first occurrence is shown.
- Set a property to **None** to disable that position.

---

## 6. Phone Fields — Account

When the Case customer is an Account, the control retrieves phone numbers from the `account` table. The fields retrieved are configurable via PCF input properties on the form:

| Property | Default Field | Dataverse Field | Label |
|----------|--------------|-----------------|-------|
| Account Number 1 | Main Phone | `telephone1` | Main Phone |
| Account Number 2 | Other Phone | `telephone2` | Other Phone |
| Account Number 3 | Telephone 3 | `telephone3` | Telephone 3 |
| Account Number 4 | Address Phone | `address1_telephone1` | Address Phone |

- Empty fields are silently skipped.
- Duplicates are removed.
- No phone numbers are retrieved from the Account's Primary Contact or related Contacts.

---

## 7. How the PCF Reads `customerid`

The control uses a two-stage resolution strategy:

### Stage 1 — Bound PCF Property (Recommended)
The manifest declares `customerId` as a `Lookup.Customer` bound property. When configured in the form designer (bound to the `customerid` field), the control reads the customer directly from `context.parameters.customerId.raw`. This provides:
- Immediate access on load.
- Automatic re-fetch when the agent changes the customer mid-session (via `customerReloadVersion` tracking in `index.ts`).

### Stage 2 — Web API Fallback
If `customerId` is not bound in the form designer, the control falls back to fetching the Case record via the Dataverse Web API using the Case ID from `context.mode.contextInfo.entityId`.  
The response includes OData annotations that identify the customer type:
- `_customerid_value` → customer GUID
- `_customerid_value@Microsoft.Dynamics.CRM.lookuplogicalname` → `"contact"` or `"account"`
- `_customerid_value@OData.Community.Display.V1.FormattedValue` → display name

> **Recommendation:** Always bind `customerId` to `customerid` in the form designer for the best experience. The fallback is provided for resilience.

---

## 8. UI Structure

The control renders inside a single card container. The visual state depends on runtime data:

### State: Loading
```
┌────────────────────────────────────┐
│ Customer phone numbers             │
│  ⠿ Loading customer phone numbers...│
└────────────────────────────────────┘
```

### State: No Customer
```
┌────────────────────────────────────┐
│ Customer phone numbers             │
│        ⓘ                           │
│  No customer selected              │
│  No customer selected on this      │
│  Case. Please select a customer... │
└────────────────────────────────────┘
```

### State: No Phone Numbers
```
┌────────────────────────────────────┐
│ Customer phone numbers             │
│  John Smith                [Contact]│
│        ☏ (crossed)                 │
│  No phone numbers found            │
│  Please update the customer record │
└────────────────────────────────────┘
```

### State: Ready (phone numbers available)
```
┌────────────────────────────────────┐
│ Customer phone numbers             │
│  Select a number for proactive...  │
│  Contoso Ltd.             [Account]│
│  ─── Available numbers ────────── │
│  ○  Main Phone                     │
│     +972 3 123 4567                │
│  ●  Other Phone              ← selected
│     +972 50 987 6543               │
│                                    │
│  [ ✓  Prepare engagement ]         │
│                                    │
│  ✅ Engagement request prepared    │
│     successfully.                  │
└────────────────────────────────────┘
```

### State: Error
```
┌────────────────────────────────────┐
│ Customer phone numbers             │
│        ⚠                           │
│  Something went wrong              │
│  We could not load the customer... │
└────────────────────────────────────┘
```

---

## 9. How `alex_proactive_engagement` Is Prepared

When the agent clicks **Prepare engagement**, the control generates a JSON payload and writes it to the `alex_proactive_engagement` field via PCF's `notifyOutputChanged()` / `getOutputs()` mechanism.

### Payload Structure (v1.0.3)

```json
{
  "RequestId": "4773f24f-e423-407a-95aa-17499cc8977c",
  "DestinationPhoneNumber": "+972501234567",
  "ContactId": "4edb1b98-4c50-f111-bec7-000d3a66fdf4",
  "CustomerId": "4edb1b98-4c50-f111-bec7-000d3a66fdf4",
  "CustomerType": "contact",
  "CaseId": "04a08492-1559-f111-bec6-7ced8d414f8a",
  "InitiatedBy": "d8d38f1e-10c4-f011-bbd2-000d3ab89080",
  "InitiatedOn": "2026-05-27T14:41:32.241Z",
  "Source": "Proactive Engagement Phone Selector",
  "SelectedPhoneField": "mobilephone",
  "SelectedPhoneLabel": "Mobile Phone"
}
```

For an **Account** customer:

```json
{
  "RequestId": "9b8c7d6e-f012-4345-abcd-567890123456",
  "DestinationPhoneNumber": "+97235551234",
  "ContactId": null,
  "CustomerId": "a1b2c3d4-e5f6-7890-abcd-ef0123456789",
  "CustomerType": "account",
  "CaseId": "04a08492-1559-f111-bec6-7ced8d414f8a",
  "InitiatedBy": "d8d38f1e-10c4-f011-bbd2-000d3ab89080",
  "InitiatedOn": "2026-05-27T14:41:32.241Z",
  "Source": "Proactive Engagement Phone Selector",
  "SelectedPhoneField": "telephone1",
  "SelectedPhoneLabel": "Main Phone"
}
```

### Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| `RequestId` | UUID v4 | Unique per selection. Allows the same number to be selected multiple times, each as a new distinct request. |
| `DestinationPhoneNumber` | string | The phone number selected by the agent. Maps directly to the `DestinationPhoneNumber` parameter of the downstream action. |
| `ContactId` | GUID or `null` | Contact record ID when the Case customer is a Contact. `null` for Account customers — the Account ID must not flow into this field. |
| `CustomerId` | GUID | The Dataverse record ID of the customer (Contact or Account). |
| `CustomerType` | `"contact"` or `"account"` | Identifies the customer entity type for downstream processing. |
| `CaseId` | GUID | The Dataverse record ID of the Case. |
| `InitiatedBy` | GUID | Clean lowercase GUID of the agent who made the selection (no surrounding braces). |
| `InitiatedOn` | ISO 8601 UTC | Timestamp of the selection. |
| `Source` | string | Always `"Proactive Engagement Phone Selector"`. Identifies the originating component. |
| `SelectedPhoneField` | string *(optional)* | Logical name of the Dataverse field that held the selected number (e.g. `"mobilephone"`). Useful for audit and troubleshooting. |
| `SelectedPhoneLabel` | string *(optional)* | Display label shown to the agent (e.g. `"Mobile Phone"`). |

### Expected Flow Mapping

| Payload field | Flow / Action parameter |
|---|---|
| `DestinationPhoneNumber` | `DestinationPhoneNumber` |
| `ContactId` | `ContactId` |
| `RequestId` | `RequestId` |
| `CaseId` | `InputAttributes.CaseGuid` |
| `InitiatedBy` | `InputAttributes.agentassigned` |

> **Important:** The field value is set on the form but is **not automatically saved to Dataverse**. The value is persisted when the agent saves the Case form (or when the form's auto-save triggers). Downstream processes (Flow, Plugin, Custom API) should be triggered by the field update event on `alex_proactive_engagement`.

---

## 10. Build Instructions

### Prerequisites

| Tool | Version |
|------|---------|
| Node.js | v16 or later |
| npm | v8 or later |
| .NET SDK | 6.0 or later (for solution packaging) |
| Microsoft Power Platform CLI (`pac`) | v1.30 or later |

Install the Power Platform CLI:
```bash
npm install -g pac-cli
# or via dotnet
dotnet tool install --global Microsoft.PowerApps.CLI.Tool
```

### Clone and Build

```bash
# 1. Clone the repository
git clone https://github.com/alexander-you/engagedial-selector.git
cd "engagedial-selector"

# 2. Install npm dependencies
npm install

# 3. Build the PCF control
npm run build

# 4. (Optional) Start the local test harness
npm start
```

The PCF build output is placed in `out/controls/EngageDialSelector/`.

### Customising for Your Environment

Before deploying to your own environment, you may want to:

1. **Change the publisher prefix** — open `EngageDialSolution/src/Other/Solution.xml` and update `<CustomizationPrefix>` and `<UniqueName>` for your publisher.
2. **Rename the payload field** — if you are not using the `alex_proactive_engagement` field, update the form binding after import and update the bound property in the form designer.
3. **Adjust default phone fields** — the defaults in `index.ts` (`DEFAULT_CONTACT_LABELS`, `DEFAULT_ACCOUNT_LABELS`) reflect the standard configuration. You can change them or override per control instance via the PCF input properties in the form designer.

---

## 11. Test Instructions

### Local Test Harness

```bash
npm start
```

Opens a browser with the PCF test harness at `http://localhost:8181`.  
In the harness, set `engagementField` to any string to simulate the bound field.  
The `customerId` lookup cannot be fully simulated in the harness — use a live environment for customer resolution testing.

### Live Environment Testing

1. Deploy the solution (see [Deployment Steps](#14-deployment-steps)).
2. Open a Case record that has a **Contact** customer.
   - Verify phone numbers appear correctly.
   - Select a number and click **Prepare engagement**.
   - Verify the `alex_proactive_engagement` field is updated with valid JSON.
3. Open a Case record that has an **Account** customer.
   - Verify only Account-level phone numbers appear (not from related Contacts).
   - Verify `ContactId` is `null` in the payload.
4. Open a Case with **no customer** (`customerid` is empty).
   - Verify the "No customer selected" empty state is shown.
5. Open a Case with a customer that has **no phone numbers**.
   - Verify the "No phone numbers found" empty state is shown.

---

## 12. Known Limitations

| # | Limitation | Impact | Notes |
|---|-----------|--------|-------|
| 1 | Account mode does not retrieve phone numbers from related Contacts | Medium | By design for v1.0.3. See enhancement option #3. |
| 2 | Phone numbers are not normalised or validated | Low | Displayed exactly as stored in Dataverse. |
| 3 | `alex_proactive_engagement` is not saved until the form is saved | Low | Standard PCF field update behaviour. |
| 4 | `InitiatedBy` may be an empty string if `context.userSettings.userId` is unavailable | Low | Only affects the payload metadata field; does not block functionality. |
| 5 | Customer change detection requires `customerId` to be bound in the form designer | Low | Fallback via Web API handles the unbound case on initial load. |
| 6 | No retry mechanism for failed Web API calls | Low | Agent can refresh the form to retry. |

---

## 13. Future Enhancement Options

The control has been deliberately designed as a thin, focused UI layer. The following enhancements are planned for future versions:

| Option | Description |
|--------|-------------|
| **Custom API trigger** | Replace the direct field update with a Custom API call to initiate the outbound process immediately on selection confirmation. |
| **Outbound Call Request record** | Create an `OutboundCallRequest` child record instead of (or in addition to) updating the field. |
| **Engagement status display** | Show the current status of the engagement request (e.g., *Queued*, *Dialling*, *Completed*) by polling a related record. |
| **Last selected number** | Remember and visually indicate the last number that was used for an engagement on this Case. |
| **Account related Contacts** | Optionally retrieve phone numbers from the Account's related Contacts, with a grouped display. |
| **Phone number formatting** | Normalise and format phone numbers to E.164 or a regional format before display. |
| **Click-to-call** | Add a direct click-to-call action alongside the engagement preparation. |
| **Retry support** | Add a retry button when the Web API call fails, without requiring a full form refresh. |

---

## 14. Deployment Steps

### Prerequisites

- Power Platform CLI authenticated to your target Dataverse environment.
- .NET SDK 6.0 or later.
- The `alex_proactive_engagement` field must exist on the `incident` table as a **Multiple Lines of Text** field (max 4000 characters). If you need to create it, use the Power Apps maker portal or PAC CLI.

### 1. Authenticate

```bash
pac auth create --url https://YOUR-ENV.crm.dynamics.com
pac auth select --environment YOUR-ENV-ID
```

### 2. Build the PCF Control

```bash
# From the repository root
npm install
npm run build
```

### 3. Build the Solution Package

```bash
cd EngageDialSolution
dotnet build --configuration Release
# Output: EngageDialSolution/bin/Release/EngageDialSolution.zip
```

### 4. Import the Solution

```bash
pac solution import \
  --path "EngageDialSolution/bin/Release/EngageDialSolution.zip" \
  --force-overwrite \
  --publish-changes
```

### 5. Add the Control to the Case Form

1. Navigate to **Power Apps** → your environment → **Tables** → **Case** → **Forms**.
2. Open the Case form you want to add the control to.
3. Select the `alex_proactive_engagement` field (or insert it if not already on the form).
4. In the field properties panel, choose **Controls** → **Add control** → **Proactive Engagement Phone Selector**.
5. Set the `Proactive Engagement Payload` property → **Field** → `alex_proactive_engagement`.
6. Set the `Case Customer` property → **Field** → `Customer` (`customerid`).
7. (Optional) Configure the **Contact Number 1–4** and **Account Number 1–4** properties to select which phone fields to display.
8. Set visibility to **Web**, **Phone**, **Tablet**.
9. Save and publish the form.

### Upgrading

To upgrade an existing deployment to a new version:

```bash
npm run build
cd EngageDialSolution && dotnet build --configuration Release
pac solution import \
  --path "EngageDialSolution/bin/Release/EngageDialSolution.zip" \
  --force-overwrite \
  --publish-changes
```

---

## 15. Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| v1.0.3 | 2026-05-27 | Alex Yurpolsky | Fixed PCF Enum property resolution: `EnumProperty.raw` returns text content (display label), not the `name` attribute — label-to-field maps corrected accordingly. Fixed empty-string fallback (`??` → ternary) for unconfigured Enum properties. Updated JSON payload to align with downstream Flow/action parameters: `DestinationPhoneNumber` replaces `selectedPhoneNumber`; all fields now PascalCase; `ContactId` added (Contact ID when customer is Contact, `null` for Account); `InitiatedBy` normalised to clean lowercase GUID. Optional diagnostic fields `SelectedPhoneField` and `SelectedPhoneLabel` added. |
| v1.0.2 | 2026-05-27 | Alex Yurpolsky | Added 8 configurable PCF input properties (Contact Number 1–4, Account Number 1–4). System customizers can now select which phone fields appear per control instance using predefined dropdowns. New Account field: `address1_telephone1` (Address Phone). Defaults preserve existing behavior. |
| v1.0.1 | 2026-05-27 | Alex Yurpolsky | UI refinements: compact row-based phone list, number-first layout with label right-aligned, tighter spacing. Renamed control display name to "Proactive Engagement Phone Selector". Fixed publisher prefix from `alexed` to `alex` (solution recreated). Updated property display names: "Proactive Engagement Payload", "Case Customer". Corrected all user-facing text. Solution version bumped to 1.1. |
| v1.0.0 | 2026-05-27 | Alex Yurpolsky | Initial release. Contact and Account phone resolution, JSON payload preparation, polished Fluent UI-inspired design, full empty/error state handling. |

---

*Part of the Demo Contact Center — Proactive Engagement initiative.*  
*For questions or contributions, open a GitHub issue or contact the repository author.*
