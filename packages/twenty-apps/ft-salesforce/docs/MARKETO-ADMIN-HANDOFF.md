# Marketo → Twenty CRM intake — admin setup (forward this to the Marketo admin)

Adds a **second, parallel destination** for Get Started form submissions: alongside the
existing Marketo→Salesforce sync (which stays exactly as-is), each submission also creates
a lead in the new Twenty CRM. Nothing here changes any Salesforce-facing campaign. This is
dual-write during the pilot; at SF sunset we simply deactivate the SF campaign.

**Endpoint (live, ready):** `POST https://fundthrough.twenty.com/s/marketo/intake`
**Auth:** a dedicated Twenty API key (Linesh provides — goes in the webhook's custom header).

---

## Step 1 — Webhook  (Admin → Webhooks → New Webhook)

| Field | Value |
|---|---|
| Name | `Twenty CRM — Get Started intake` |
| URL | `https://fundthrough.twenty.com/s/marketo/intake` |
| Request Type | `POST` |
| Request Token Encoding | `JSON` |
| Response Type | `JSON` |

**Payload template** — paste this, then re-insert each `{{…}}` using the token picker so
Marketo resolves your org's real field names. **The left-hand keys must stay exactly as
written** — they are the contract the endpoint reads. Where a value shows `<field that syncs
to SF X__c>`, pick the Marketo field that already feeds that Salesforce Lead field (the Get
Started form populates these today, so the mapping already exists in Field Management):

```json
{
  "email": "{{lead.Email Address}}",
  "firstName": "{{lead.First Name}}",
  "lastName": "{{lead.Last Name}}",
  "jobTitle": "{{lead.Job Title}}",
  "company": "{{company.Company Name}}",
  "phone": "{{lead.Phone Number}}",
  "invoicePlatforms": "{{lead.<syncs to Do_you_use_any_of_these_invoice_platform__c>}}",
  "invoicePlatformsOther": "{{lead.<syncs to Invoice_Platforms_Other__c>}}",
  "doYouInvoiceBusinesses": "{{lead.<syncs to Do_you_invoice_businesses__c>}}",
  "businessRegisteredIn": "{{lead.<syncs to Where_is_your_business_registered__c>}}",
  "industry": "{{lead.<syncs to What_Industry_is_your_business_in__c>}}",
  "annualRevenueBand": "{{lead.<syncs to Annual_Revenue_Range__c>}}",
  "desiredFundingBand": "{{lead.<syncs to How_much_funding_are_you_looking_for__c>}}",
  "howDidYouHearAboutUs": "{{lead.<syncs to How_Did_You_Hear_About_Us__c>}}",
  "howDidYouHearAboutUsOther": "{{lead.<syncs to How_Did_You_Hear_About_Us_Other__c>}}",
  "primaryReasonForFunding": "{{lead.<syncs to Primary_Reason_for_Funding__c>}}",
  "primaryReasonForFundingOther": "{{lead.<syncs to Primary_Reason_for_Funding_Other__c>}}",
  "howQuicklyDoYouNeedTheMoney": "{{lead.<syncs to How_quickly_do_you_need_the_money__c>}}"
}
```

Notes:
- Multi-select fields (invoice platforms, primary reason) — send Marketo's default
  semicolon-separated string; the endpoint splits it.
- Send the human-readable labels exactly as shown on the form (e.g. `Under $100k`,
  `Transportation and warehousing`, `Enverus Openinvoice`) — the endpoint maps them.
- Blank/unanswered fields are fine.

**Custom header** (Webhooks → the webhook → Webhook Actions → Set Custom Header):
`Authorization` = `Bearer <the API key Linesh provides>`

---

## Step 2 — Smart Campaign

1. New Smart Campaign, e.g. `Get Started → Twenty CRM`.
2. **Smart List:** trigger *Fills Out Form* — same form(s) as the existing SF campaign
   (copy that campaign's form list, including any landing-page variants).
3. **Flow:** one step — *Call Webhook* → `Twenty CRM — Get Started intake`.
4. **Schedule:** qualify *every time* (re-submissions safely update the same lead).
5. Activate.

---

## Step 3 — Test before going live

1. Point a clone of the campaign at a TEST form first.
2. Submit a lead with a `+test` email (e.g. `you+twentytest@fundthrough.com`).
3. Confirm in the lead's Activity Log: *Webhook is Called*, response `{"ok":true,...}`.
4. Linesh confirms the person + company appeared correctly in Twenty.
5. Switch the trigger to the production Get Started form.

---

## How it behaves (so there are no surprises)

- **One lead per email, forever.** Re-submissions update the existing person — never a
  duplicate, never a downgrade of their pipeline stage.
- **Company** is matched by name or created — never guessed from the email domain.
- **Errors** come back as HTTP 200 with `{"ok":false,"error":...}` — check the body, not
  just the status.
- Marketo has no durable retry: if the endpoint is ever down, re-run the smart campaign for
  the affected window — it's safe to replay.

## One ongoing courtesy
Tell Linesh before adding/renaming a form field or changing a picklist's options — the
endpoint maps known option labels, and new labels need to be added on our side.
