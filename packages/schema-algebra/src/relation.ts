export { derivedId, id, key, parent, path, pathRef, pathRefs, ref, refs } from "./combinators";
export { buildRelationGraph as graph } from "./graph";
export {
  buildEntityIndex as entityIndex,
  definitionLocations,
  referenceDiagnostics,
  references,
} from "./inspect";
export { validateRelations as validate } from "./validate";
export type {
  RelationAnnotation,
  RelationDerivedIdAnnotation,
  RelationDefinition,
  RelationDiagnostic,
  RelationEntityIndex,
  RelationEntityIndexEntry,
  RelationGraph,
  RelationIdAnnotation,
  RelationKind,
  RelationParentScope,
  RelationPathScope,
  RelationRefAnnotation,
  RelationReference,
  RelationScope,
} from "./types";
