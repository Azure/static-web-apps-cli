import ajv4 from "ajv-draft-04";

// See https://github.com/ajv-validator/ajv/issues/2132#issuecomment-1290409907
export const Ajv = ajv4 as unknown as typeof ajv4.default;

export { JSONSchemaType, ValidateFunction } from "ajv-draft-04";
