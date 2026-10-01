# Verified results

Run in a real n8n Cloud instance (2.39.7) on September 30, 2026, with a real Twilio number texting the owner's own cell, which was also the only customer. The request came from the [weather watch](https://github.com/mikematthewsai/n8n-weather-watch-past-customers) workflow replaying the real May 19, 2025 hail day. Execution ids are n8n's own. What was not run is listed at the end.

For the test the check ran every minute instead of every 10, and `followup_days` was `0.002` (about 3 minutes) with one follow-up. Both were put back afterwards and the workflow was switched off.

## Runs

| Time (UTC) | Execution | What happened | Result |
| --- | --- | --- | --- |
| 17:02:18 | 422 | Request from the weather watch: 1 customer, `ok_to_text` true | Passed. Answered `{"ok": true, "eligible": 1}`. The approval text went to the owner's cell right away and he confirmed it arrived |
| 17:02:34 to 17:03:15 | 424 to 430 | The approval page webhook ran seven times: page opens in Chrome and from the owner's phone, and the button presses | Passed. Opening the page changed nothing. The request stayed "waiting" until Approve was pressed |
| 17:02 | one of 424 to 430 | Approve pressed on the page | Passed. "Approved. 1 customer will get the first text within 10 minutes." The owner also pressed Approve from his phone; a request can only be approved once |
| 17:03:28 | 431 | Next check | Passed. First text sent, with the opt-out line. The owner confirmed it arrived |
| 17:06:28 | 434 | Check after the follow-up time | Passed. Follow-up sent |
| 17:07:28 | 435 | Next check | Passed. Wrap-up to the owner: "1 texted: 1 no answer after every follow-up" |
| 17:08:02 | 436 | Simulated reply "Yes please..." posted to the reply webhook | Passed. Status "replied", the reply text kept, and the owner was texted the reply with the name and number |
| 17:08:10 | 437 | Simulated STOP | Passed. Number opted out |
| 17:08:14 | 438 | Simulated START | Passed. Opt-out removed |
| 17:08:41 | 440 | Simulated text from a number in no outreach | Passed. Ignored. The answer to Twilio was an empty `<Response></Response>` |

19 executions on the workflow in that window, 0 errors. Every text Twilio was asked to send came back accepted (queued).

**Why the replies were simulated.** The Twilio number used for the test already sends its incoming texts to another live system, and that was not changed. The replies were posted to the reply webhook in the same form Twilio uses (`From`, `Body`).

**Finding that changed the workflow.** n8n would not publish it while the optional **Email the customer** node had no Gmail credential. Anyone who only wants texts would have been stuck, so that node now ships switched off. It was switched off before the runs above.

## Changes after the live runs

- A follow-up sent the same day as the first text said "our text from Wednesday". It now says "earlier today". Only reachable with follow-up gaps under a day.
- Wording in the testing sticky note and the setup note about email.
- For n8n's template review (Oct 1): the sticky notes were redone to n8n's rules (a yellow main note of 100 to 300 words with How it works and Setup steps, section notes of 50 words or less, no overlaps), nodes were moved so each sits inside one section note, and the settings ship blank with no example phone numbers, emails, n8n address or key. In the Code nodes the only change is the settings check, which now asks for the numbers to be filled in instead of refusing the old example numbers.

The Code nodes are otherwise the ones that ran. The automated checks below ran on the final file.

## Local checks

[`tests/outreach.test.js`](../tests/outreach.test.js): 52 checks against the Code node source in the workflow file, with the clock frozen. CI runs them on every push.

## Not run live

- A real reply through Twilio's incoming webhook (simulated, see above).
- Follow-ups at real day gaps, customer hours and your quiet hours. Covered by the automated checks.
- Twilio refusing a text, including error 21610. Covered by the automated checks.
- Email through Gmail.
- More than one customer, and `max_per_run`.
- Requests from anything other than the weather watch.
