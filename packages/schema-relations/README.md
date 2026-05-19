# @open-ontology/schema-relations

Experimental first-class relation combinators for Effect Schema.

This package lets schemas declare semantic IDs and references directly on fields.
The package does not render an IDE. It exposes metadata, graph extraction, and
generic validation that tools such as Schema IDE can consume.

```ts
import { Schema } from "effect";
import { Relation } from "@open-ontology/schema-relations";

const Form = Schema.Struct({
  id: Relation.id("Form"),
  fields: Schema.Array(
    Schema.Struct({
      id: Relation.id("Field", { scope: Relation.parent("Form") }),
      label: Schema.String,
    }),
  ),
});

const Policy = Schema.Struct({
  id: Relation.id("Policy"),
  formId: Relation.ref("Form"),
  requiredFieldIds: Schema.Array(Relation.ref("Field", { scopedBy: "formId" })),
});
```

`buildRelationGraph` walks a schema and decoded value to collect definitions and
references. `validateRelations` reports duplicate IDs and unresolved references.
