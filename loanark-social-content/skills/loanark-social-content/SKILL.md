---
name: loanark-social-content
description: Give a real estate agent a week of ready-to-post social content in their voice — educational carousels, myth-vs-fact posts, 15-second reel scripts, attributed rate-index alerts, program explainers, seasonal and holiday posts, and consented just-closed celebrations — sized for Instagram, Facebook, LinkedIn, X and TikTok, co-branded with their Loan Ark loan officer, with no rates and no audience targeting. Also turns a client conversation into posts. Use when an agent says "content for this week", "posts for", "reel script", "carousel about", "myth vs fact", "turn this call into content", "content calendar", or "what should I post".
---

# Loan Ark Social Content

The goal is overload: more good posts than the agent can use, each one a copy-and-paste away, each one safe. The agent picks the topics and the tone once (in their brand profile); this skill produces. Read `references/brand-and-compliance.md` first, then `references/post-types.md` for the formats and the rules for each; `references/program-facts.md` holds the only financing facts a post may state.

## Inputs

- Their `realtor-brand-profile.md` (voice, market, who they help, never-say list, LO, co-brand block). Without it, write in a warm, plain voice and say once that the Loan Ark Realtor Brand Kit will make the next batch sound like them.
- What they want this time: a week's calendar (default), one post type, or a specific topic.
- Optional fuel: a pasted client conversation or call summary (with names removed), a market note from the Loan Ark Market Pulse skill, a listing, a recent closing (with the client's written permission), a local event.

Ask one question at most. If nothing is specified, produce the default week.

## The default week

Seven posts, one per day, across types, each with a platform-native version where the platforms differ:

1. **Monday: educational carousel** (5 to 7 slides, one idea per slide, under 20 words each, plus a caption). Topic from the buyer/seller explainer library (pre-approval, VA, 2-1 buydown, assumables, seller credits, what happens after you're in contract, ADU, down payment help).
2. **Tuesday: market note** from the Market Pulse output if provided; otherwise a no-number version ("what a Fed week means if you're house hunting").
3. **Wednesday: myth vs fact** (three pairs; each fact stated structurally, no numbers).
4. **Thursday: reel script** (15 seconds: hook in the first two seconds, three beats, a close; on-screen text lines; caption).
5. **Friday: local or listing post** (the agent's listing, open house, neighborhood fact with a source, or a "coming soon"; Fair Housing rules apply).
6. **Saturday: personal-brand post** (why the agent does this work, a lesson from a recent deal without identifying anyone, a behind-the-scenes moment).
7. **Sunday: just-closed or client-story post** only with permission on file, otherwise a seasonal or homeowner-tip post.

Deliver as a calendar table (day, type, hook, platforms), then each post in full with a heading the agent can find. Include for each: the caption, hashtags (3 to 5, one with the city, none that target people), the on-screen or slide text where relevant, and whether the co-brand block or the short form applies.

## From a conversation

When the agent pastes a call or client exchange: strip anything identifying (names, addresses, numbers, employer, anything about the client's finances or life situation), find the two or three questions the client asked that other people also ask, and turn each into a post that answers it in the agent's voice. Never quote the client. Never reference "a client of mine who…" with details that could identify them.

## Platform sizing

- Instagram: caption under 2,200 characters, the first 125 do the work; carousels and reels as above; a story version of the hook in under 15 words.
- Facebook: conversational, one question to invite replies, no hashtag pile.
- LinkedIn: two-line hook, then short paragraphs, under 3,000 characters, professional but still the agent.
- X: under 280 characters, one idea, link or no link.
- TikTok: the reel script plus a caption under 150 characters and the on-screen text.

## Guardrails that bite here

- **Rates:** never a Loan Ark rate, payment, APR, or "you'd qualify". An index alert is allowed only as "[figure]% national average (Optimal Blue Mortgage Market Indices via FRED, as of [date])" with no Loan Ark attachment and no payment math; if the figure and date were not supplied or fetched, write the alert without a number. See the Market Pulse sources file if that skill is installed.
- **Reg Z:** if a requested post needs a down-payment percentage, payment, term, or APR to make its point, mark the draft "LO approval required" at the top and explain in one line why.
- **Fair Housing:** describe homes, process, and the agent, never who a home or neighborhood is for. No "families", "young professionals", "empty nesters", "safe", "good schools" as a pitch, no proxies. No ad-targeting suggestions of any kind: no audiences, ZIP exclusions, age ranges, lookalikes, or "people who…" filters, even if asked.
- **Consent:** closings, client stories, testimonials, and photos of clients only with the client's written permission on file; the "before you post" note asks for it. Never a buyer's address, price paid, or loan details.
- **Truth:** no invented stats, awards, sales counts, or reviews. "Fact" posts use only `references/program-facts.md` (the same facts the Buyer Explainers skill uses); if a fact is not there, leave it out.
- **Same offer to every agent:** never write a post implying that Loan Ark gives this agent something other agents do not get.
- **Co-brand:** any post that mentions financing, a loan officer, a program, or the market carries at least the short Loan Ark line ("Loan Ark Inc. · NMLS 2693461 · Equal Housing Lender") and the agent's license line; the agent's own posts that do not touch financing carry the agent's license identity only.

Every batch ends with a two-line "before you post" note: what to confirm (permissions, listing facts, brokerage review) and which posts, if any, need the LO's eyes.
