# Ledgerlight: personal finance app

A private, local-first money manager. Everything runs on this computer: the database is a single SQLite file in `data/finance.db`, and nothing is sent to any bank, cloud or analytics service.

## Start it

Double-click **`Start Ledgerlight.command`**. It starts a small local server and opens <http://localhost:8765>. Close the Terminal window to stop it.

There is nothing to install: it uses the Python 3 and SQLite that ship with macOS. (From a terminal: `python3 server.py`.)

The first time macOS may say the file is from an unidentified developer. Right-click it, choose **Open**, then **Open** again.

## What's inside

| Area | Tools |
|---|---|
| Overview | Dashboard, Net worth, Cash flow (Sankey) |
| Money | Accounts (with reconcile), Transactions (filter, bulk edit, export), Budgets (category, 50/30/20, envelope), Bills & subscriptions, Money calendar |
| Plan | Goals (what-if), Debts & loans (avalanche / snowball payoff planner), Investments (XIRR, allocation, rebalancing), Forecast & scenarios |
| Insight | Reports builder, Pattern lab (32 analyses), Health score, Taxes (80C/80D, old vs new regime estimate) |
| Tools | 8 calculators, Categories & rules, Import & export, Settings |

## Your data

- **Sample data** loads on first run: a fictional household with 24 months of history. Remove it from the banner on the dashboard, from the home page, or from *Import & export → Remove all data*.
- **Import** bank or card statements as CSV from *Import & export*. Columns are detected automatically; your rules and a built-in keyword list sort transactions into categories. Duplicates are skipped.
- **Backups**: the database is copied to `data/backups/` before any "replace all" or "remove all", and on demand. You can also download a full `.json` backup and restore it later.

If the server is not running and you open `public/app.html` directly, the app still works but keeps data in the browser instead of the database file.

## Files

```
Start Ledgerlight.command   double-click launcher
server.py                   local server + SQLite API (standard library only)
data/finance.db             your database
data/backups/               automatic backups
public/index.html           home page
public/app.html             the app (left tool panel + all pages)
public/css/styles.css       design system and animations
public/js/                  store, sample data, charts, pattern analysis, pages
```

Shortcuts inside the app: **N** add transaction · **/** or **⌘K** search · **Shift H** hide amounts.
