# @schema-ide/ui

Small local UI primitive set used by the Schema IDE React package.
Use this package for the copy-pasteable Button, Badge, ScrollArea, Textarea, and `cn` helper.
It exists so Schema IDE does not depend on any host application design system.
The primitives are intentionally narrow and should stay boring.
This package is the extraction target for `@schema-ide/ui`.

```tsx
import { Button, Textarea } from "@schema-ide/ui";

<form>
  <Textarea placeholder="Ask about the workspace..." />
  <Button type="submit">Send</Button>
</form>;
```
