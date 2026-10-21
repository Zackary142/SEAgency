# SEAgency

Frontend for the software engineering studio, provisionally named **ForkLine**. This is a static site for now (plain HTML, CSS and JS) with no build step.

The backend lives in the private `SEAgency-API` repository. Anything that needs secrets (accounts, the enquiry form, repo access) goes there, never here.

## Run locally

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Renaming the company

The name is provisional. To change it:

1. Edit `name` (and `email`) in `assets/site.config.js`. The page fills every brand slot from this at load time.
2. Update the fallback text that search engines see before scripts run:
   ```sh
   grep -rl "ForkLine" *.html | xargs sed -i 's/ForkLine/NewName/g'
   ```

## Structure

```
index.html              homepage
signin.html             sign in and create account (clients and engineers)
dashboard.html          customer or engineer dashboard, depending on who signs in
privacy.html            privacy notice
assets/site.config.js   brand name, contact details and the API address
assets/main.js          fills brand slots, form placeholder, smooth scroll
assets/api.js           calls to SEAgency-API (session cookie, no tokens in JS)
assets/signin.js        sign in page
assets/dashboard.js     both dashboards
assets/sample-data.js   made-up data for previewing the dashboards
assets/styles.css       all styles (dark theme only)
assets/favicon.svg
```

## Accounts and dashboards

Accounts are handled by `SEAgency-API`. Until it is deployed, leave `apiUrl`
empty in `assets/site.config.js`: sign in then offers a preview, and the
dashboard shows sample data. Switch between the views with
`dashboard.html?preview=customer`, `customer-empty`, `engineer` or `pending`.

Once the API is live, set `apiUrl` to its address. The API must list this
site's address in its `FRONTEND_ORIGIN` so the browser sends the session
cookie.

The privacy notice version in `assets/signin.js` must match the date on
`privacy.html`. Change both when the notice changes.

## Deploying changes

GitHub Pages tells browsers to cache CSS and JS for 10 minutes. When you change a file in `assets/`, bump the `?v=` number on its links in every `.html` page so visitors get the new version straight away.
