# @schema-ide/examples

Neutral fixtures for the Schema IDE playground and package tests.
Use this package when you need a ready-made workspace schema plus JSON/YAML files.
Examples currently cover prompt evals, survey questions, and release workflows.
The package depends on core only and has no React, agent, or server dependency.
This package is the extraction target for `@schema-ide/examples`.

```ts
import { randomSchemaIdeExample, schemaIdeExamples } from "@schema-ide/examples";

const first = schemaIdeExamples[0];
const random = randomSchemaIdeExample();
```
