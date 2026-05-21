# @schema-ide/onboarded-config

First-party Onboarded account configuration workspace for Schema IDE.

This package owns the Onboarded domain schemas, a YAML sample workspace, and an
embedded `onboarded-config` CLI. It is intentionally packaged like a consumer of
Schema IDE: the package imports `@schema-ide/cli`, embeds its workspace schema,
and can bundle the result into a standalone Node entry.

## Validate

```bash
pnpm --dir packages/onboarded-config build
node packages/onboarded-config/dist/cli.js validate \
  --dir packages/onboarded-config/workspaces/onboarded-account-yaml/files \
  --json
```

The same workspace can be loaded by the generic Schema IDE CLI:

```bash
schema-ide validate \
  --schema packages/onboarded-config/workspaces/onboarded-account-yaml/schema-ide.config.ts \
  --dir packages/onboarded-config/workspaces/onboarded-account-yaml/files \
  --json
```

## Bundle

```bash
pnpm --dir packages/onboarded-config build:bundle
node packages/onboarded-config/dist/bundle/onboarded-config.cjs validate \
  --dir packages/onboarded-config/workspaces/onboarded-account-yaml/files \
  --json
```

The bundle embeds the Onboarded workspace schema, so consumers do not need to
pass `--schema`.
