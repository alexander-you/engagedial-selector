PCF Control Specification: Customer EngageDial Selector
1. Purpose

The Customer EngageDial Selector is a lightweight and elegant PCF control placed on the Case form. Its purpose is to help agents quickly identify and select an available phone number for the Case customer, in preparation for a proactive outbound or preview call process.

The control acts primarily as a UI layer. It reads the Case customer from the standard OOTB customerid field, retrieves the relevant phone numbers from the related customer record, and presents them in a clean, agent-friendly interface.

In the initial phase, the control should be prepared to update the Case field alex_proactive_engagement with the selected phone number or a structured payload that can later be used by a downstream process.

This aligns with the approach discussed in the call: the agent selects a customer number from the Case, and the selected value can later be used to trigger or support the proactive engagement process.

2. Target Entity

The control is designed to run on:

Entity: Case
Logical name: incident

The control should be added to the Case main form, preferably in a dedicated section such as:

Outbound Engagement
or
Customer Callback

3. Customer Source

The control must use the OOTB Case customer field:

Field: customerid

This is a polymorphic customer lookup that may point to either:

Contact: contact
Account: account

For this implementation:

When customerid points to a Contact, the control retrieves phone numbers from the Contact record.

When customerid points to an Account, the control retrieves phone numbers from the Account record only.

The control must not retrieve numbers from the Account’s Primary Contact or related Contacts.

4. Phone Number Sources
4.1 Contact phone fields

When the Case customer is a Contact, the control should retrieve and display the following fields when populated:

mobilephone
telephone1
telephone2
telephone3

Optional nice labels:

Mobile Phone
Business Phone
Home Phone / Other Phone
Additional Phone

4.2 Account phone fields

When the Case customer is an Account, the control should retrieve and display only Account-level phone fields:

telephone1
telephone2
telephone3

Optional nice labels:

Main Phone
Other Phone
Additional Phone

5. Bound / Host Field

The PCF should be hosted on a custom field on the Case form.

Recommended host field:

alex_proactive_engagement

Recommended data type:

Single Line of Text, if storing only the selected phone number.

Or preferably:

Multiple Lines of Text, if storing a JSON payload.

My recommendation: use alex_proactive_engagement as a payload/trigger field, not just a simple phone number field.

Example payload:

{
  "requestId": "GUID",
  "selectedPhoneNumber": "+972501234567",
  "customerId": "GUID",
  "customerType": "contact",
  "initiatedBy": "current-user-id",
  "initiatedOn": "2026-05-27T12:00:00Z",
  "source": "Customer EngageDial Selector"
}

That gives you flexibility later for Flow, plugin, Custom API, or proactive engagement logic.

6. UI Behavior

The control should be visually elegant, compact, and suitable for an agent workspace.

Initial state

When the Case form loads, the control should show a clean loading state:

Loading customer phone numbers...

Customer found with phone numbers

Display a card-style UI with:

Customer name
Customer type: Contact or Account
Available phone numbers
Primary action button: Use this number or Start engagement

Suggested layout:

Title: Customer phone numbers
Subtitle: Select the number to use for proactive engagement

Each phone number should appear as a selectable row/card:

Label: Mobile Phone
Number: +972 50 123 4567
Action: Select

After a number is selected, visually highlight it and show a confirmation action.

No customer on Case

Show:

No customer selected on this Case.
Please select a customer before starting a proactive engagement.

Customer exists but no phone numbers

Show:

No phone numbers were found for this customer.
Please update the customer record or choose another contact method.

Save / update confirmation

When the control updates alex_proactive_engagement, show:

Engagement request prepared successfully.

Not “call started”, because the PCF itself is only preparing the UI/payload, not guaranteeing that the outbound process has already started.

7. Technical Behavior
On load

The PCF should:

Read current Case record ID.

Read customerid.

Determine whether the customer is a Contact or Account.

Retrieve phone fields from the relevant table using Dataverse Web API.

Normalize and filter phone numbers.

Remove empty values.

Optionally remove duplicate phone numbers.

Render the list in the UI.

On number selection

The PCF should:

Capture the selected number.

Create a request payload.

Update the Case field:

alex_proactive_engagement

The value can be either:

Selected phone number only:

+972501234567

Or recommended JSON payload:

{
  "requestId": "generated-guid",
  "selectedPhoneNumber": "+972501234567",
  "customerId": "customer-guid",
  "customerType": "account",
  "caseId": "case-guid",
  "initiatedOn": "UTC timestamp"
}

The requestId is important because it allows the same number to be selected multiple times while still creating a new trigger value.

8. Design Requirements

The control should look modern and polished, not like a basic lookup or plain text field.

Recommended visual style:

Rounded card container
Subtle border
Light background
Clear typography
Phone number cards with hover state
Selected number highlight
Small customer type badge: Contact / Account
Minimal loading spinner
Clear success and error messages
No excessive text
Professional Dynamics-style appearance

The control should feel like a native enhancement to the Case form.

9. Error Handling

The control should handle:

Missing Case ID
Missing customerid
Unsupported customer type
Web API permission issues
No phone numbers found
Failure to update alex_proactive_engagement

Error messages should be user-friendly, for example:

We could not load the customer phone numbers. Please refresh the form or contact your administrator.

For technical diagnostics, errors should be logged to the browser console with enough context for debugging.

10. Security

The control should run under the current user context.

The user must have read permissions for:

Case
Contact
Account

If the control updates alex_proactive_engagement, the user must also have write permission on the Case field.

No secrets, API keys, or external service credentials should be stored in the PCF.

11. Future Extension Points

The control should be designed so that later versions can support:

Calling a Custom API instead of directly updating the Case field
Creating an Outbound Call Request child record
Showing engagement status
Showing last selected number
Supporting retry
Supporting formatted phone validation
Supporting click-to-call behavior
Supporting configurable phone fields
Supporting Account related Contacts, if the business requirement changes later

12. Suggested Version Name

Customer EngageDial Selector v1.0.0

Alternative names:

EngageDial Selector
Proactive Call Picker
Customer Phone Engagement Selector
Case EngageDial Control

My preferred name: EngageDial Selector. It sounds product-like, short, and clear.