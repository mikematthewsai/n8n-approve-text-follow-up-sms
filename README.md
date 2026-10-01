# Approve, text, follow up, stop on reply

A standalone n8n workflow for reaching a group of your customers about something that just happened, without ever blasting anyone by accident.

Something posts it a request: a title, a message and a list of customers. It texts **you** a link. The link opens a page with the message exactly as a customer will see it and the list of who gets it. Nothing is sent until you press **Approve**. Then it texts each customer during daytime hours, follows up if they don't answer, and stops for anyone who replies or texts STOP. Replies are texted to you, because a reply is a person who wants to talk.

It needs n8n and a Twilio account. No database, no spreadsheet, no community nodes, no AI model. Email is optional, through Gmail.

It was built as the second half of [n8n-weather-watch-past-customers](https://github.com/mikematthewsai/n8n-weather-watch-past-customers) (hail, wind and warnings matched to past customers), but anything can send it requests: a product recall, a price change, a supplier outage, a road closure, a slow week.

## The business problem

When something happens that touches a group of your customers, the choices are usually bad: text nobody because it takes too long, or paste a list into a mass-texting tool and hope nobody who opted out is on it. The texts that do go out never get a follow-up, and the replies land in a shared inbox nobody watches. This does the careful version every time: a person approves, consent and opt-outs are checked, follow-ups stop the moment someone answers, and every reply comes to the owner's phone.

## What it does

1. **Takes a request.** `POST` to the **New outreach request** webhook, with your `request_key`:

   ```json
   {
     "key": "your request_key",
     "title": "Hail near 14 past customers (Tue Sep 30)",
     "summary": "Anything you want to see on the approval page",
     "message": "Hi {first_name}, this is {business_name}. Hail was reported near your home today. Want a free roof check? Reply YES.",
     "customers": [
       { "name": "Jane Smith", "phone": "404-555-0101", "email": "jane@example.com", "ok_to_text": true, "detail": "0.8 mi" }
     ]
   }
   ```

   It answers `{"ok": true, "id": "...", "eligible": 12, "skipped": {...}}`.
2. **Checks who can be texted.** A valid phone, `ok_to_text` true (unless you turn `require_consent` off), not opted out, not already being followed up, and not texted in the last `cooldown_days`. Everyone left out is counted by reason.
3. **Texts you the link.** Held until morning if it arrives in your quiet hours.
4. **The approval page.** The title, your summary, the first text as the first customer will see it (with the opt-out line), the follow-up plan, the list, and two buttons: **Approve and send** and **Cancel**. Opening the link never sends anything. Link previews in messaging apps open links on their own, so only a button press (a POST) can approve. Unapproved requests expire after `approval_hours`.
5. **Sends what is due every 10 minutes,** only between `customer_hours_start` and `customer_hours_end`, at most `max_per_run` per check. Then follow-ups after `followup_days` (default 2 days, then 5 more) if there is no reply.
6. **Replies.** Any reply ends that person's follow-ups and is texted to you with their name and number. STOP (and STOPALL, UNSUBSCRIBE, CANCEL, END, QUIT) ends them and keeps the number off future requests. START puts it back. Twilio error 21610 (the number opted out with the carrier) counts as STOP.
7. **Wrap-up.** When everyone in a request is finished you get one text: how many replied, got no answer after every follow-up, opted out, or could not be texted. The approval page keeps showing each person's status, with a **Stop all follow-ups** button while any are still active.

[examples/texts-and-page.md](examples/texts-and-page.md) shows the real texts and pages from the live test.

## Requirements

- n8n Cloud or self-hosted n8n that your phone and Twilio can reach. Tested on n8n Cloud 2.39.7.
- Core nodes only: Webhook, Schedule Trigger, Set, Code, Switch, If, HTTP Request, Respond to Webhook, and Gmail if you turn email on.
- A Twilio account, a number on it, and a Twilio credential in n8n. In the US the number needs A2P 10DLC registration or toll-free verification, and your campaign has to cover the kind of messages you send.
- Customers who agreed to hear from you by text.

## Install

1. Import [`workflow/approve-text-follow-up-sms.json`](workflow/approve-text-follow-up-sms.json).
2. Select your Twilio credential on **Find your Twilio account** and **Send the texts**.
3. Fill in **Your settings**, including your n8n address and a long random `request_key`.
4. Publish it.
5. In Twilio, point your number's incoming messages webhook (HTTP POST) at the production URL of the **Customer replied** node, `https://your-n8n/webhook/outreach-reply`.

A number sends its incoming texts to one place only. If yours already goes to another system, have that system forward replies to the **Customer replied** URL, with Twilio's `From` and `Body` fields.

It will not run until the phone numbers, the n8n address and a `request_key` are filled in. The run stops in red in n8n and says why.

**Email.** Off by default, so the workflow can be published without a Gmail account. To add it, set `send_email` to true, switch on the **Email the customer** node and give it a Gmail credential. Each text then also goes by email to customers with an address. Email replies are not read: follow-ups stop on a text reply, STOP, or the page's Stop button.

## Settings

| Setting | Default | What it does |
| --- | --- | --- |
| `business_name` | `Your Business` | `{business_name}` in messages |
| `business_number` | blank | Your Twilio number, with + and the country code |
| `owner_cell` | blank | Where approval links, replies and wrap-ups go |
| `timezone` | `America/New_York` | For customer hours and your quiet hours |
| `n8n_url` | blank | The address of your n8n, used to build the approval links |
| `request_key` | blank | A long random phrase of your own, 12 characters or more. Every request must include it as `key` |
| `require_consent` | `true` | Only text customers marked `ok_to_text` |
| `cooldown_days` | `30` | Skip anyone texted by this workflow in this many days. `0` turns it off |
| `followup_days` | `2, 5` | Days after the previous text for each follow-up. Blank means no follow-ups |
| `followup_1`, `followup_2` | a short check-in each | The follow-up texts. `{first_name}`, `{business_name}`, `{detail}` and `{sent_day}` are filled in. Add a `followup_3` field for a third text of your own |
| `optout_line` | `Reply STOP to opt out.` | Added to the first text unless the message already says STOP |
| `customer_hours_start`, `customer_hours_end` | `09:00`, `20:00` | Customer texts only go out in these hours, in your time zone |
| `quiet_start`, `quiet_end` | `21:00`, `07:00` | Your own texts wait for morning |
| `approval_hours` | `48` | A request nobody approved in this time expires |
| `max_per_run` | `40` | Customer texts per 10 minute check |
| `send_email`, `email_subject` | `false` | See Email above |

## Trying it out

1. Publish it with your own cell as `owner_cell`.
2. Post a request with your own cell as the only customer, `ok_to_text` true, and `followup_days` set to `0.002` (about 3 minutes).
3. Open the link from the text, read the page, press Approve.
4. The first text comes on the next check, then a follow-up, then a wrap-up.
5. Reply to the text (if your number's incoming webhook points here) and the reply comes back to you.
6. Put `followup_days` back.

On n8n 2.x a change to a published workflow does not reach the running copy until you publish again.

## Tests

- [`tests/outreach.test.js`](tests/outreach.test.js) runs the Code node source straight out of the workflow file with the clock frozen, through the whole life of a request: 52 checks covering settings, the request key, consent and every skip reason, the approval page (wrong code, escaping, opening changes nothing), approve, cancel, stop, expiry, customer hours, your quiet hours, follow-up timing and wording, replies, STOP and START, Twilio refusals and error 21610, email, the wrap-up, and that the file ships with no credentials, no phone numbers or emails, and sticky notes that follow n8n's template rules. `cd tests && npm install && node outreach.test.js`. CI runs it on every push.
- [`docs/VERIFIED-RESULTS.md`](docs/VERIFIED-RESULTS.md) has the live runs in a real n8n with a real Twilio number.
- [`docs/DECISIONS.md`](docs/DECISIONS.md) explains the design choices.

## Limits

- **Customer hours use your time zone.** A customer in another time zone gets texts in your hours, not theirs.
- **Memory needs a published workflow.** Requests, who is being followed up and opt-outs live in n8n's workflow static data, which n8n keeps only for published workflows.
- **Opt-outs are this workflow's own.** It keeps its own list, and Twilio's carrier-level STOP (error 21610) is honored when it comes back. It does not read opt-outs from your CRM.
- **The reply webhook does not check Twilio's signature.** Someone who knows the URL could post a fake reply. The worst it can do is end one person's follow-ups or send you a fake reply text.
- **Anyone with the approval link can approve.** The link carries a random code for that one request. Do not forward it.
- **One owner.** Approval links, replies and wrap-ups go to one cell.
- **Subaccounts.** It uses the first active account the Twilio credential returns.

Only text customers who agreed to hear from you, and follow your Twilio campaign's rules. Some states limit contacting homeowners right after a disaster. Check yours before using this for storm work.

## License

MIT. Use it, change it, sell it.

Built by [Mike Matthews](https://github.com/mikematthewsai). More standalone workflows and the full lead-response system: [n8n-lead-response](https://github.com/mikematthewsai/n8n-lead-response).
