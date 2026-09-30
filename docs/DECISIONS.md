# Design decisions

**A person approves every send.** The workflow that finds the customers is software guessing. The message goes out under the owner's name, to people who trusted them once. One tap on a page that shows the exact text and the exact list costs a few seconds and prevents the kind of mistake that loses customers.

**Opening the link never sends.** Messaging apps can open links on their own to build previews. Only the buttons, which POST, can approve, cancel or stop.

**Consent is checked by default.** Texting customers who never agreed breaks carrier rules and the law in many places. `require_consent` is on, and every customer left out is counted by reason on the page, so the owner sees who was skipped and why.

**Cooldown across requests.** A bad week can bring several storms. Nobody should get three texts from the same business in five days because three things happened. Anyone texted in the last `cooldown_days` is skipped.

**A reply ends the follow-ups.** The point of the texts is a conversation. Once someone answers, anything automated after that is noise. The reply goes to the owner's phone with the name and number.

**STOP means stop, everywhere.** STOP ends every active follow-up for that number and keeps it off future requests. Twilio's own carrier-level opt-out (error 21610) is treated the same way. START removes it.

**Customer hours are separate from your quiet hours.** Customers get texts from 9 to 8 by default. The owner's own texts wait out 9 PM to 7 AM. A reply at 11 PM reaches the owner at 7.

**The wrap-up closes the loop.** Without it, nobody knows whether the outreach worked. One text when everyone is finished, with the counts, and a link back to the page.

**No database.** Requests, follow-ups and opt-outs live in the workflow's static data. It keeps the template importable with one credential. The limit is that it is this workflow's own memory, not a CRM.

**Email is optional and switched off.** n8n refuses to publish a workflow with a node missing its credential, so an email step that is on by default would block everyone who only wants texts.

**Generic on purpose.** It does not know about weather. Anything that can make an HTTP request can hand it a group of customers and a message, which is what makes it useful for recalls, outages, price changes and the rest.
