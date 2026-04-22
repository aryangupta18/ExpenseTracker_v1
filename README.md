# Expense Tracker (HTML/CSS/JS)

Glassmorphism expense tracker with:

- Login / signup (local-only, stored in your browser)
- Add expenses with categories + date
- Summary with category-wise percentage
- Views: daily / weekly / monthly / yearly
- Budget planner (days or date range) with dynamic “suggested per day”

## Run

Because this is a static project, you can run it with any simple static server.

### Option A: VS Code / Cursor Live Server

- Install **Live Server**
- Right-click `index.html` → **Open with Live Server**

### Option B: PowerShell (Python)

If Python is installed:

```powershell
cd "e:\Current\Projects\Cursor AI\Expense Tracker"
python -m http.server 5173
```

Then open `http://localhost:5173`.

## Notes

- Data is saved per account in `localStorage`.
- “Clear all” deletes that account’s transactions + budget.

