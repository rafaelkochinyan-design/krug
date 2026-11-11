# Business Rules

This document describes who can see what, and who can do what, in Krug.
It is written for the product owner — no programming knowledge required.

For the code that enforces these rules, see **`packages/domain/src/policy.ts`**.
Anything marked **[planned]** is not yet built.

---

## Roles and states

Before reading the rules, it helps to know the words used for each type of person:

| Word                   | Meaning                                                                         |
| ---------------------- | ------------------------------------------------------------------------------- |
| **Anonymous**          | Someone not signed in at all                                                    |
| **Signed-in outsider** | Signed in, but not in this circle                                               |
| **Waitlisted**         | In the queue; the circle is full                                                |
| **Member**             | Joined the circle (has a seat)                                                  |
| **Organizer**          | Created the circle                                                              |
| **Left**               | Was in the circle but chose to leave                                            |
| **Removed**            | Was kicked out by the organizer [planned: no one sets "removed" yet]            |
| **Blocked**            | The organizer has blocked this person, or this person has blocked the organizer |

---

## What is never shown

Regardless of role, **the following personal contact details are never shared with other people**:

- Email address
- Phone number
- Telegram chat ID
- City (personal location)
- Age confirmation date (`adultConfirmedAt`)

The only personal information another person sees is a **name** (and later a photo, [planned]).

---

## Invite page (`/i/<code>`)

This page is public — anyone with the link can open it, without signing in.

| What is shown                                | Who sees it                                        |
| -------------------------------------------- | -------------------------------------------------- |
| Organizer's **first name only** (e.g. "Ani") | Everyone                                           |
| Circle title, activity, day, time, location  | Everyone                                           |
| Number of spots left                         | Everyone                                           |
| Whether the circle is still accepting people | Everyone                                           |
| Member names                                 | Signed-in users only [**coming in PR2**]           |
| Full name of anyone                          | Nobody (always first name only on the invite page) |

---

## Circle detail page (`/circles/<id>`)

Only people who are **currently in the circle** (joined or waitlisted) can open this page.
Everyone else gets "not found" — the circle ID reveals nothing to outsiders.

| What is shown                                 | Who sees it                              |
| --------------------------------------------- | ---------------------------------------- |
| Circle details (title, schedule, venue, etc.) | Members and waitlisted only              |
| List of joined members (name and role)        | Members and waitlisted only              |
| Number of spots left and waitlist count       | Members and waitlisted only              |
| Chat link                                     | **Joined members only** (not waitlisted) |
| Invite link and code                          | **Organizer only**                       |
| "Me" section (your own role and status)       | Members and waitlisted only              |

---

## Joining (`POST /v1/invites/<code>/join`)

Who can join a circle, and what happens:

1. **Circle must be open.** Only circles in `recruiting` or `active` status accept new people.
   A closed circle returns an error (409).

2. **No block.** If the organizer has blocked you (or you have blocked the organizer), you
   cannot join. This returns a "forbidden" error (403).

3. **Idempotent.** If you are already joined or waitlisted, pressing Join again does nothing
   and you stay in your current state.

4. **Removed members cannot rejoin.** If the organizer removed you from the circle,
   you cannot come back. This returns a "forbidden" error (403).

5. **18+ only** [**enforced from step 10**]. The rule exists and is in the code, but it is
   not checked during join yet. It will be enforced once age confirmation is wired to sign-up.

6. **Spot or waitlist.** If there is a free spot, you join immediately. If the circle is full,
   you are waitlisted. The position depends on when you joined.

7. **Rejoining after leaving.** If you left voluntarily and the circle is still open, you can
   rejoin. Your membership row is updated — a second row is never created.

---

## Leaving (`POST /v1/circles/<id>/leave`)

- Any **joined or waitlisted member** (except the organizer) can leave.
- The **organizer cannot leave** until they hand the circle over to another member
  [handover is planned].
- After leaving, your status becomes `left`. You are removed from the member list.
- **No automatic promotion.** The next person on the waitlist is not automatically offered the
  freed spot yet [step 1.6].

---

## Removing a member [planned]

- The **organizer** or a **co-host** can remove any non-organizer member.
- Nobody can remove the organizer.
- Once removed, the person **cannot rejoin** (see Joining rule 4 above).

---

## Editing the circle [planned]

- Only the **organizer** can edit circle details (title, time, venue, etc.).

---

## Creating a circle

- Must be **signed in** [signed-in check is enforced].
- Must be **18 or older** [**enforced from step 10**].
  The rule is defined but the check is currently disabled.

---

## Account deletion [planned]

Planned behaviour (not yet built):

- Deleting an account sets `deletedAt` on the user record. Personal data is wiped.
- The person leaves all circles they are in (status → `left`).
- Their name disappears from member lists (shown as "deleted user" or hidden entirely).
- **If they are an organizer, they must hand the circle over first.** An organizer with
  active circles cannot delete their account until handover.

---

## Blocked users

- Block relationships are symmetric: if A blocks B, B also cannot join A's circle.
- Currently, blocks can only be inserted directly into the database; there is no
  "block user" button in the app yet [**planned**].
- A blocked person sees a "forbidden" error (403) when trying to join.

---

## Waitlist

- When a circle is full, new joiners are waitlisted in the order they arrive.
- **No automatic promotion yet** (step 1.6). When someone leaves, the next person on the
  waitlist will eventually be offered the spot and given 24 hours to accept. This is not
  built yet.
- If you leave and rejoin, your original join time is kept, so your position in the waitlist
  will be decided when the waitlist-ordering feature lands (step 1.6); no order is promised
  today.

---

## Where this lives in code

All of the above access decisions are implemented as pure, testable functions in:

```
packages/domain/src/policy.ts
```

The functions take plain data (no database access) and return a simple yes/no with a reason.
The API service (`apps/api/src/modules/circles/service.ts`) calls these functions and maps
the reasons to HTTP status codes:

| Reason                    | HTTP status   |
| ------------------------- | ------------- |
| `not_open`                | 409 Conflict  |
| `blocked`                 | 403 Forbidden |
| `removed`                 | 403 Forbidden |
| `not_adult`               | 403 Forbidden |
| `not_member`              | 404 Not Found |
| `organizer` (can't leave) | 409 Conflict  |

Keeping decisions in domain means they can be tested in isolation, reused by the app,
and changed in one place.
