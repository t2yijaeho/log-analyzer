# Security

## Supported version

Security fixes are applied to the latest commit on `main`.

## Reporting

Do not open a public issue for a suspected vulnerability. Use GitHub's private vulnerability reporting feature for this repository.

Include the affected endpoint or component, reproduction steps, impact, and any suggested mitigation. Avoid including live credentials or private log data.

## Deployment boundary

The GitHub Pages dashboard is static: bundled and opened files are parsed in the browser and no OpenAI credential is present.

The optional API is intended for a personal or otherwise access-controlled deployment. Production startup requires a bearer token, restricts remote log hosts, and rate-limits requests. It is not designed as a public multi-tenant service.

Never deploy with the local OpenAI key that was previously exposed in plaintext; rotate it first.
