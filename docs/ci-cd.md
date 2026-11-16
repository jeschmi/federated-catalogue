# CI / CD

This service uses GitHub Actions. The authoritative workflow definitions live in `.github/workflows/` and are visible on
GitHub:

https://github.com/project-construct-x/federated-catalogue/actions

| Workflow     | File                                 | Purpose                                                                 |
|--------------|--------------------------------------|-------------------------------------------------------------------------|
| Docker build | `.github/workflows/docker-build.yml` | Build/push GHCR images on `dev`; deploy to Construct-X staging on push |
| Publish      | `.github/workflows/publish.yml`      | Release: publish Docker images + Helm chart to GHCR                     |

## Container images

Images are published to GitHub Container Registry under this repository:

- `ghcr.io/project-construct-x/federated-catalogue/fc-service-server`
- `ghcr.io/project-construct-x/federated-catalogue/fc-fuseki`
- `ghcr.io/project-construct-x/federated-catalogue/fc-admin-dashboard`

`fc-demo-portal` is local-testing only (Docker Compose / `Dockerfile` target); it is not built or published to GHCR.
The admin dashboard is published with the other images and, on the staging deploy, served at
`/dashboard`. Its redirect URIs are in `fc-realm.json`. Realm import does not update a realm
that already exists, so a staging realm created before those URIs were added needs them
set in the Keycloak admin console.

Branch builds use `docker-build.yml` on **`dev`** (`GITHUB_TOKEN`, `packages: write`);
`latest` and branch tag `dev` are published from `dev`. After a successful image push,
the same workflow deploys Helm release `fc-service` to kube context `construct-x-stag`
(namespace `federated-catalogue`, created if missing) using
[`deployment/helm/extra-stages/construct-x-dev.yaml`](../deployment/helm/extra-stages/construct-x-dev.yaml).

`main` is reserved for upstream merges and does not build or push images. Releases and
manual `workflow_dispatch` runs use `publish.yml`, which also pushes the Helm chart as
an OCI artifact:

```bash
helm install fc oci://ghcr.io/project-construct-x/federated-catalogue/fc-service --version <semver>
```

### Deploy secrets / environment

GitHub Environment **`construct-x-dev`** (or repository secrets):

| Secret | Purpose |
|--------|---------|
| `KUBE_CONFIG` | Base64 of a **minimal** kubeconfig file (one line; context `construct-x-stag`). See below. |
| `FC_KEYCLOAK_CLIENT_SECRET` | Keycloak secret for the confidential `federated-catalogue-service` client (also written onto the public `federated-catalogue` client). CI patches `fc-realm.json` at deploy time and applies the matching K8s secret (value is **not** committed). Realm import does not update a realm that already exists. |
| `GHCR_PULL_TOKEN` | Optional long-lived PAT with `read:packages`. CI stores it as the `ghcr-pull` image pull secret. If unset, the job's `GITHUB_TOKEN` is used; that token can pull during the deploy and expires when the job ends. Its lifetime cannot be extended. |

#### `KUBE_CONFIG`

The deploy job decodes this secret with `base64 -d` and writes `$HOME/.kube/config`. That matches GitHub’s [base64 blob secrets](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets#storing-base64-binary-blobs-as-secrets): one standard-Base64 encoding of the whole file, not a second encoding of the certificate fields.

`certificate-authority-data`, `client-certificate-data`, and `client-key-data` are already base64 and must each stay on a single line. A newline or space inside one of them makes `kubectl` fail with `illegal base64 data at input byte N`. Copying the YAML or the secret through a wrapped chat or terminal inserts that break. Encode the file and pass that output straight to `gh`.

The file’s context name must be `construct-x-stag` (`kubectl config use-context` in the workflow). A STACKIT download often names the context after the cluster (`k8s-stag-01`). Rename it, then encode:

```bash
kubectl config --kubeconfig=kubeconfig.yaml rename-context k8s-stag-01 construct-x-stag
kubectl config --kubeconfig=kubeconfig.yaml use-context construct-x-stag

# Linux. -w 0 keeps the secret on one line.
base64 -w 0 kubeconfig.yaml | gh secret set KUBE_CONFIG --env construct-x-dev

# macOS base64 has no -w. Strip the wrap, then set the same secret:
# base64 -i kubeconfig.yaml | tr -d '\n' | gh secret set KUBE_CONFIG --env construct-x-dev
```

Set it on the **`construct-x-dev` environment**. An environment secret overrides a repository secret of the same name, and the deploy job reads the environment.

Check the round-trip before trusting a pasted value:

```bash
base64 -w 0 kubeconfig.yaml | base64 -d > /tmp/kubeconfig.check
kubectl --kubeconfig=/tmp/kubeconfig.check config get-contexts
rm -f /tmp/kubeconfig.check
```

`construct-x-stag` must be listed. Delete the check file; it contains the client key.

Manual deploy one-liner: see the header of `construct-x-dev.yaml` or the Helm README §Construct-X staging.

Workflow runs, logs, and status badges are the source of truth — this file is a pointer.
