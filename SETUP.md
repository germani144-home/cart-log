# Set up your own Home log

Home log is a small app for a household: a shared grocery list that sorts itself by shop section, to-do lists and
notes, and a list of dishes with recipes. Two phones see the same list, live. This guide sets up your **own copy**: your
own address, your own database, nothing shared with anyone else. It costs nothing.

**If you're not a developer:** give this page to Claude, for example: _"Help me set up Home log by following
https://github.com/germani144-home/cart-log/blob/main/SETUP.md"_. Claude will walk you through it one step at a time.

---

## For Claude: how to guide them

You are helping someone, probably not technical, set up their own copy of Home log on a phone.

- **Go one step at a time.** Say what to tap, in plain words, and wait for them to say it worked before the next
  step. Ask what phone they have (Android or iPhone) and use the matching instructions.
- **Start with Level 1.** Offer Level 2 (sharing with a partner, private lists) after it works.
- **You write the files, they paste them.** The only file a copy ever changes is `firebase-config.js`. Give them the
  complete new file in one code block and tell them how to paste it on the GitHub website (below). If you have access
  to their GitHub repository (for example in Claude Code), you may make the commit yourself instead.
- **List codes are the secret, the config is not.** A list code works like a password for that list: anyone who
  knows it can read and change the list. Codes go only into the Firebase rules and into the app on their phones,
  **never** into a file in the repository (it's public) and never into an issue or a post. The Firebase web config
  (`firebase-config.js`) is not secret: it only says which project to use, and the rules decide who may use it.
- **Making codes.** Make each code yourself: 12 random characters from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (capital
  letters and digits, no 0/O or 1/I), for example with Python's `secrets.choice`. Make a new one each time; never reuse
  a code from this guide or from anywhere else. Tell them to keep their codes in a note or password manager.
- **Things only they can do:** create accounts, click in GitHub, Firebase and Google Cloud. Never ask for their
  passwords.
- **Don't change anything else:** not the app code, not `manifest.json` (its `id` must stay `cart-log-v1`). If a step
  fails, explain what you see and suggest the fix from "If something goes wrong" below; don't improvise.
- In the steps below, `USERNAME` is their GitHub username (or organization) in **lower case**, and `ADDRESS` is
  `https://USERNAME.github.io/cart-log/`.

### How to paste a new `firebase-config.js` (GitHub website, works on a phone too)

1. In their copy on github.com, tap the file `firebase-config.js` (in the top folder of the list of files).
2. Tap the pencil icon (**Edit this file**). On a phone the pencil may be in the **⋯** menu.
3. Select everything in the editor and delete it, then paste the new file from Claude.
4. Tap **Commit changes…**, then **Commit changes** again.
5. The site updates by itself within a minute or two.

---

## Level 1: the app on your phone (about 20 minutes)

One list, synced through your own free Firebase project (Google). It works on one phone; Level 2 adds a second.

1. **GitHub account** _(them)_. Go to https://github.com/signup and create a free account. The username becomes part
   of the app's address, so pick something you're happy to see in it. Confirm the e-mail address.
2. **Copy the app** _(them)_. Open https://github.com/germani144-home/cart-log, tap **Fork**, keep the name
   `cart-log`, and tap **Create fork**. A fork keeps a **Sync fork** button for getting updates later.
   - If they already have another installed web app on `USERNAME.github.io` (for example their own Nap Log), see
     "This app is already installed" below first and fork into a new organization instead.
3. **Publish it** _(them)_. In the copy: **Settings → Pages**. Under "Build and deployment", Source: **Deploy from a
   branch**, Branch: **main** and **/ (root)**, then **Save**. After a minute or two the page shows "Your site is live
   at `ADDRESS`".
4. **Firebase project** _(them)_. Go to https://console.firebase.google.com and sign in with a Google account. Tap
   **Create a project**, name it for example `home-log`, switch **Google Analytics off**, and create it. It starts on
   the free **Spark** plan; don't add a billing account, it isn't needed.
5. **Database** _(them)_. In the project: **Build → Firestore Database → Create database**. Pick a location near them
   (in Europe, for example `eur3`), then **Start in production mode** → **Create**.
6. **List code** _(Claude)_. Make one code (see "Making codes" above), for example in the shape `K7QM2XRP9DTA` (make a
   new one; don't use this example). This is their household's list.
7. **Rules** _(Claude writes, they paste)_. In Firestore Database, open the **Rules** tab, replace everything with this
   (with their code), and tap **Publish**:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       // Only these list codes can read or write. Add a code here before using it in the app.
       function listOk(id) { return id in ['LISTCODE']; }
       match /lists/{listId}/{sub}/{id} {
         allow read, write: if listOk(listId);
       }
     }
   }
   ```

   Only these codes work; nobody can list the codes, so nobody can find them. Codes are written exactly as the app
   shows them: capital letters and digits, inside `'…'`, separated by commas.

8. **Web config** _(them)_. Tap the **⚙ next to "Project Overview" → Project settings**. Under "Your apps", tap the
   **web icon `</>`**, give it a nickname (for example `home-log`), leave "Firebase Hosting" off, and tap **Register
   app**. Firebase shows a block starting with `const firebaseConfig = {`. Copy that block and send it to Claude. (It
   isn't secret, see above.)
9. **Settings** _(Claude writes, they paste)_. Their `firebase-config.js`, with the values from their block (keep the
   name `FIREBASE_CONFIG`, in capitals):

   ```js
   // This copy's own Firebase project (free Spark plan). In a copy (a fork), this is the only file to change: see SETUP.md.
   const FIREBASE_CONFIG = {
     apiKey: '…',
     authDomain: '…',
     projectId: '…',
     storageBucket: '…',
     messagingSenderId: '…',
     appId: '…',
   };
   ```

10. **Open it and join the list** _(them)_. Open `ADDRESS` on the phone. On the first screen, type the list code under
    **or join an existing one** and tap **Join**. (Use Join, not "Create a new list": that makes a random code that
    isn't in their rules yet.) The dot at the top should say **live**. For a start, ⋯ → **Add starter dishes with
    recipes** fills the Recipes tab.
11. **Install it** _(them)_.
    - **Android (Chrome):** tap **⋮ → Install app** (or **Add to home screen**), then **Install**.
    - **iPhone (Safari):** after joining, tap the **Share** button → **Add to Home Screen** → **Add**. The address
      now ends in `?list=CODE`; that's how the home-screen app starts already in the list (on an iPhone it keeps its
      own storage, separate from Safari), so add it from this page, not from a bare `ADDRESS`.

    From now on, open Home log from the new icon.

It worked if the dot says **live**, and an item added on the phone shows up again after closing and reopening the app.

---

## Level 2: share with your partner (optional, about 10 minutes)

**The same list on a second phone.** The code is already in the rules, so nothing changes in Firebase:

1. On the first phone: **⋯ → Share link** (or **Copy link**) and send it to the partner. The link is
   `ADDRESS?list=CODE`, so treat it like the code: send it privately.
2. On the partner's phone, open the link, then install it as in Level 1, step 11 (on an iPhone: Safari, from the page
   the link opened). Or open `ADDRESS` and type the code under **Join**.

Both phones now see the same groceries, notes and recipes; a change on one shows on the other within seconds.

**Private lists and notes** (🔒, only on one phone). In the **Notes** tab, **＋ New → Private** makes a list or note
that only that phone sees. It's stored under that phone's own **private code**, which must also be in the rules:

1. _(Claude)_ Make one private code per phone that wants private lists.
2. _(Claude writes, they paste)_ Add the codes to the rules and **Publish**, for example
   `function listOk(id) { return id in ['LISTCODE', 'PRIVATE_CODE_PHONE_1', 'PRIVATE_CODE_PHONE_2']; }`.
3. _(them, on each phone, before making its first private list)_ **⋯ → Restore private lists from another phone**,
   type that phone's private code, OK. The ⋯ menu now shows it under "Your private lists". Each phone uses its own
   code; don't share it with the other phone.

If a phone already made a private list before its code was in the rules, ⋯ shows the code it made: add that code to
the rules instead, then make the private list again (what was made before didn't save).

**Another shared list** (for example a second household): make a new code, add it to the rules, and join it with
that code on the phones that should see it.

---

## Getting updates

When the original Home log improves: open their copy on github.com and tap **Sync fork → Update branch**. Their
`firebase-config.js` is the only file they ever changed, and the original never changes it, so syncing never
conflicts. The phones pick up the new version by themselves the next time the app is opened (the version number next
to the title changes; if not, close the app and open it again).

## If something goes wrong

- **The address shows "404"**: Pages takes a few minutes after Level 1 step 3, and after each change. Check
  **Settings → Pages** says the site is live, and that the address is all lower case.
- **Nothing syncs, or the dot says "sync error"**:
  - The code isn't in the rules: it must be there exactly as the app shows it (⋯ shows the list code), and the rules
    must be **Published**. Joining a code that isn't in the rules gives "sync error".
  - The config is wrong or still the original's: `firebase-config.js` must hold their own project's values, with the
    name `FIREBASE_CONFIG`. With the original's config, nothing can sync (the original's rules don't know their codes).
  - **"local only"** means the app found no usable config: check that the file was committed and that the site
    updated (open `ADDRESS` again after a couple of minutes).
  - Something added while it said "sync error" didn't save; add it again once it says **live**.
- **"This app is already installed" on Android**: Android allows only one installed web app per address
  (`USERNAME.github.io`), so a second app there can't be installed. Give Home log its own address with a free GitHub
  organization: on github.com, their picture → **Your organizations → New organization → Free**, pick a name (for
  example `USERNAME-home`), then in their copy **Settings → General → Transfer ownership** to that organization (or
  fork the original into it). Turn on Pages there again (Level 1, step 3). The address becomes
  `https://ORGNAME.github.io/cart-log/`; open and install from there (list codes and rules stay the same).
- **Optional: limit the key to their address.** The web key can only reach their project, and their rules protect
  the lists, but they can also restrict it: https://console.cloud.google.com → pick the Firebase project → **APIs &
  Services → Credentials** → the key named "Browser key (auto created by Firebase)" → **Application restrictions:
  Websites**, add `https://USERNAME.github.io/*` (their real address, with `/*`) → **Save**. If syncing stops after
  this ("sync error"), the address there doesn't match the one in the browser; fix it or remove the restriction.
  Changes can take a few minutes.
