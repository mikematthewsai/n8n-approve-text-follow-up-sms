# Texts and page from the live test

Real texts from the runs in [docs/VERIFIED-RESULTS.md](../docs/VERIFIED-RESULTS.md). The owner was also the only customer, so every text went to one phone. Phone numbers are replaced by 555 numbers and the approval link is shortened.

## To the owner: the approval link

```
Hail near 1 past customer (Mon May 19)
Hail up to 1.50 in reported within 3 mi of 1 past customer:
- Mike Test (Lorena) (555) 555-0199, 0.7 mi from 1.50 in hail at Mon 10:53 AM (Lorena, TX)

Ready to text 1 of them. Nothing goes out until you approve:
https://your-n8n/webhook/outreach-approve?r=...&c=...
```

## The approval page

Before approving, the page shows:

```
Hail near 1 past customer (Mon May 19)
Status: waiting

[the summary above]

The first text, as Mike would see it
Hi Mike, this is Matthews Automation (test). Hail up to 1.50 inch was reported near your home on Mon May 19. Hail damage is easy to miss from the ground. Want us to take a free look? Reply YES and we will set up a time. Reply STOP to opt out.

If there is no reply, a follow-up 0.002 days later. A reply or STOP ends it for that person.
Texts go out between 09:00 and 20:00 (America/New_York).

[Approve and send to 1]  [Cancel]

Mike Test (Lorena)   0.7 mi   +15555550199
```

After pressing Approve:

```
Approved. 1 customer will get the first text within 10 minutes.
...
Status: approved
1 active
[Stop all follow-ups]
Mike Test (Lorena)   0.7 mi   active
```

## To the customer: first text

```
Hi Mike, this is Matthews Automation (test). Hail up to 1.50 inch was reported near your home on Mon May 19. Hail damage is easy to miss from the ground. Want us to take a free look? Reply YES and we will set up a time. Reply STOP to opt out.
```

## To the customer: follow-up

```
Hi Mike, Matthews Automation (test) again, following up on our text from Wednesday. If you would like a hand, just reply here.
```

With the test's 3 minute gap this went the same day, which is why it named the weekday. That now says "earlier today". At the default 2 day gap it names the day of the first text.

## To the owner: wrap-up

```
Finished: "Hail near 1 past customer (Mon May 19)". 1 texted: 1 no answer after every follow-up. Details: https://your-n8n/webhook/outreach-approve?r=...&c=...
```

## To the owner: a reply

```
Mike Test (Lorena) replied about "Hail near 1 past customer (Mon May 19)":
"Yes please, simulated reply from the live test"
Call or text them back: +15555550199
```
