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
   grep -rl "ForkLine" index.html | xargs sed -i 's/ForkLine/NewName/g'
   ```

## Structure

```
index.html              homepage
assets/site.config.js   brand name and contact details
assets/main.js          fills brand slots, form placeholder
assets/styles.css       all styles (dark theme only)
assets/favicon.svg
```
