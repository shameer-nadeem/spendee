# Spendee

A personal finance PWA. Log money, split bills with friends, see where you spend. Currency: PKR. All data stays on your phone (IndexedDB). No backend, no accounts, no tracking.

## Run locally

```
python3 -m http.server 8000
```

Then open http://localhost:8000

## Run the tests

```
node tests.js
```

## Deploy on GitHub Pages

1. Push the code to GitHub (`git push origin main`).
2. On GitHub open the repo, then Settings, then Pages.
3. Under Build and deployment choose Source: Deploy from a branch.
4. Branch: `main`, folder: `/ (root)`. Click Save.
5. Wait about a minute and refresh. The page shows your link: `https://shameer-nadeem.github.io/spendee/`

## Add to iPhone home screen

1. Open the link in Safari (not inside another app).
2. Tap the Share button, then "Add to Home Screen", then Add.
3. Open Spendee from the home screen icon and enter your starting balance there.

The home screen app and the Safari tab keep separate data. Always use the home screen icon after you add it.

## Updating the app

Change `CACHE` in `sw.js` (for example `spendee-v10`) every time you push a change. Otherwise the phone keeps showing the old cached version.

## Backups

History tab, Backup card: Export saves a JSON file. Import restores it. Export one every couple of weeks and keep the file somewhere safe (iCloud Drive or Files). Do not commit backup files to git.

## Final test checklist

- [ ] Opens as an app from the home screen, no Safari bar
- [ ] Works with airplane mode on
- [ ] First launch asks for a starting balance
- [ ] Add an expense: balance goes down, toast shows
- [ ] Add an Earning: balance goes up
- [ ] Split lunch: 6000 with Ali 2000 and Hamza 2500 shows "Your real spend: Rs 1,500"
- [ ] Friends owing more than the total blocks saving
- [ ] Owed tab: Ali and Hamza listed; Mark paid raises the balance
- [ ] History: filter, edit and delete work; delete removes friend entries too
- [ ] Dashboard: month selector, bars, top 3, friends owe you
- [ ] Quick entry: "lunch 6000 Ali 2000 Hamza 2500" fills the form; Save is still manual
- [ ] Dictation with the keyboard mic works in the quick entry box
- [ ] Export backup, delete an entry, import the backup: the entry comes back
- [ ] Notch and home bar do not cover the tabs or buttons
