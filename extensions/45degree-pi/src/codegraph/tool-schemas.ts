import {Type} from "typebox";

export const exploreParameters = Type.Object({
  query: Type.String(),
  limit: Type.Optional(Type.Number({minimum: 1, maximum: 100}))
});

const symbolParameters = {
  symbol: Type.String(),
  limit: Type.Optional(Type.Number({minimum: 1, maximum: 100}))
};

export const callersParameters = Type.Object(symbolParameters);
export const calleesParameters = Type.Object(symbolParameters);
export const impactParameters = Type.Object({
  ...symbolParameters,
  depth: Type.Optional(Type.Number({minimum: 1, maximum: 10}))
});
