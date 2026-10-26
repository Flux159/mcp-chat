# CLAUDE.md

## Releases

### Version numbers

Versions are `major.minor.patch`, and each part only goes up to 9. There are never two-digit parts like `0.1.10` or `4.10.0`:

- After `x.y.9` comes `x.(y+1).0`, e.g. `0.1.9` → `0.2.0`
- After `x.9.9` comes `(x+1).0.0`, e.g. `4.9.9` → `5.0.0`
- Otherwise bump the patch, e.g. `0.2.0` → `0.2.1`

Pick the next version yourself using these rules. Don't rely on the workflow's auto-increment.

### Publishing

Create a GitHub release with a new `v{version}` tag on `main`, e.g. `gh release create v0.2.0 --target main --title "Release v0.2.0"`. The tag triggers `.github/workflows/cd.yml`, which:

- sets `package.json` to the tag's version and pushes a "Bump version" commit to `main` (don't bump `package.json` by hand)
- publishes to npm with trusted publishing (OIDC; there is no npm token secret)
- builds and pushes the multi-arch Docker image `flux159/mcp-chat`

`ci.yml` doesn't build the Docker image, so check `docker buildx build .` locally before releasing changes that affect dependencies or the Dockerfile.
